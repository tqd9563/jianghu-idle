/**
 * 内容数据 —— 权威来源：docs/rules/content.md §1（境界 1-7）
 * 只搬运定稿数值，禁止在此调参；改数值先改内容表并重跑 sim 校验。
 */

export interface RealmDef {
  realm: number;
  name: string;
  hp: number;
  atk: number;
  def: number;
  accuracy: number;
  evasion: number;
  /**
   * 离开本境界要缴清的内力总额（content.md §1 v2.1「离开本境界」行口径）：
   * 境界 X 这一行 = 从 X 突破到 X+1 分 N 段周天缴清的总额。null = 本版不可再突破（境界 6/7）。
   * 总额已扣除武学两成与冲穴开销（pacing_sim.py 表一）。
   */
  leaveCost: number | null;
  /** 离开本境界要缴的周天段数 N（zhoutian/design.md §3.1，与 leaveCost 同一行口径）；null = 无周天 */
  zhoutianCount: number | null;
  /** 本境界窍穴池大小（zhoutian/design.md §3.2）；null = 无窍穴池 */
  acupointPoolSize: number | null;
}

/** 境界表（content.md §1 v2.2）。基础暴击率 5%、暴击伤害 150% 全境界一致 */
export const REALMS: RealmDef[] = [
  { realm: 1, name: '江湖新丁', hp: 100, atk: 10, def: 5,  accuracy: 100, evasion: 10, leaveCost: 349_000,    zhoutianCount: 4, acupointPoolSize: 3 },
  { realm: 2, name: '初窥门径', hp: 170, atk: 17, def: 9,  accuracy: 112, evasion: 13, leaveCost: 2_700_000,  zhoutianCount: 3, acupointPoolSize: 4 },
  { realm: 3, name: '小有所成', hp: 290, atk: 29, def: 15, accuracy: 124, evasion: 16, leaveCost: 6_930_000,  zhoutianCount: 4, acupointPoolSize: 5 },
  { realm: 4, name: '炉火纯青', hp: 495, atk: 49, def: 26, accuracy: 136, evasion: 19, leaveCost: 17_900_000, zhoutianCount: 6, acupointPoolSize: 6 },
  { realm: 5, name: '一流高手', hp: 840, atk: 84, def: 44, accuracy: 148, evasion: 22, leaveCost: 37_000_000, zhoutianCount: 8, acupointPoolSize: 8 },
  // MVP-2A §8.1：从 Realm 5 冻结值逐境界对 HP/ATK/DEF 乘 2.0；HIT/DODGE +12/+3；技能上限固定 10
  // 本版终点 = 突破入境界 6（pacing/design.md §4）：境界 6 可达不可再突破，境界 7 封存
  { realm: 6, name: '一代宗师', hp: 1680, atk: 168, def: 88,  accuracy: 160, evasion: 25, leaveCost: null, zhoutianCount: null, acupointPoolSize: null },
  { realm: 7, name: '登峰造极', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, leaveCost: null, zhoutianCount: null, acupointPoolSize: null },
];

export const BASE_CRIT_RATE = 0.05;
export const BASE_CRIT_DMG = 1.5;

/**
 * 门径武学（formulas.md §3.4 v1.6，门派重做前的临时替身）：
 * 前 SHICHENG 级是「招式」，沿用各路线逐级效果；练满即「十成」。之后每级是「火候」，
 * 三路线相同，每 HUOHOU_PER_REALM 级折合一个境界。等级不设上限，只受内力约束。
 */
export const SHICHENG = 10;
export const HUOHOU_PER_REALM = 20;

/** 第 level 级的内力价 = 3,490 × 1.08^(level−1)，绝对计价、与境界无关；四舍五入到整数 */
export function skillUpgradeCost(level: number): number {
  return Math.round(3490 * Math.pow(1.08, level - 1));
}

/** 招式等级（生效于各路线逐级效果）：封顶十成 */
export const zhaoshiLevel = (level: number) => Math.min(level, SHICHENG);

/** 火候折合的境界数：十成以上每 20 级折合 1 个境界 */
export const huohouRealms = (level: number) => Math.max(0, level - SHICHENG) / HUOHOU_PER_REALM;

/** 火候对属性的作用（与境界曲线同形）：气血/攻击/防御 × 1.7^dx，命中 +12dx，闪避 +3dx */
export function huohouEffect(level: number): { statMult: number; hit: number; dodge: number } {
  const dx = huohouRealms(level);
  return { statMult: Math.pow(1.7, dx), hit: 12 * dx, dodge: 3 * dx };
}

export type RouteId = 'huashan' | 'shaolin' | 'tangmen';

/** 换路线银两摩擦成本（内容表 §4；银两唯一核心 sink，阅历 100% 返还见规格书 §6.4） */
export const ROUTE_SWITCH_SILVER = 200;

// TODO(内容表 §2)：三地图 28 关敌人表 —— 实现战斗模块时搬运
// TODO(内容表 §3)：三路线赠予参数与机制节点表
// TODO(声望经济表)：8 节点定稿与里程碑声望
