/**
 * 武道源流七路的战力对拍（wudao-yuanliu/design.md §2 / §5）。
 *
 * 用真实战斗（combat.ts fight，实战掷骰）量「期望前沿」：胜率曲线下的面积（castBalance / gearForm 同一口径）。
 * 只看内功，不装武学、不穿装备，好让各路机制本身可比：
 *   一、各境界检查点上，七路对无标签敌人的期望前沿；新四路要落在旧三路的区间附近；
 *   二、境界 3 检查点上，七路对每种敌人标签的前沿，看各路的克制与被克（每路至少一处明显吃亏）。
 * 日常 CI 不跑（SIM_ROUTE=1 才跑）。
 *
 * 用法：SIM_ROUTE=1 npx vitest run src/telemetry/routeBalance.sim.test.ts → docs/systems/sim/route_balance_measured.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { fight } from '../engine/combat';
import type { RouteId } from '../engine/content';
import { enemyStatsAt, type EnemyDef, type EnemyTag } from '../engine/enemies';
import { neigongOf, type Quality } from '../engine/neigong';
import { QUALITY_PARAMS, WUXUE, formKey, type WuxueId } from '../engine/wuxue';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';

const OUT = resolve(process.cwd(), '../docs/systems/sim/route_balance_measured.json');
const ROUTES: RouteId[] = ['huashan', 'shaolin', 'tangmen', 'taixu', 'xuanji', 'jinghong', 'fenxue'];
const OLD: RouteId[] = ['huashan', 'shaolin', 'tangmen'];
const TRIALS = Number(process.env.SIM_TRIALS ?? 200);
const STEP = 0.1;
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

interface Checkpoint { label: string; realm: number; zhong: number; q: Quality; passed: number; doors?: WuxueId[] }
const CHECKPOINTS: Checkpoint[] = [
  { label: '境界1 传功', realm: 1, zhong: 0, q: '寻常', passed: 0 },
  { label: '境界2 末 寻常', realm: 2, zhong: 40, q: '寻常', passed: 3 },
  { label: '境界3 末 上乘', realm: 3, zhong: 61, q: '上乘', passed: 4 },
  { label: '境界4 末 绝学', realm: 4, zhong: 84, q: '绝学', passed: 5 },
  { label: '境界5 末 绝学', realm: 5, zhong: 103, q: '绝学', passed: 5 },
];
/** 带武学的检查点（castBalance 同款套装，全式圆满）；武学一律按无共鸣装，只比各路机制 */
const LOADED: Checkpoint[] = [
  { label: '境界3 末 上乘 + 武学', realm: 3, zhong: 61, q: '上乘', passed: 4, doors: ['jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian'] },
  { label: '境界4 末 绝学 + 武学', realm: 4, zhong: 84, q: '绝学', passed: 5, doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
];
const TAGS: EnemyTag[] = ['高闪', '高血', '高防', '高攻', '反伤', '破甲', '净化', '狂暴', '毒'];

function enemyAt(x: number, tags: EnemyTag[]): EnemyDef {
  const s = enemyStatsAt(x, tags);
  return { map: 1, stage: 1, name: 'x', ...s, tags, kind: 'normal', recommendedRealm: 1, reward: { neili: 0, silver: 0, xp: 0 }, x } as EnemyDef;
}
function stateOf(route: RouteId, c: Checkpoint) {
  const pages: string[] = [], casts: Record<string, number> = {};
  for (const id of c.doors ?? []) {
    for (let k = 1; k <= QUALITY_PARAMS[WUXUE[id].quality].forms; k++) { pages.push(formKey(id, k)); casts[formKey(id, k)] = 99999; }
  }
  return { realm: c.realm, neigong: neigongOf(route, c.q), zhong: c.zhong, tiersPassed: c.passed, injuries: undefined as never,
    ownedWuxue: c.doors ?? [], equipped: c.doors ?? [], formCasts: casts, pages } as never;
}
function winrate(route: RouteId, c: Checkpoint, tags: EnemyTag[], x: number, seed: number): number {
  const b = playerBuild(stateOf(route, c));
  // 武学按无共鸣的一路装（太虚目前没有本路武学），各路同一套招
  const neutral = stateOf('taixu', c);
  const loadout = c.doors ? buildLoadout(neutral) : undefined;
  const qiMax = c.doors ? qiMaxOf(neutral) : undefined;
  const rng = lcg(seed);
  let w = 0;
  for (let i = 0; i < TRIALS; i++) if (fight(b, enemyAt(x, tags), { mode: 'rng', rng, loadout, qiMax }).win) w++;
  return w / TRIALS;
}
/** 期望前沿：先找最后一个必胜点，再以 STEP 往上扫到必败，累加胜率 × 步长 */
function frontier(route: RouteId, c: Checkpoint, tags: EnemyTag[] = []): number {
  let x = 0.5;
  while (winrate(route, c, tags, x + 0.5, 1) === 1) x += 0.5;
  while (x > 0 && winrate(route, c, tags, x, 1) < 1) x -= 0.5;
  let area = x;
  for (let k = 0; k < 120; k++) {
    const wr = winrate(route, c, tags, x, 1 + k);
    area += wr * STEP;
    if (wr === 0) break;
    x += STEP;
  }
  return Math.round(area * 1000) / 1000;
}

describe.skipIf(!process.env.SIM_ROUTE)('武道源流七路对拍', () => {
  it('写出各检查点与各标签的期望前沿', () => {
    const bare = [...CHECKPOINTS, ...LOADED].map((c) => {
      const f = Object.fromEntries(ROUTES.map((r) => [r, frontier(r, c)])) as Record<RouteId, number>;
      const old = OLD.map((r) => f[r]);
      return { label: c.label, frontier: f, oldMin: Math.min(...old), oldMax: Math.max(...old), oldAvg: Math.round((old.reduce((a, v) => a + v, 0) / 3) * 1000) / 1000 };
    });
    const c3 = CHECKPOINTS[2];
    const base3 = bare[2].frontier;
    // 各标签相对无标签的前沿差：负得越多越吃亏
    const tags = Object.fromEntries(TAGS.map((t) => [t, Object.fromEntries(ROUTES.map((r) => [r, Math.round((frontier(r, c3, [t]) - base3[r]) * 1000) / 1000]))]));
    writeFileSync(OUT, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), trials: TRIALS, bare, tagDelta: { checkpoint: c3.label, ...tags } }, null, 2)}\n`);
  }, 3_600_000);
});
