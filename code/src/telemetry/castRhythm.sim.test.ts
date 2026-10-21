/**
 * 出招节奏与熟练阈值 sim（battle-loot/design.md 裁决 45 / §4.5）。
 *
 * 用真实战斗量四件事：① 各式耗气倍比下，推图里各式的出场份额与「真气不足滑向轻招」的比例；
 * ② 熟练减幅能否把圆满的第 k 式压到第 k − 1 式生疏的价；③ 各式倍率台阶对一门加权平均倍率的影响；
 * ④ 逐式解锁过程中每一式每小时的出招数 → 反推整门练透所需小时数（熟练阈值重标，issue #79）。
 * 日常 CI 不跑（SIM_CAST=1 才跑）。
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
import { QUALITY_PARAMS, RESONANCE_MULT, WUXUE, formKey, formMult, shulianThresholds, type WuxueId } from '../engine/wuxue';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';

const OUT = resolve(process.cwd(), '../docs/systems/sim/cast_rhythm_measured.json');
const TRIALS = 240;
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

/** 候选参数：各品质的耗气倍比、熟练四档耗气倍率、各式倍率台阶 */
interface Tuning { name: string; step: Record<Quality, number>; shu: [number, number, number, number]; mstep: number }
const STEPS: Record<string, Record<Quality, number>> = {
  A: { 寻常: 1.2, 上乘: 1.15, 绝学: 1.1 },
  B: { 寻常: 1.3, 上乘: 1.2, 绝学: 1.1 },
  C: { 寻常: 1.4, 上乘: 1.3, 绝学: 1.15 },
  D: { 寻常: 1.5, 上乘: 1.35, 绝学: 1.2 },
};
const SHU_FLAT: [number, number, number, number] = [1, 0.92, 0.84, 0.75];
const MSTEPS = [0.04, 0.08, 0.12];

/** 检查点：境界平台末的重数（sect-neigong/spec.md §7.1），装配按「比最高可得低一档」的标准构筑 */
interface Checkpoint { label: string; realm: number; zhong: number; nq: Quality; doors: WuxueId[] }
const CHECKPOINTS: Checkpoint[] = [
  { label: '境界1 传功单门', realm: 1, zhong: 0, nq: '寻常', doors: ['qingpingjian'] },
  { label: '境界2 末 6 门寻常', realm: 2, zhong: 40, nq: '寻常', doors: ['liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian', 'pofengdao', 'kaibeidao'] },
  { label: '境界3 末 3 上乘 + 4 寻常', realm: 3, zhong: 61, nq: '上乘', doors: ['jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian'] },
  { label: '境界4 末 3 绝学 + 3 上乘 + 2 寻常', realm: 4, zhong: 84, nq: '绝学', doors: ['cangyajianjue', 'luoxingjian', 'tianhedaoxuandao', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
  { label: '境界5 末 4 绝学 + 3 上乘 + 2 寻常', realm: 5, zhong: 103, nq: '绝学', doors: ['cangyajianjue', 'luoxingjian', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
];

type State = Parameters<typeof buildLoadout>[0] & Parameters<typeof playerBuild>[0] & { pages: string[]; formCasts: Record<string, number> };
function stateOf(c: Checkpoint, casts: Record<string, number>): State {
  const pages = c.doors.flatMap((id) => Array.from({ length: QUALITY_PARAMS[WUXUE[id].quality].forms }, (_, i) => formKey(id, i + 1)));
  return { realm: c.realm, neigong: neigongOf('huashan', c.nq), zhong: c.zhong, tiersPassed: 4, injuries: undefined as never,
    ownedWuxue: c.doors, equipped: c.doors, formCasts: casts, pages } as State;
}
/** all0：全式开全生疏；all3：全式开全圆满；数字 k：前 k − 1 式圆满、第 k 式生疏、其余未开 */
function castsFor(doors: WuxueId[], mode: 'all0' | 'all3' | number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of doors) {
    const n = QUALITY_PARAMS[WUXUE[id].quality].forms, th = shulianThresholds(WUXUE[id].quality)[2];
    const open = typeof mode === 'number' ? Math.min(n, mode) : n;
    for (let k = 1; k <= open; k++) out[formKey(id, k)] = mode === 'all3' || (typeof mode === 'number' && k < open) ? th : 0;
  }
  return out;
}
function tierOf(q: Quality, casts: number): number {
  const th = shulianThresholds(q);
  return casts >= th[2] ? 3 : casts >= th[1] ? 2 : casts >= th[0] ? 1 : 0;
}

/** 按候选参数改写一套装配：基础耗气 = 门耗气 × 倍比^(k−1)，实际耗气 = 基础 × 熟练档倍率，倍率 = mult0 + mstep × (k−1) */
function retune(lo: CombatSkill[], s: State, t: Tuning): CombatSkill[] {
  return lo.map((sk) => {
    const d = WUXUE[sk.id as WuxueId];
    return { ...sk, forms: sk.forms.map((f) => {
      const k = Number(f.key.split(':')[1]);
      const tier = tierOf(d.quality, s.formCasts[f.key] ?? 0);
      const base = Math.round(d.cost * t.step[d.quality] ** (k - 1));
      const res = f.mult / formMult(d, k, false) > 1.05;   // 共鸣
      const mult = (d.mult0 + t.mstep * (k - 1)) * (res ? RESONANCE_MULT : 1);
      return { ...f, baseCost: base, cost: Math.round(base * t.shu[tier]), mult };
    }) };
  });
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
/** 「略低于前沿」的关：该境界推荐关里胜率 ≥ 0.6 的最后一关（全式生疏、现行参数） */
function stageFor(c: Checkpoint): EnemyDef {
  const s = stateOf(c, castsFor(c.doors, 'all0')), lo = buildLoadout(s);
  const list = allStages().filter((e) => e.recommendedRealm === c.realm && e.kind === 'normal');
  let pick = list[0];
  for (const e of list) { if (run(s, lo, e, 1, 60).wr >= 0.6) pick = e; else break; }
  return pick;
}
const fightSec = (rounds: number) => rounds * IDLE_SEC_PER_ROUND + IDLE_SEC_OVERHEAD;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

describe.skipIf(!process.env.SIM_CAST)('出招节奏与熟练阈值 sim', () => {
  it('写出 cast_rhythm_measured.json', () => {
    const cps: unknown[] = [];
    for (const c of CHECKPOINTS) {
      const enemy = stageFor(c);
      const stage = `${enemy.map}-${enemy.tier}-${enemy.stage}`;
      const tun: Record<string, unknown> = {};
      // ① ② ③：全式开、全生疏 / 全圆满，各候选耗气倍比
      for (const [name, step] of Object.entries(STEPS)) {
        const t: Tuning = { name, step, shu: SHU_FLAT, mstep: 0.04 };
        const row: Record<string, unknown> = {};
        for (const mode of ['all0', 'all3'] as const) {
          const s = stateOf(c, castsFor(c.doors, mode));
          const lo = retune(buildLoadout(s), s, t);
          const r = run(s, lo, enemy, 7);
          const sec = fightSec(r.rounds), fph = 3600 / sec;
          // 按品质汇总各式份额
          const byQ: Record<string, number[]> = {};
          for (const [k, v] of Object.entries(r.fc)) {
            const [id, kk] = k.split(':'); const q = WUXUE[id as WuxueId].quality;
            const arr = (byQ[q] ??= []); arr[Number(kk) - 1] = (arr[Number(kk) - 1] ?? 0) + v;
          }
          const share: Record<string, number[]> = {};
          for (const [q, arr] of Object.entries(byQ)) { const tot = arr.reduce((a, b) => a + (b ?? 0), 0); share[q] = Array.from(arr, (v) => r3((v ?? 0) / tot)); }
          // ③ 加权平均倍率相对现行（等概率、+0.04/式）的比值，按各候选 mstep 给
          const avgMult: Record<string, Record<string, number>> = {};
          for (const ms of MSTEPS) {
            avgMult[String(ms)] = {};
            for (const [q, sh] of Object.entries(share)) {
              const n = QUALITY_PARAMS[q as Quality].forms;
              const mult0 = WUXUE[c.doors.find((d) => WUXUE[d].quality === q)!].mult0;
              const cur = mult0 + (0.04 * (n - 1)) / 2;
              const nw = mult0 + sh.reduce((a, v, i) => a + v * ms * i, 0);
              avgMult[String(ms)][q] = r3(nw / cur);
            }
          }
          const perDoorH: Record<string, number> = {};
          for (const [k, v] of Object.entries(r.fc)) { const id = k.split(':')[0]; perDoorH[id] = (perDoorH[id] ?? 0) + (v / TRIALS) * fph; }
          row[mode] = { winrate: r.wr, rounds: Math.round(r.rounds * 10) / 10, fightSec: Math.round(sec), fightsPerHour: Math.round(fph),
            lowQiShare: r3(r.lowQi / Math.max(1, r.casts)), share, avgMultRatio: avgMult,
            castsPerDoorHour: Object.fromEntries(Object.entries(perDoorH).map(([k, v]) => [k, Math.round(v)])) };
        }
        // ② 熟练锚点：圆满第 k 式的价 / 第 k−1 式生疏的价（主品质第一门）
        const q = c.nq, n = QUALITY_PARAMS[q].forms, d = WUXUE[c.doors[0]];
        const b = (kk: number) => Math.round(d.cost * step[q] ** (kk - 1));
        row.baseCosts = Array.from({ length: n }, (_, i) => b(i + 1));
        row.anchorRatio = Array.from({ length: n - 1 }, (_, i) => Math.round((Math.round(b(i + 2) * SHU_FLAT[3]) / b(i + 1)) * 100) / 100);
        tun[name] = row;
      }
      // ④ 逐式解锁：前 k−1 式圆满、第 k 式生疏时，第 k 式每小时出招数（主品质那几门的平均），用 B 与 C 两组倍比
      const prog: Record<string, number[]> = {};
      for (const name of ['B', 'C']) {
        const t: Tuning = { name, step: STEPS[name], shu: SHU_FLAT, mstep: 0.04 };
        const n = QUALITY_PARAMS[c.nq].forms, rates: number[] = [];
        const main = c.doors.filter((id) => WUXUE[id].quality === c.nq);
        for (let k = 1; k <= n; k++) {
          const s = stateOf(c, castsFor(c.doors, k));
          const lo = retune(buildLoadout(s), s, t);
          const r = run(s, lo, enemy, 11);
          const fph = 3600 / fightSec(r.rounds);
          rates.push(Math.round((main.reduce((a, id) => a + (r.fc[formKey(id, k)] ?? 0), 0) / main.length / TRIALS) * fph));
        }
        prog[name] = rates;
      }
      cps.push({ label: c.label, realm: c.realm, zhong: c.zhong, stage, qiMax: qiMaxOf(stateOf(c, {})), tunings: tun, unlockRatesPerHour: prog });
      console.log(`CP ${c.label} 关 ${stage} 真气 ${qiMaxOf(stateOf(c, {}))} 解锁速率 B=${prog.B.join('/')} C=${prog.C.join('/')}`);
    }
    writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), trials: TRIALS, checkpoints: cps }, null, 2) + '\n');
  });
});
