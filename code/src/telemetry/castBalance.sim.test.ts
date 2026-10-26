/**
 * 武学参数改版前后的战力对拍（battle-loot/design.md 裁决 46）。
 *
 * 各境界检查点装一套标准武学（全式圆满 / 只会第一式两种状态），用真实战斗量「期望前沿」（胜率曲线下的面积，
 * 与 gearForm.sim.test.ts 同口径）。同一份文件在新代码与同日 main 上各跑一次，相减即改版带来的前沿位移。
 * 只用两边都有的接口（fight / buildLoadout / playerBuild / qiMaxOf / enemyStatsAt）。日常 CI 不跑（SIM_BAL=1 才跑）。
 *
 * 用法：SIM_BAL=1 BAL_OUT=<路径> npx vitest run src/telemetry/castBalance.sim.test.ts
 */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { fight } from '../engine/combat';
import { enemyStatsAt, type EnemyDef } from '../engine/enemies';
import { neigongOf, type Quality } from '../engine/neigong';
import { QUALITY_PARAMS, WUXUE, formKey, type WuxueId } from '../engine/wuxue';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';

const TRIALS = 200;
const STEP = 0.1;
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

interface Checkpoint { label: string; realm: number; zhong: number; nq: Quality; doors: WuxueId[] }
const CHECKPOINTS: Checkpoint[] = [
  { label: '境界1 传功 伏狮拳法', realm: 1, zhong: 0, nq: '寻常', doors: ['luohanquan'] },
  { label: '境界1 传功 摧峰掌法', realm: 1, zhong: 0, nq: '寻常', doors: ['kaishanzhang'] },
  { label: '境界1 传功 卷雪腿法', realm: 1, zhong: 0, nq: '寻常', doors: ['xuanfengtui'] },
  { label: '境界2 末 6 门寻常', realm: 2, zhong: 40, nq: '寻常', doors: ['liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian', 'pofengdao', 'kaibeidao'] },
  { label: '境界3 末 3 上乘 + 4 寻常', realm: 3, zhong: 61, nq: '上乘', doors: ['jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian', 'songtaojian', 'jiyujian'] },
  { label: '境界4 末 3 绝学 + 3 上乘 + 2 寻常', realm: 4, zhong: 84, nq: '绝学', doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
  { label: '境界5 末 4 绝学 + 3 上乘 + 2 寻常', realm: 5, zhong: 103, nq: '绝学', doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'lianhualuodigun', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'liuyunjian', 'qingpingjian'] },
  { label: '境界6 10 门：4 绝学 + 4 上乘 + 2 寻常', realm: 6, zhong: 120, nq: '绝学', doors: ['cangyajianjue', 'tianhedaoxuandao', 'bawangxiejiaqiang', 'lianhualuodigun', 'jinghongjian', 'feipuduanyajian', 'duanshuidao', 'nutaolieandao', 'liuyunjian', 'qingpingjian'] },
];

type State = Parameters<typeof buildLoadout>[0] & Parameters<typeof playerBuild>[0];
function stateOf(c: Checkpoint, mastered: boolean): State {
  const pages: string[] = [], casts: Record<string, number> = {};
  for (const id of c.doors) {
    const n = QUALITY_PARAMS[WUXUE[id].quality].forms;
    for (let k = 1; k <= n; k++) { pages.push(formKey(id, k)); if (mastered) casts[formKey(id, k)] = 99999; }
  }
  return { realm: c.realm, neigong: neigongOf('huashan', c.nq), zhong: c.zhong, tiersPassed: 4, injuries: undefined as never,
    ownedWuxue: c.doors, equipped: c.doors, formCasts: casts, pages } as unknown as State;
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
/** 期望前沿：先找最后一个必胜点，再以 STEP 往上扫到必败，累加胜率 × 步长 */
function frontier(s: State): number {
  let x = 0.5;
  while (winrate(s, x + 0.5, 1) === 1) x += 0.5;
  while (x > 0 && winrate(s, x, 1) < 1) x -= 0.5;
  let area = x;
  for (let k = 0; k < 120; k++) {
    const wr = winrate(s, x, 1 + k);
    area += wr * STEP;
    if (wr === 0) break;
    x += STEP;
  }
  return Math.round(area * 1000) / 1000;
}

describe.skipIf(!process.env.SIM_BAL)('武学改版前后战力对拍', () => {
  it('写出各检查点期望前沿', () => {
    const out = CHECKPOINTS.map((c) => {
      const row = { label: c.label, first: frontier(stateOf(c, false)), mastered: frontier(stateOf(c, true)) };
      console.log(`BAL ${row.label} 只会第一式 ${row.first} · 全圆满 ${row.mastered}`);
      return row;
    });
    if (process.env.BAL_OUT) writeFileSync(process.env.BAL_OUT, JSON.stringify(out, null, 2) + '\n');
  });
});
