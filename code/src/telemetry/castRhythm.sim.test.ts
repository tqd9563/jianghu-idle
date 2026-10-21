/**
 * 出招节奏与熟练时长 sim（battle-loot/design.md 裁决 45 / 46，issue #79）。
 *
 * 读现行名录与规则，用真实战斗量：
 * ① 全部圆满时各式的出场份额、「真气不足滑向轻招」的比例；
 * ② 逐式解锁过程中第 k 式每小时出招数（前 k − 1 式圆满、第 k 式生疏），按现行熟练阈值折成整门练透的挂机小时数。
 * 关卡取该境界推荐关里胜率 ≥ 0.6 的最后一关（略低于前沿的回刷 / 推关）。日常 CI 不跑（SIM_CAST=1 才跑）。
 *
 * 用法：SIM_CAST=1 npx vitest run src/telemetry/castRhythm.sim.test.ts → docs/systems/sim/cast_rhythm_measured.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { fight, type CombatSkill } from '../engine/combat';
import { allStages, type EnemyDef } from '../engine/enemies';
import { neigongOf, type Quality } from '../engine/neigong';
import { IDLE_SEC_OVERHEAD, IDLE_SEC_PER_ROUND } from '../engine/offlineRewards';
import { QUALITY_PARAMS, WUXUE, formKey, shulianThresholds, type WuxueId } from '../engine/wuxue';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';

const OUT = resolve(process.cwd(), '../docs/systems/sim/cast_rhythm_measured.json');
const TRIALS = 400;
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

/** 检查点：境界平台末的重数（sect-neigong/spec.md §7.1），按「比最高可得低一档」的标准构筑装满武学槽 */
interface Checkpoint { label: string; realm: number; zhong: number; nq: Quality; main: Quality; doors: WuxueId[] }
const CHECKPOINTS: Checkpoint[] = [
  { label: '境界1 传功单门', realm: 1, zhong: 0, nq: '寻常', main: '寻常', doors: ['luohanquan'] },
  { label: '境界2 末 6 门寻常', realm: 2, zhong: 40, nq: '寻常', main: '寻常', doors: ['liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian', 'pofengdao', 'kaibeidao'] },
  { label: '境界3 末 3 上乘 + 4 寻常', realm: 3, zhong: 61, nq: '上乘', main: '上乘', doors: ['jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian'] },
  { label: '境界4 末 3 绝学 + 3 上乘 + 2 寻常', realm: 4, zhong: 84, nq: '绝学', main: '绝学', doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
  { label: '境界5 末 4 绝学 + 3 上乘 + 2 寻常', realm: 5, zhong: 103, nq: '绝学', main: '绝学', doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'lianhualuodigun', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
];

type State = Parameters<typeof buildLoadout>[0] & Parameters<typeof playerBuild>[0];
const BIG = 99999;
/** open = 能出到第几式（前面各式圆满、第 open 式生疏）；open = 0 表示全部圆满 */
function stateOf(c: Checkpoint, open: number): State {
  const pages: string[] = [], casts: Record<string, number> = {};
  for (const id of c.doors) {
    const n = QUALITY_PARAMS[WUXUE[id].quality].forms;
    for (let k = 1; k <= n; k++) {
      pages.push(formKey(id, k));
      if (open === 0) casts[formKey(id, k)] = BIG;
      else if (k < Math.min(open, n)) casts[formKey(id, k)] = BIG;
      else if (k === Math.min(open, n)) casts[formKey(id, k)] = 0;
    }
  }
  return { realm: c.realm, neigong: neigongOf('huashan', c.nq), zhong: c.zhong, tiersPassed: 4, injuries: undefined as never,
    ownedWuxue: c.doors, equipped: c.doors, formCasts: casts, pages } as unknown as State;
}

interface Run { wr: number; rounds: number; fc: Record<string, number>; lowQi: number; casts: number }
function run(s: State, lo: CombatSkill[], enemy: EnemyDef, seed: number, n = TRIALS): Run {
  const b = playerBuild(s), rng = lcg(seed), qiMax = qiMaxOf(s);
  let wins = 0, rounds = 0, lowQi = 0, casts = 0; const fc: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const r = fight(b, enemy, { mode: 'rng', rng, loadout: lo, qiMax });
    if (r.win) wins++; rounds += r.rounds; lowQi += r.stats.lowQiCasts; casts += r.stats.casts;
    for (const [k, v] of Object.entries(r.stats.formCasts)) fc[k] = (fc[k] ?? 0) + v;
  }
  return { wr: wins / n, rounds: rounds / n, fc, lowQi, casts };
}
function stageFor(c: Checkpoint): EnemyDef {
  const s = stateOf(c, 1), lo = buildLoadout(s);
  const list = allStages().filter((e) => e.recommendedRealm === c.realm && e.kind === 'normal');
  let pick = list[0];
  for (const e of list) { if (run(s, lo, e, 1, 80).wr >= 0.6) pick = e; else break; }
  return pick;
}
const fightSec = (rounds: number) => rounds * IDLE_SEC_PER_ROUND + IDLE_SEC_OVERHEAD;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

describe.skipIf(!process.env.SIM_CAST)('出招节奏与熟练时长 sim', () => {
  it('写出 cast_rhythm_measured.json', () => {
    const cps: unknown[] = [];
    for (const c of CHECKPOINTS) {
      const enemy = stageFor(c);
      const main = c.doors.filter((id) => WUXUE[id].quality === c.main);
      const n = QUALITY_PARAMS[c.main].forms;
      // ① 全部圆满
      const sAll = stateOf(c, 0);
      const rAll = run(sAll, buildLoadout(sAll), enemy, 7);
      const byQ: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(rAll.fc)) {
        const [id, kk] = k.split(':'); const q = WUXUE[id as WuxueId].quality;
        const arr = (byQ[q] ??= []); arr[Number(kk) - 1] = (arr[Number(kk) - 1] ?? 0) + v;
      }
      const share = Object.fromEntries(Object.entries(byQ).map(([q, arr]) => {
        const tot = arr.reduce((a, b) => a + (b ?? 0), 0);
        return [q, Array.from(arr, (v) => r3((v ?? 0) / tot))];
      }));
      const sumP = r3(buildLoadout(sAll).reduce((a, sk) => a + sk.p, 0));
      // ② 逐式解锁速率
      const rates: number[] = [];
      for (let k = 1; k <= n; k++) {
        const s = stateOf(c, k);
        const r = run(s, buildLoadout(s), enemy, 11);
        const fph = 3600 / fightSec(r.rounds);
        rates.push(Math.round((main.reduce((a, id) => a + (r.fc[formKey(id, k)] ?? 0), 0) / main.length / TRIALS) * fph * 10) / 10);
      }
      const th = shulianThresholds(c.main)[2];
      const hours = rates.slice(0, -1).reduce((a, v) => a + th / v, 0);
      const row = {
        label: c.label, realm: c.realm, zhong: c.zhong, stage: `${enemy.map}-${enemy.tier}-${enemy.stage}`, qiMax: qiMaxOf(sAll),
        sumP, winrateMastered: rAll.wr, fightSec: Math.round(fightSec(rAll.rounds)), lowQiShare: r3(rAll.lowQi / Math.max(1, rAll.casts)), share,
        unlockRatesPerHour: rates, threshold: th, hoursToLastForm: Math.round(hours * 10) / 10, hoursToSecondForm: Math.round((th / rates[0]) * 10) / 10,
      };
      cps.push(row);
    }
    writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), trials: TRIALS, checkpoints: cps }, null, 2) + '\n');
  }, 600_000);
});
