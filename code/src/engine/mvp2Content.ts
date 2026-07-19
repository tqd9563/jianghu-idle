/** MVP-2 finalized, non-playable value integration — docs/mvp2/content.md §8.1/§8.2/§9.1/§9.2/§9.4. */
import type { EnemyTag } from './enemies';
import { pyRound } from './enemies';
import type { RouteId } from './content';

export interface Mvp2RealmValue {
  readonly realm: 6 | 7;
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly breakthroughCost: number;
  readonly skillCap: 10;
}

export const MVP2_REALM_VALUES = [
  { realm: 6, name: '一代宗师', hp: 1680, atk: 168, def: 88, accuracy: 160, evasion: 25, breakthroughCost: 48000, skillCap: 10 },
  { realm: 7, name: '登峰造极', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, breakthroughCost: 108000, skillCap: 10 },
] as const satisfies readonly Mvp2RealmValue[];

export interface Mvp2BossValue {
  readonly boss: 4 | 5;
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly hit: number;
  readonly dodge: number;
  readonly tags: readonly EnemyTag[];
}

export const MVP2_BOSS_VALUES = [
  { boss: 4, name: '镇关都督', hp: 3024, atk: 470, def: 422, hit: 160, dodge: 25, tags: ['高防', '高攻'] },
  { boss: 5, name: '无相居士', hp: 5376, atk: 504, def: 722, hit: 172, dodge: 28, tags: ['高攻', '净化', '高防'] },
] as const satisfies readonly Mvp2BossValue[];

export interface Mvp2TrialEnemy {
  readonly id: 'trial_jinglei' | 'trial_zhenyue' | 'trial_shigu';
  readonly name: string;
  readonly route: RouteId;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly hit: number;
  readonly dodge: number;
  readonly tags: readonly EnemyTag[];
  readonly recommendedRealm: 5;
}

export const MVP2_TRIAL_ENEMIES = [
  { id: 'trial_jinglei', name: '雷隐散人', route: 'huashan', hp: 2352, atk: 4, def: 211, hit: 148, dodge: 50, tags: ['高闪', '反伤'], recommendedRealm: 5 },
  { id: 'trial_zhenyue', name: '岳镇居士', route: 'shaolin', hp: 1596, atk: 34, def: 216, hit: 148, dodge: 22, tags: ['毒', '破甲'], recommendedRealm: 5 },
  { id: 'trial_shigu', name: '蚀骨叟', route: 'tangmen', hp: 840, atk: 101, def: 167, hit: 148, dodge: 22, tags: ['净化', '高攻'], recommendedRealm: 5 },
] as const satisfies readonly Mvp2TrialEnemy[];

export const MVP2_BOSS_REWARDS = [
  { boss: 4, neili: 3057, silver: 300, xp: 120 },
  { boss: 5, neili: 6728, silver: 400, xp: 168 },
] as const;

/** Elite challenge node rewards — docs/mvp2/content.md §5 / §9.3 derivation. */
export interface Mvp2EliteChallengeReward {
  readonly challenge: 4 | 5;
  readonly neili: number;
  readonly silver: number;
  readonly xp: number;
}

export const MVP2_ELITE_CHALLENGE_REWARDS = [
  {
    challenge: 4,
    neili: 1529,   // ROUND_HALF_UP(0.30×3566/0.70), pre-challenge = stages 1-5 cumulative
    silver: 150,   // half of Boss 4 silver
    xp: 60,        // half of Boss 4 xp
  },
  {
    challenge: 5,
    neili: 4139,   // ROUND_HALF_UP(0.30×9658/0.70), pre-challenge = stages 1-5 cumulative
    silver: 200,   // half of Boss 5 silver
    xp: 84,        // half of Boss 5 xp
  },
] as const satisfies readonly Mvp2EliteChallengeReward[];

export interface ResourcePlan {
  readonly neili: number;
  readonly silver: number;
  readonly xp: number;
}

export interface Mvp2MapRewardPlan {
  readonly map: 4 | 5;
  readonly name: string;
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
    map: 4, name: '蜀道险关', stageCount: 10, bossStage: 10, eliteStages: [3, 6, 8],
    normal: { neili: 594, silver: 17, xp: 3 },
    elite: { neili: 1190, silver: 33, xp: 8 },
    preBossTotal: { neili: 7134, silver: 201, xp: 42 }, preparationRatio: 0.14,
  },
  {
    map: 5, name: '铁壁绝谷', stageCount: 10, bossStage: 10, eliteStages: [2, 5, 7, 9],
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

export interface Mvp2StageEnemy {
  readonly map: 4 | 5;
  readonly stage: number;
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly hit: number;
  readonly dodge: number;
  readonly tags: readonly EnemyTag[];
  readonly kind: 'normal' | 'elite';
  readonly recommendedRealm: number;
}

interface Mvp2CurveParams {
  hpBase: number;
  hpGrowth: number;
  atkBase: number;
  atkGrowth: number;
  defBase: number;
  defGrowth: number;
  hitBase: number;
  dodge: number;
}

const MAP4_CURVE: Mvp2CurveParams = { hpBase: 300, hpGrowth: 1.16, atkBase: 50, atkGrowth: 1.05, defBase: 40, defGrowth: 1.08, hitBase: 150, dodge: 20 };
const MAP5_CURVE: Mvp2CurveParams = { hpBase: 800, hpGrowth: 1.14, atkBase: 100, atkGrowth: 1.04, defBase: 80, defGrowth: 1.06, hitBase: 165, dodge: 25 };

const MAP4_NAMES = ['蜀道游匪', '飞檐夜盗', '五毒教徒', '落草刀客', '铁壁甲士', '毒蛊婆', '蜀道游匪', '五毒长老', '铁壁甲士'];
const MAP5_NAMES = ['绝谷游魂', '铁布衫客', '净心武者', '狂刀客', '金钟罩僧', '绝谷游魂', '铁布衫客', '狂刀客', '金钟罩僧'];

const MAP4_LAYOUT: readonly { stage: number; kind: 'normal' | 'elite'; tags: readonly EnemyTag[] }[] = [
  { stage: 1, kind: 'normal', tags: [] },
  { stage: 2, kind: 'normal', tags: ['高闪'] },
  { stage: 3, kind: 'elite', tags: ['毒'] },
  { stage: 4, kind: 'normal', tags: [] },
  { stage: 5, kind: 'normal', tags: ['高防'] },
  { stage: 6, kind: 'elite', tags: ['毒'] },
  { stage: 7, kind: 'normal', tags: [] },
  { stage: 8, kind: 'elite', tags: ['毒'] },
  { stage: 9, kind: 'normal', tags: ['高防'] },
];

const MAP5_LAYOUT: readonly { stage: number; kind: 'normal' | 'elite'; tags: readonly EnemyTag[] }[] = [
  { stage: 1, kind: 'normal', tags: [] },
  { stage: 2, kind: 'elite', tags: ['反伤'] },
  { stage: 3, kind: 'normal', tags: ['净化'] },
  { stage: 4, kind: 'normal', tags: ['高攻'] },
  { stage: 5, kind: 'elite', tags: ['反伤'] },
  { stage: 6, kind: 'normal', tags: [] },
  { stage: 7, kind: 'elite', tags: ['反伤'] },
  { stage: 8, kind: 'normal', tags: ['高攻'] },
  { stage: 9, kind: 'elite', tags: ['反伤'] },
];

function buildMvp2StageEnemy(
  map: 4 | 5,
  entry: { stage: number; kind: 'normal' | 'elite'; tags: readonly EnemyTag[] },
  curve: Mvp2CurveParams,
  recommendedRealm: number,
): Mvp2StageEnemy {
  const i = entry.stage;
  let hp = pyRound(curve.hpBase * curve.hpGrowth ** (i - 1));
  let atk = pyRound(curve.atkBase * curve.atkGrowth ** (i - 1), 1);
  let def = pyRound(curve.defBase * curve.defGrowth ** (i - 1), 1);
  let dodge = curve.dodge;
  const hit = curve.hitBase + 2 * i;
  const tags = entry.tags;

  if (entry.kind === 'elite') {
    hp = pyRound(hp * (tags.includes('毒' as EnemyTag) ? 1.3 : 1.4));
  }
  for (const tag of tags) {
    if (tag === '高闪') dodge = 50;
    if (tag === '高防') def = pyRound(def * 1.5);
    if (tag === '高攻') atk = pyRound(atk * 1.3, 1);
  }

  return { map, stage: i, name: map === 4 ? MAP4_NAMES[entry.stage - 1] : MAP5_NAMES[entry.stage - 1], hp, atk, def, hit, dodge, tags, kind: entry.kind, recommendedRealm };
}

export function buildMvp2StageEnemies(): readonly Mvp2StageEnemy[] {
  const out: Mvp2StageEnemy[] = [];
  for (const entry of MAP4_LAYOUT) {
    out.push(buildMvp2StageEnemy(4, entry, MAP4_CURVE, 5));
  }
  for (const entry of MAP5_LAYOUT) {
    out.push(buildMvp2StageEnemy(5, entry, MAP5_CURVE, 6));
  }
  return out;
}

export const MVP2_STAGE_ENEMIES: readonly Mvp2StageEnemy[] = buildMvp2StageEnemies();

/**
 * 精英挑战节点 + 敌人属性 —— docs/mvp2/content.md §5 / §6 / §5.2 v0.9。
 * 数值由 sim/elite_challenge_search.py 调用 combat_tuning.fight() 机械搜索（单解法约束：基线败 + 武学+1胜），
 * 首个满足项即唯一 tie-break。HIT/DODGE 沿用推荐境界冻结值；标签仅取 enemies.ts 既有白名单。
 */
export interface Mvp2EliteChallengeEnemy {
  readonly id: 'elite_challenge_04_candidate' | 'elite_challenge_05_candidate';
  readonly challenge: 4 | 5;
  readonly map: 4 | 5;
  /** 解锁位置：所属地图 stage 5 之后、stage 6 之前（§5.1 v0.7 pre_challenge_neili 推导） */
  readonly unlockAfterStage: 5;
  /** 名字待文案冻结批次定名（§5.2 v0.9 数值已定，名字独立走文案批次） */
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly hit: number;
  readonly dodge: number;
  readonly tags: readonly EnemyTag[];
  readonly recommendedRealm: number;
  /** 首通奖励指针（§5.1 v0.7 已冻结，引用 MVP2_ELITE_CHALLENGE_REWARDS） */
  readonly rewardRef: 4 | 5;
}

export const MVP2_ELITE_CHALLENGE_ENEMIES = [
  {
    id: 'elite_challenge_04_candidate',
    challenge: 4,
    map: 4,
    unlockAfterStage: 5,
    name: '待文案冻结',
    hp: 1428,
    atk: 244,
    def: 216,
    hit: 148,
    dodge: 22,
    tags: ['反伤'],
    recommendedRealm: 5,
    rewardRef: 4,
  },
  {
    id: 'elite_challenge_05_candidate',
    challenge: 5,
    map: 5,
    unlockAfterStage: 5,
    name: '待文案冻结',
    hp: 3024,
    atk: 143,
    def: 431,
    hit: 160,
    dodge: 25,
    tags: ['净化', '高攻'],
    recommendedRealm: 6,
    rewardRef: 5,
  },
] as const satisfies readonly Mvp2EliteChallengeEnemy[];
