/**
 * 武学接入战斗（sect-neigong/spec.md §2.5 / §2.6）：冷却 → 真气 → 随机；EV 模式只算普攻。
 */
import { describe, expect, it } from 'vitest';
import { fight, makeBuild, type CombatSkill } from './combat';
import { getStage } from './enemies';

const seeded = (seed: number) => {
  let x = seed;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
};
const skill = (id: string, effect: CombatSkill['forms'][number]['effect'], cost = 25, cd = 2, mult = 1.3): CombatSkill => ({
  id, name: id, cost, cd, forms: [{ key: `${id}:1`, name: '第一式', mult, effect }],
});

describe('武学出招', () => {
  const enemy = getStage(2, 0, 10);
  const build = makeBuild('shaolin', 4, 40, 3);

  it('EV 模式忽略武学：结果与不装一致', () => {
    const a = fight(build, enemy, { mode: 'ev' });
    const b = fight(build, enemy, { mode: 'ev', loadout: [skill('a', null)], qiMax: 200 });
    expect(b).toEqual(a);
  });

  it('不装武学时实战结果与原引擎逐项一致（不多耗随机数）', () => {
    const a = fight(build, enemy, { mode: 'rng', rng: seeded(3) });
    const b = fight(build, enemy, { mode: 'rng', rng: seeded(3), loadout: [], qiMax: 200 });
    expect(b).toEqual(a);
  });

  it('装了会出招：出招事件、按武学与按招式计数；冷却期内同一门不连发', () => {
    const r = fight(build, getStage(3, 0, 20), { mode: 'rng', rng: seeded(5), loadout: [skill('a', null, 25, 2)], qiMax: 300 });
    const casts = r.turns.filter((t) => t.kind === 'cast');
    expect(casts.length).toBeGreaterThan(0);
    expect(r.stats.casts).toBe(casts.length);
    expect(r.stats.skillCasts.a).toBe(casts.length);
    expect(r.stats.formCasts['a:1']).toBe(casts.length);
    const rds = casts.map((t) => t.rd);
    for (let i = 1; i < rds.length; i++) expect(rds[i] - rds[i - 1]).toBeGreaterThanOrEqual(3);
  });

  it('真气不够就不出招；「回气」式不耗气', () => {
    const none = fight(build, enemy, { mode: 'rng', rng: seeded(9), loadout: [skill('a', null, 500)], qiMax: 100 });
    expect(none.stats.casts).toBe(0);
    const free = fight(build, getStage(3, 0, 20), { mode: 'rng', rng: seeded(9), loadout: [skill('b', '回气', 500)], qiMax: 500 });
    expect(free.stats.casts).toBeGreaterThan(1);
  });

  it('附毒让非蚀骨也能挂毒（不毒爆）；引爆清空毒层', () => {
    const hs = makeBuild('huashan', 4, 40, 3);
    const r = fight(hs, getStage(3, 0, 20), { mode: 'rng', rng: seeded(11), loadout: [skill('p', '附毒')], qiMax: 300 });
    expect(r.stats.poisonDmg).toBeGreaterThan(0);
    expect(r.stats.poisonBurstCount).toBe(0);
    const tm = makeBuild('tangmen', 4, 40, 3);
    const d = fight(tm, getStage(3, 0, 20), { mode: 'rng', rng: seeded(11), loadout: [skill('x', '引爆', 25, 1)], qiMax: 300 });
    expect(d.turns.some((t) => t.kind === 'cast' && t.text.includes('引爆毒层'))).toBe(true);
  });
});
