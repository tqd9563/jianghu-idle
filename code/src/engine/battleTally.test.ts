/**
 * 战况统计（battleTally.ts）：从回合事件现数的口径，与引擎 FightStats 总账逐项对拍。
 * 回合事件里的伤害按一位小数取整，伤害类只要求逐项误差在 0.05 × 事件数以内。
 */
import { describe, expect, it } from 'vitest';
import { fight, makeBuild, type CombatSkill } from './combat';
import { type EnemyDef } from './enemies';
import { rate, tallyTurns } from './battleTally';
import type { RouteId } from './content';
import { legacyStage } from './legacyStage.testutil';

const seeded = (seed: number) => {
  let x = seed;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
};
const skill = (id: string, effect: CombatSkill['forms'][number]['effect'], fx = 0.5, p = 0.35): CombatSkill => ({
  id, name: id, p, forms: [{ key: `${id}:1`, name: '第一式', mult: 1.3, effect, fx, cost: 20, cd: 1 }],
});
// 一门连击（追加普攻）、一门护体（护盾）、一门必暴
const loadout = [skill('lianji', '连击', 0.8), skill('huti', '护体', 0.15), skill('bibao', '必暴', 1)];
// 敌人挂上全部「在战斗里结算」的标签，覆盖反伤、净化、破甲、毒
const nasty = (e: EnemyDef): EnemyDef => ({ ...e, tags: ['反伤', '净化', '破甲', '毒'] });

describe('战况统计与引擎总账对拍', () => {
  const routes: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
  for (const route of routes) {
    it(`${route}：次数逐项相等，伤害逐项近似`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const r = fight(makeBuild(route, 4, 40, 3), nasty(legacyStage(2, 0, 12)), {
          mode: 'rng', rng: seeded(seed * 7 + 1), loadout, qiMax: 300,
        });
        const t = tallyTurns(r.turns);
        const st = r.stats;
        const tol = 0.05 * r.turns.length + 1e-6;

        expect(t.casts).toBe(st.casts);
        expect(t.purged).toBe(st.purgeCount);
        expect(t.mech.排山倒海?.n ?? 0).toBe(st.burstCount);
        for (const [id, n] of Object.entries(st.skillCasts)) expect(t.skills[id]?.casts).toBe(n);

        expect(Math.abs(t.out - st.dmgDealt)).toBeLessThanOrEqual(tol);
        expect(Math.abs(t.taken - st.dmgTaken)).toBeLessThanOrEqual(tol);
        expect(Math.abs(t.shield - st.shieldAbsorbed)).toBeLessThanOrEqual(tol);
        expect(Math.abs(t.thornsIn - st.thornsTaken)).toBeLessThanOrEqual(tol);
        expect(Math.abs((t.mech.排山倒海?.dmg ?? 0) - st.burstDmg)).toBeLessThanOrEqual(tol);
        expect(Math.abs((t.mech.反震?.dmg ?? 0) - st.thornsOut)).toBeLessThanOrEqual(tol);
        // 引擎把出招触发的排山倒海并进该武学伤害；战况把它单列成路数行，所以各武学只会少不会多
        for (const [id, d] of Object.entries(st.skillDmg)) expect(t.skills[id]?.dmg ?? 0).toBeLessThanOrEqual(d + tol);

        // 分项加起来就是总输出
        const parts = Object.values(t.skills).reduce((a, s) => a + s.dmg, 0)
          + Object.values(t.mech).reduce((a, m) => a + (m?.dmg ?? 0), 0) + t.plain.dmg;
        expect(Math.abs(parts - t.out)).toBeLessThan(1e-6);
        // 出手 = 出招 + 普攻 + 连击追加；命中、会心不超过分母
        expect(t.acts).toBeGreaterThanOrEqual(t.casts + t.plain.n);
        expect(t.hits).toBeLessThanOrEqual(t.acts);
        expect(t.crits).toBeLessThanOrEqual(t.hits);
        expect(t.dodges).toBeLessThanOrEqual(t.foeActs);
        expect(t.maxHit).toBeLessThanOrEqual(t.out);
      }
    });
  }

  it('逐回合揭示时只增不减（交手中逐回合刷新）', () => {
    const r = fight(makeBuild('tangmen', 4, 40, 3), nasty(legacyStage(2, 0, 12)), { mode: 'rng', rng: seeded(11), loadout, qiMax: 300 });
    let prev = tallyTurns([]);
    for (let i = 1; i <= r.turns.length; i++) {
      const cur = tallyTurns(r.turns.slice(0, i));
      expect(cur.acts).toBeGreaterThanOrEqual(prev.acts);
      expect(cur.out).toBeGreaterThanOrEqual(prev.out);
      expect(cur.taken).toBeGreaterThanOrEqual(prev.taken);
      prev = cur;
    }
  });

  it('空战报全为 0；比率分母为 0 记 0', () => {
    const t = tallyTurns([]);
    expect(t.acts + t.out + t.taken).toBe(0);
    expect(rate(0, 0)).toBe(0);
    expect(rate(1, 3)).toBe(33);
  });
});
