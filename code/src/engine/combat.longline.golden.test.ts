/**
 * 长线 golden 对照：招式 + 火候构筑、关卡当量换算的敌人、随当量放大的防御常数。
 * fixture 由 docs/systems/sim/export_longline_fixtures.py 从 longline_sim / mvp0_sim 导出；
 * 失败先查实现是否偏离 sim，改规则先改 sim 再重导出。
 */
import { describe, expect, it } from 'vitest';
import type { RouteId } from './content';
import { fight, makeBuild } from './combat';
import { enemyStatsAt, type EnemyDef, type EnemyTag } from './enemies';
import fixtures from './golden/longline-fixtures.json';

interface Case {
  route: RouteId; realm: number; lv: number; x: number; tags: EnemyTag[];
  build: { hp: number; atk: number; dfs: number; hit: number; dodge: number };
  enemy: { hp: number; atk: number; dfs: number; hit: number; dodge: number };
  defK: number;
  expect: { win: boolean; rounds: number; hpPct: number };
}

describe('golden 对照 · 长线战斗 vs longline_sim.py', () => {
  for (const c of fixtures.cases as Case[]) {
    it(`${c.route} 境界${c.realm} ${c.lv} 级 vs 当量 ${c.x}${c.tags.length ? ` [${c.tags.join('/')}]` : ''}`, () => {
      const b = makeBuild(c.route, c.realm, c.lv, 3);
      expect(b.hp).toBeCloseTo(c.build.hp, 6);
      expect(b.atk).toBeCloseTo(c.build.atk, 6);
      expect(b.def).toBeCloseTo(c.build.dfs, 6);
      expect(b.hit).toBeCloseTo(c.build.hit, 9);
      expect(b.dodge).toBeCloseTo(c.build.dodge, 9);

      const st = enemyStatsAt(c.x, c.tags);
      expect(st.hp).toBeCloseTo(c.enemy.hp, 6);
      expect(st.atk).toBeCloseTo(c.enemy.atk, 6);
      expect(st.def).toBeCloseTo(c.enemy.dfs, 6);
      expect(st.hit).toBeCloseTo(c.enemy.hit, 9);
      expect(st.dodge).toBeCloseTo(c.enemy.dodge, 9);
      expect(st.defK).toBeCloseTo(c.defK, 6);

      const enemy: EnemyDef = {
        map: 1, tier: 0, stage: 1, name: 'golden', kind: 'normal', recommendedRealm: 1,
        reward: { neili: 0, silver: 0, xp: 0 }, tags: [...c.tags], ...st,
      };
      const r = fight(b, enemy, { mode: 'ev' });
      expect(r.win).toBe(c.expect.win);
      expect(r.rounds).toBe(c.expect.rounds);
      expect(r.playerHpPct).toBeCloseTo(c.expect.hpPct, 6);
    });
  }
});
