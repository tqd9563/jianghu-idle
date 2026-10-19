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
const skill = (id: string, effect: CombatSkill['forms'][number]['effect'], cost = 25, cd = 2, mult = 1.3, fx = 1, p = 0.55): CombatSkill => ({
  id, name: id, p, forms: [{ key: `${id}:1`, name: '第一式', mult, effect, fx, cost, cd }],
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

  it('真气不够就不出招；「回气」式按比例返还耗气（Ⅲ 档全返）', () => {
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

  it('状态快照：持续特效挂上记 3 回合并逐回合递减；封穴在敌人落空前一直挂着', () => {
    const r = fight(build, getStage(3, 0, 20), { mode: 'rng', rng: seeded(7), loadout: [skill('m', '迷目', 25, 4, 1.3, 24, 0.75)], qiMax: 300 });
    const castAt = r.turns.findIndex((t) => t.fx === '迷目');
    expect(castAt).toBeGreaterThanOrEqual(0);
    expect(r.turns[castAt].lasting).toContainEqual(['迷目', 3, 24]);
    const left = r.turns.slice(castAt).map((t) => t.lasting.find(([k]) => k === '迷目')?.[1] ?? 0);
    expect(left.indexOf(2)).toBeGreaterThan(0);
    expect(left.indexOf(1)).toBeGreaterThan(left.indexOf(2));
    const s = fight(build, getStage(3, 0, 20), { mode: 'rng', rng: seeded(7), loadout: [skill('f', '封穴', 25, 2, 1.3, 1, 0.75)], qiMax: 300 });
    const sealAt = s.turns.findIndex((t) => t.fx === '封穴');
    expect(s.turns[sealAt].eSealed).toBe(true);
    const skip = s.turns.findIndex((t, i) => i > sealAt && t.kind === 'sealed');
    expect(s.turns[skip].eSealed).toBe(false);
  });
});
