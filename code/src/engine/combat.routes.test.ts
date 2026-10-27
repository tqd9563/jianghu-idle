/**
 * 武道源流新四路（wudao-yuanliu/design.md §2）：机制确实生效、旧三路不受影响。
 * 数值对拍见 telemetry/routeBalance.sim.test.ts。
 */
import { describe, expect, it } from 'vitest';
import { NO_NEW, fight, makeBuild, type TurnEvent } from './combat';
import type { RouteId } from './content';
import { enemyStatsAt, type EnemyDef, type EnemyTag } from './enemies';

const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };
const enemy = (x: number, tags: EnemyTag[] = []): EnemyDef =>
  ({ map: 1, stage: 1, name: '对手', ...enemyStatsAt(x, tags), tags, kind: 'normal', recommendedRealm: 1, reward: { neili: 0, silver: 0, xp: 0 }, x }) as EnemyDef;

/** 一路打 n 场，收集出现过的事件种类 */
function kinds(route: RouteId, nodes: number, x: number, tags: EnemyTag[] = [], n = 60): Set<TurnEvent['kind']> {
  const b = makeBuild(route, 3, 40, nodes);
  const rng = lcg(7);
  const out = new Set<TurnEvent['kind']>();
  for (let i = 0; i < n; i++) for (const t of fight(b, enemy(x, tags), { mode: 'rng', rng }).turns) out.add(t.kind);
  return out;
}

describe('武道源流新四路', () => {
  it('旧三路的新字段一律为零值，结算不变', () => {
    for (const r of ['huashan', 'shaolin', 'tangmen'] as RouteId[]) {
      const b = makeBuild(r, 3, 40, 3);
      for (const [k, v] of Object.entries(NO_NEW)) expect(b[k as keyof typeof b], `${r}.${k}`).toBe(v);
    }
  });

  it('太虚：闪避高于他路；闪过即反手（入室起）', () => {
    expect(makeBuild('taixu', 3, 40, 0).dodge).toBeGreaterThan(makeBuild('huashan', 3, 40, 0).dodge * 2);
    expect(kinds('taixu', 2, 3.5).has('counter')).toBe(true);
    expect(kinds('taixu', 1, 3.5).has('counter')).toBe(false);
  });

  it('玄寂：积满寂印封穴；净化会清掉寂印', () => {
    const k = kinds('xuanji', 0, 7.5);
    expect(k.has('seal')).toBe(true);
    expect(k.has('sealed')).toBe(true);
    // 寂印要 4 枚，净化每 3 回合清一次：开局前三回合不可能封穴
    const b = makeBuild('xuanji', 3, 40, 0);
    const turns = fight(b, enemy(7.5, ['净化']), { mode: 'rng', rng: lcg(3) }).turns;
    expect(turns.filter((t) => t.kind === 'seal' && t.rd <= 3)).toHaveLength(0);
  });

  it('惊鸿：开战首回合必追加一击；落空即断', () => {
    const b = makeBuild('jinghong', 3, 40, 2);
    const turns = fight(b, enemy(3.5), { mode: 'rng', rng: lcg(11) }).turns;
    expect(turns.some((t) => t.rd === 1 && t.kind === 'combo')).toBe(true);
    // 同一回合里，一次落空之后不再有追加
    for (let rd = 1; rd <= 50; rd++) {
      const combos = turns.filter((t) => t.rd === rd && t.kind === 'combo');
      const miss = combos.findIndex((t) => t.missed);
      if (miss >= 0) expect(miss).toBe(combos.length - 1);
    }
  });

  it('焚血：残血攻击更高；入室起濒死撑住一次', () => {
    expect(kinds('fenxue', 2, 8).has('undying')).toBe(true);
    expect(kinds('fenxue', 1, 8).has('undying')).toBe(false);
  });

  it('追加句标记：太虚借力、玄寂一轮头一枚寂印、焚血残血饮血（至多三回合一次）', () => {
    const flags = (route: RouteId, nodes: number, x: number) => {
      const b = makeBuild(route, 3, 40, nodes);
      const rng = lcg(5);
      const ts: TurnEvent[] = [];
      for (let i = 0; i < 40; i++) ts.push(...fight(b, enemy(x), { mode: 'rng', rng }).turns);
      return ts;
    };
    expect(flags('taixu', 1, 7.5).some((t) => t.jieli)).toBe(true);
    expect(flags('xuanji', 0, 7.5).some((t) => t.mark)).toBe(true);
    const fx = flags('fenxue', 2, 8);
    expect(fx.some((t) => t.leech)).toBe(true);
    // 旧三路不带这些标记
    expect(flags('huashan', 3, 7.5).some((t) => t.jieli || t.mark || t.leech)).toBe(false);
  });

  it('EV 模式（失败诊断）对新四路也能算完', () => {
    for (const r of ['taixu', 'xuanji', 'jinghong', 'fenxue'] as RouteId[]) {
      const res = fight(makeBuild(r, 3, 40, 3), enemy(3), { mode: 'ev' });
      expect(res.rounds).toBeGreaterThan(0);
    }
  });
});
