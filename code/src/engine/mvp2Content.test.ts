import { describe, expect, it } from 'vitest';
import { MVP2_BOSS_VALUES, MVP2_MAP_REWARD_PLANS, MVP2_REALM_VALUES, calculatePreBossTotal } from './mvp2Content';

describe('MVP-2 finalized non-playable constants', () => {
  it('matches Realm 6/7 values and keeps names unresolved', () => {
    expect(MVP2_REALM_VALUES).toEqual([
      { realm: 6, name: '[待命名]', hp: 1680, atk: 168, def: 88, accuracy: 160, evasion: 25, breakthroughCost: 48000, skillCap: 10 },
      { realm: 7, name: '[待命名]', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, breakthroughCost: 108000, skillCap: 10 },
    ]);
  });

  it('matches Boss 4/5 combat values and existing Chinese tags', () => {
    expect(MVP2_BOSS_VALUES).toEqual([
      { boss: 4, name: '[待命名]', hp: 3024, atk: 470, def: 422, hit: 160, dodge: 25, tags: ['高防', '高攻'] },
      { boss: 5, name: '[待命名]', hp: 5376, atk: 504, def: 722, hit: 172, dodge: 28, tags: ['高攻', '净化', '高防'] },
    ]);
  });

  it('matches map layouts, exact reward plans, ratios, and calculated totals', () => {
    expect(MVP2_MAP_REWARD_PLANS).toEqual([
      {
        map: 4, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [3, 6, 8],
        normal: { neili: 594, silver: 17, xp: 3 }, elite: { neili: 1190, silver: 33, xp: 8 },
        preBossTotal: { neili: 7134, silver: 201, xp: 42 }, preparationRatio: 0.14,
      },
      {
        map: 5, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [2, 5, 7, 9],
        normal: { neili: 1206, silver: 16, xp: 4 }, elite: { neili: 2417, silver: 30, xp: 5 },
        preBossTotal: { neili: 15698, silver: 200, xp: 40 }, preparationRatio: 0.14,
      },
    ]);
    for (const plan of MVP2_MAP_REWARD_PLANS) expect(calculatePreBossTotal(plan)).toEqual(plan.preBossTotal);
  });
});
