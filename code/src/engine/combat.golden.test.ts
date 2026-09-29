/**
 * 战斗引擎 golden 对照（规格书 §12 实现路线图前置）：
 * fixture 由 docs/systems/sim/export_fixtures.py 从 mvp0_sim.py 导出，
 * EV 模式结果（胜负/回合数/剩余血量比）必须逐数一致。敌人直接取 fixture 里的属性——
 * 长线起关卡表改由 export_stage_table.py 生成（content.md §2.0），旧三图关卡已退役，本测试只守战斗结算。
 * 若本测试失败：先查实现是否偏离 sim，需要改规则时先改 sim 再重导 fixture。
 */
import { describe, expect, it } from 'vitest';
import type { RouteId } from './content';
import { fight, makeBuild } from './combat';
import type { EnemyDef, EnemyTag } from './enemies';
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
      const enemy: EnemyDef = {
        map: 1, tier: 0, stage: c.stage, name: `${c.map}-${c.stage}`, kind: 'normal', recommendedRealm: 1,
        hp: c.enemy.hp, atk: c.enemy.atk, def: c.enemy.dfs, hit: c.enemy.hit, dodge: c.enemy.dodge,
        tags: c.enemy.tags as EnemyTag[], reward: { neili: 0, silver: 0, xp: 0 },
      };

      const build = makeBuild(c.route, c.realm, c.lv, c.nodes);
      const r = fight(build, enemy, { mode: 'ev' });
      expect(r.win).toBe(c.expect.win);
      expect(r.rounds).toBe(c.expect.rounds);
      expect(r.playerHpPct).toBeCloseTo(c.expect.hpPct, 6);
    });
  }
});
