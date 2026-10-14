/**
 * 装备分型系数复核（battle-loot/design.md 裁决 36、spec.md §1.1「型系数待 sim 复核」）。
 *
 * 用真实战斗（combat.ts fight，实战掷骰）量「期望前沿」：胜率曲线下的面积（sect-neigong/sim.py 同一口径）。
 * 每个部位各穿一件上乘（蓝）第一型 / 第二型、不带词条、等级 = 前沿 − 0.3，看两型的余量差；再看四件全第一型 / 全第二型。
 * 判据写在 spec.md §7；日常 CI 不跑（SIM_FORM=1 才跑）。
 *
 * 用法：SIM_FORM=1 npx vitest run src/telemetry/gearForm.sim.test.ts → docs/systems/sim/gear_form_measured.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { fight } from '../engine/combat';
import type { RouteId } from '../engine/content';
import { enemyStatsAt, type EnemyDef } from '../engine/enemies';
import { FORM_NAMES, GEAR_SLOTS, rollGear, type GearItem, type GearSlot, type Worn } from '../engine/gear';
import { neigongOf } from '../engine/neigong';
import { playerBuild } from '../store/gameStore';

const OUT = resolve(process.cwd(), '../docs/systems/sim/gear_form_measured.json');
const ROUTES: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
/** 检查点（battle-loot/spec.md §7.1）：境界 3 / 4 平台末的重数 */
const CHECKPOINTS: { realm: number; zhong: number }[] = [{ realm: 3, zhong: 61 }, { realm: 4, zhong: 84 }];
const TRIALS = 200;
const STEP = 0.1;

const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

function enemyAt(x: number): EnemyDef {
  const s = enemyStatsAt(x);
  return { map: 1, tier: 0, stage: 1, name: 'x', ...s, tags: [], kind: 'normal', recommendedRealm: 1, reward: { neili: 0, silver: 0, xp: 0 }, x };
}

/** 指定型的一件：rollGear 的第三次掷骰定型（<0.5 第一型），再去掉词条 */
function piece(slot: GearSlot, form: 0 | 1, level: number): GearItem {
  const seq = [0.5, 0.5, form === 0 ? 0.1 : 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  let i = 0;
  const it = rollGear({ slot, cat: '剑', grade: 3, level, clearSilver: 1 }, () => seq[Math.min(i++, seq.length - 1)]);
  return { ...it, afx: [] };
}

function winrate(route: RouteId, realm: number, zhong: number, worn: Worn, x: number, seed: number): number {
  const build = playerBuild({ realm, neigong: neigongOf(route, '寻常'), zhong, tiersPassed: 4, injuries: undefined as never, worn });
  const rng = lcg(seed);
  let w = 0;
  for (let i = 0; i < TRIALS; i++) if (fight(build, enemyAt(x), { mode: 'rng', rng }).win) w++;
  return w / TRIALS;
}

/** 期望前沿：先粗找最后一个必胜点，再以 STEP 往上扫到必败处，胜率曲线下的面积 */
function frontier(route: RouteId, realm: number, zhong: number, worn: Worn): number {
  let x = realm - 1;
  while (winrate(route, realm, zhong, worn, x + 0.5, 1) === 1) x += 0.5;
  while (winrate(route, realm, zhong, worn, x, 1) < 1) x -= 0.5;
  let area = x;
  for (let k = 0; k < 100; k++) {
    const wr = winrate(route, realm, zhong, worn, x, 1 + k);
    area += wr * STEP;
    if (wr === 0) break;
    x += STEP;
  }
  return area;
}

describe.skipIf(!process.env.SIM_FORM)('装备分型：两型的余量差（SIM_FORM=1）', () => {
  it('每部位两型各穿一件、四件同型，量期望前沿', () => {
    const rows: { route: RouteId; realm: number; base: number; bySlot: Record<string, [number, number]>; all: [number, number] }[] = [];
    for (const { realm, zhong } of CHECKPOINTS) {
      for (const route of ROUTES) {
        const base = frontier(route, realm, zhong, {});
        const level = base - 0.3;
        const bySlot: Record<string, [number, number]> = {};
        for (const slot of GEAR_SLOTS) {
          bySlot[slot] = [0, 1].map((f) => frontier(route, realm, zhong, { [slot]: piece(slot, f as 0 | 1, level) }) - base) as [number, number];
        }
        const all = [0, 1].map((f) => frontier(route, realm, zhong, Object.fromEntries(GEAR_SLOTS.map((s) => [s, piece(s, f as 0 | 1, level)]))) - base) as [number, number];
        rows.push({ route, realm, base, bySlot, all });
        console.log(`境界 ${realm} ${route}：基线 ${base.toFixed(2)} · ` + GEAR_SLOTS.map((s) => `${s} ${FORM_NAMES[s][0]} ${bySlot[s][0].toFixed(2)} / ${FORM_NAMES[s][1]} ${bySlot[s][1].toFixed(2)}`).join(' · ') + ` · 四件第一型 ${all[0].toFixed(2)} / 第二型 ${all[1].toFixed(2)}`);
      }
    }
    // 汇总：各部位两型余量差的平均与最大
    const diff: Record<string, { mean: number; max: number }> = {};
    for (const slot of GEAR_SLOTS) {
      const ds = rows.map((r) => r.bySlot[slot][0] - r.bySlot[slot][1]);
      diff[slot] = { mean: Math.round(ds.reduce((a, b) => a + b, 0) / ds.length * 1000) / 1000, max: Math.round(Math.max(...ds.map(Math.abs)) * 1000) / 1000 };
    }
    const allDs = rows.map((r) => r.all[0] - r.all[1]);
    const allDiff = { mean: Math.round(allDs.reduce((a, b) => a + b, 0) / allDs.length * 1000) / 1000, max: Math.round(Math.max(...allDs.map(Math.abs)) * 1000) / 1000 };
    console.log('两型余量差（第一型 − 第二型，当量）：' + GEAR_SLOTS.map((s) => `${s} 均 ${diff[s].mean} 最大 ${diff[s].max}`).join(' · ') + ` · 四件 均 ${allDiff.mean} 最大 ${allDiff.max}`);
    writeFileSync(OUT, JSON.stringify({
      generated: new Date().toISOString().slice(0, 10),
      note: '由 code/src/telemetry/gearForm.sim.test.ts 生成（SIM_FORM=1）：真实战斗的期望前沿，上乘（蓝）不带词条、等级 = 前沿 − 0.3；余量 = 较不穿装备高出的当量。',
      trials: TRIALS, step: STEP, diff, allDiff, rows,
    }, null, 1) + '\n');
  }, 1_800_000);
});
