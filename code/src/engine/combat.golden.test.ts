/**
 * 战斗引擎 golden 对照（规格书 §12 实现路线图前置）：
 * fixture 由 docs/mvp0/sim/export_fixtures.py 从 mvp0_sim.py 导出，
 * EV 模式结果（胜负/回合数/剩余血量比）与敌人生成属性必须逐数一致。
 * 若本测试失败：先查实现是否偏离 sim，需要改规则时先改 sim 再重导 fixture。
 */
import { describe, expect, it } from 'vitest';
import type { RouteId } from './content';
import { fight, makeBuild } from './combat';
import { getStage } from './enemies';
import fixtures from './golden/ev-fixtures.json';

interface Case {
  route: RouteId; realm: number; lv: number; nodes: number;
  map: string; stage: number;
  enemy: { hp: number; atk: number; dfs: number; hit: number; dodge: number; tags: string[] };
  expect: { win: boolean; rounds: number; hpPct: number };
}

describe('golden 对照 · EV 战斗 vs mvp0_sim.py', () => {
  for (const c of fixtures.cases as Case[]) {
    const label = `${c.route} 境界${c.realm} Lv${c.lv} 节点${c.nodes} vs ${c.map}-${c.stage}`;
    it(label, () => {
      const mapNo = Number(c.map.replace('map', '')) as 1 | 2 | 3;
      const enemy = getStage(mapNo, c.stage);

      // 敌人生成属性逐数对照（含 banker's rounding）
      expect(enemy.hp).toBe(c.enemy.hp);
      expect(enemy.atk).toBeCloseTo(c.enemy.atk, 9);
      expect(enemy.def).toBeCloseTo(c.enemy.dfs, 9);
      expect(enemy.hit).toBe(c.enemy.hit);
      expect(enemy.dodge).toBe(c.enemy.dodge);
      expect([...enemy.tags]).toEqual(c.enemy.tags);

      const build = makeBuild(c.route, c.realm, c.lv, c.nodes);
      const r = fight(build, enemy, { mode: 'ev' });
      expect(r.win).toBe(c.expect.win);
      expect(r.rounds).toBe(c.expect.rounds);
      expect(r.playerHpPct).toBeCloseTo(c.expect.hpPct, 6);
    });
  }
});
