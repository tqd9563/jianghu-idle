/**
 * 伤害浮动（formulas.md §1.3 v1.8）：RNG 模式每次出手在 ±10% 内浮动，EV 模式不浮动（golden 对齐不受影响）。
 */
import { describe, expect, it } from 'vitest';
import { DMG_SPREAD, fight, makeBuild } from './combat';
import { getStage } from './enemies';
import { mitigationMultiplier } from './formulas';

describe('伤害浮动', () => {
  const build = makeBuild('shaolin', 2, 0, 0);
  const enemy = getStage(1, 0, 7);

  it('RNG 模式：普攻伤害有高有低，且都落在基准 ±10% 内', () => {
    const base = build.atk * mitigationMultiplier(enemy.def, enemy.defK);
    const dmgs: number[] = [];
    for (let i = 0; i < 50; i++) {
      for (const t of fight(build, enemy, { mode: 'rng' }).turns) {
        if (t.side === 'player' && t.kind === 'attack') dmgs.push(t.dmg!);
      }
    }
    expect(new Set(dmgs).size).toBeGreaterThan(5);
    // 战报取一位小数，留 0.05 余量
    for (const d of dmgs) {
      expect(d).toBeGreaterThanOrEqual(base * (1 - DMG_SPREAD) - 0.05);
      expect(d).toBeLessThanOrEqual(base * (1 + DMG_SPREAD) + 0.05);
    }
  });

  it('EV 模式不浮动：两次结果逐数一致', () => {
    expect(fight(build, enemy, { mode: 'ev' })).toEqual(fight(build, enemy, { mode: 'ev' }));
  });
});
