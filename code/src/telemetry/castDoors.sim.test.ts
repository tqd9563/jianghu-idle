/**
 * 逐门余量复核（battle-loot/design.md 裁决 46；calib_cast.py 解析校准的实战对照）。
 *
 * 每门武学在本品质的参考检查点上，装 4–5 份同款（全式圆满），用真实战斗量期望前沿，减去不装武学的前沿 = 这门的余量。
 * 同品质各门的余量应当接近（解析模型把它们校成同强度）；偏差大的特效要回头修解析估值。
 * 日常 CI 不跑（SIM_DOORS=1 才跑）。
 *
 * 用法：SIM_DOORS=1 npx vitest run src/telemetry/castDoors.sim.test.ts → docs/systems/sim/cast_doors_measured.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { fight } from '../engine/combat';
import { enemyStatsAt, type EnemyDef } from '../engine/enemies';
import { neigongOf, type Quality } from '../engine/neigong';
import { QUALITY_PARAMS, WUXUE, WUXUE_IDS, formKey, type WuxueId } from '../engine/wuxue';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';

const OUT = resolve(process.cwd(), '../docs/systems/sim/cast_doors_measured.json');
const TRIALS = 300;
const STEP = 0.05;
/** 同款份数：寻常触发几率高，装 5 份会撞 75% 上限，改装 4 份 */
const COPIES: Record<Quality, number> = { 寻常: 4, 上乘: 5, 绝学: 5 };
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };
/** 各品质的参考检查点（境界平台末重数，sect-neigong/spec.md §7.1） */
const REF: Record<Quality, { realm: number; zhong: number }> = {
  寻常: { realm: 2, zhong: 40 }, 上乘: { realm: 3, zhong: 61 }, 绝学: { realm: 4, zhong: 84 },
};

type State = Parameters<typeof buildLoadout>[0] & Parameters<typeof playerBuild>[0];
function stateOf(q: Quality, id: WuxueId | null): State {
  const { realm, zhong } = REF[q];
  const doors = id ? Array(COPIES[q]).fill(id) : [];
  const n = id ? QUALITY_PARAMS[WUXUE[id].quality].forms : 0;
  const pages = id ? Array.from({ length: n }, (_, k) => formKey(id, k + 1)) : [];
  const casts = id ? Object.fromEntries(pages.map((k) => [k, 99999])) : {};
  return { realm, neigong: neigongOf('huashan', '寻常'), zhong, tiersPassed: 4, injuries: undefined as never,
    ownedWuxue: id ? [id] : [], equipped: doors, formCasts: casts, pages } as unknown as State;
}
function enemyAt(x: number): EnemyDef {
  const s = enemyStatsAt(x);
  return { map: 1, stage: 1, name: 'x', ...s, tags: [], kind: 'normal', recommendedRealm: 1, reward: { neili: 0, silver: 0, xp: 0 }, x } as EnemyDef;
}
function winrate(s: State, x: number, seed: number): number {
  const b = playerBuild(s), lo = buildLoadout(s), qiMax = qiMaxOf(s), rng = lcg(seed);
  let w = 0;
  for (let i = 0; i < TRIALS; i++) if (fight(b, enemyAt(x), { mode: 'rng', rng, loadout: lo, qiMax }).win) w++;
  return w / TRIALS;
}
function frontier(s: State): number {
  let x = 0.5;
  while (winrate(s, x + 0.5, 1) === 1) x += 0.5;
  while (x > 0 && winrate(s, x, 1) < 1) x -= 0.5;
  let area = x;
  for (let k = 0; k < 200; k++) {
    const wr = winrate(s, x, 1 + k);
    area += wr * STEP;
    if (wr === 0) break;
    x += STEP;
  }
  return area;
}

describe.skipIf(!process.env.SIM_DOORS)('逐门余量复核', () => {
  it('写出 cast_doors_measured.json', () => {
    const rows: { id: string; name: string; quality: Quality; type: string; effect: string; p: number; margin: number }[] = [];
    for (const q of ['寻常', '上乘', '绝学'] as Quality[]) {
      const bare = frontier(stateOf(q, null));
      for (const id of WUXUE_IDS.filter((i) => WUXUE[i].quality === q && !WUXUE[i].signature)) {
        const d = WUXUE[id];
        rows.push({ id, name: d.name, quality: q, type: d.type, effect: d.effect, p: d.p, margin: Math.round((frontier(stateOf(q, id)) - bare) * 1000) / 1000 });
      }
    }
    const lines: string[] = [];
    for (const q of ['寻常', '上乘', '绝学'] as Quality[]) {
      const g = rows.filter((r) => r.quality === q).sort((a, b) => a.margin - b.margin);
      const m = g.map((r) => r.margin), mean = m.reduce((a, b) => a + b, 0) / m.length;
      lines.push(`DOORS ${q} 余量 均值 ${mean.toFixed(3)} 最低 ${m[0].toFixed(3)} 最高 ${m[m.length - 1].toFixed(3)}`);
      for (const r of g) lines.push(`  ${r.type} ${r.effect} ${r.name} 触发 ${r.p} 余量 ${r.margin.toFixed(3)}（均值 ${(r.margin / mean * 100).toFixed(0)}%）`);
    }
    console.log(lines.join('\n'));
    writeFileSync(OUT, JSON.stringify(rows, null, 1) + '\n');
  }, 600_000);
});
