/** MVP-2 finalized, non-playable value integration — docs/mvp2/content.md §8.1/§8.2/§9.1. */
import type { EnemyTag } from './enemies';

export interface Mvp2RealmValue {
  readonly realm: 6 | 7;
  readonly name: '[待命名]';
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly breakthroughCost: number;
  readonly skillCap: 10;
}

export const MVP2_REALM_VALUES = [
  { realm: 6, name: '[待命名]', hp: 1680, atk: 168, def: 88, accuracy: 160, evasion: 25, breakthroughCost: 48000, skillCap: 10 },
  { realm: 7, name: '[待命名]', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, breakthroughCost: 108000, skillCap: 10 },
] as const satisfies readonly Mvp2RealmValue[];

export interface Mvp2BossValue {
  readonly boss: 4 | 5;
  readonly name: '[待命名]';
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly hit: number;
  readonly dodge: number;
  readonly tags: readonly EnemyTag[];
}

export const MVP2_BOSS_VALUES = [
  { boss: 4, name: '[待命名]', hp: 3024, atk: 470, def: 422, hit: 160, dodge: 25, tags: ['高防', '高攻'] },
  { boss: 5, name: '[待命名]', hp: 5376, atk: 504, def: 722, hit: 172, dodge: 28, tags: ['高攻', '净化', '高防'] },
] as const satisfies readonly Mvp2BossValue[];

export interface ResourcePlan {
  readonly neili: number;
  readonly silver: number;
  readonly xp: number;
}

export interface Mvp2MapRewardPlan {
  readonly map: 4 | 5;
  readonly name: '[待命名]';
  readonly stageCount: 10;
  readonly bossStage: 10;
  readonly eliteStages: readonly number[];
  readonly normal: ResourcePlan;
  readonly elite: ResourcePlan;
  readonly preBossTotal: ResourcePlan;
  readonly preparationRatio: 0.14;
}

export const MVP2_MAP_REWARD_PLANS = [
  {
    map: 4, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [3, 6, 8],
    normal: { neili: 594, silver: 17, xp: 3 },
    elite: { neili: 1190, silver: 33, xp: 8 },
    preBossTotal: { neili: 7134, silver: 201, xp: 42 }, preparationRatio: 0.14,
  },
  {
    map: 5, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [2, 5, 7, 9],
    normal: { neili: 1206, silver: 16, xp: 4 },
    elite: { neili: 2417, silver: 30, xp: 5 },
    preBossTotal: { neili: 15698, silver: 200, xp: 40 }, preparationRatio: 0.14,
  },
] as const satisfies readonly Mvp2MapRewardPlan[];

export function calculatePreBossTotal(plan: Mvp2MapRewardPlan): ResourcePlan {
  const playableBeforeBoss = plan.bossStage - 1;
  const eliteCount = plan.eliteStages.length;
  const normalCount = playableBeforeBoss - eliteCount;
  return {
    neili: normalCount * plan.normal.neili + eliteCount * plan.elite.neili,
    silver: normalCount * plan.normal.silver + eliteCount * plan.elite.silver,
    xp: normalCount * plan.normal.xp + eliteCount * plan.elite.xp,
  };
}
