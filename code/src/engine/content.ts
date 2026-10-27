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

/**
 * 展示尺度（content.md §1 v2.3）：气血 / 攻击 / 防御一律是 sim（Python）数值的 10 倍，命中 / 闪避不放大。
 * 敌人底数、防御常数 K、装备底数同乘，所以胜率与节奏和 sim 完全一致；golden 对照按此倍数换算 fixture。
 */
export const STAT_SCALE = 10;

/**
 * 真气展示尺度（battle-loot/design.md 裁决 48）：真气上限、每回合回气、各式耗气、回元、蕴气词条一律是 sim 数值的 10 倍。
 * 都先按 sim 尺度取整再乘倍数，所以出招序列与胜负和改尺度前逐项一致；百分比类（底蕴真气、回气返还比例）不动。
 */
export const QI_SCALE = 10;

/** 境界表（content.md §1 v2.3，已含 STAT_SCALE）。基础暴击率 5%、暴击伤害 150% 全境界一致 */
export const REALMS: RealmDef[] = [
  { realm: 1, name: '江湖新丁', hp: 1000, atk: 100, def: 50,  accuracy: 100, evasion: 10, leaveCost: 87_100,     zhoutianCount: 4, acupointPoolSize: 3 },
  { realm: 2, name: '初窥门径', hp: 1700, atk: 170, def: 90,  accuracy: 112, evasion: 13, leaveCost: 3_360_000,  zhoutianCount: 3, acupointPoolSize: 4 },
  { realm: 3, name: '小有所成', hp: 2900, atk: 290, def: 150, accuracy: 124, evasion: 16, leaveCost: 12_400_000, zhoutianCount: 4, acupointPoolSize: 5 },
  { realm: 4, name: '炉火纯青', hp: 4950, atk: 490, def: 260, accuracy: 136, evasion: 19, leaveCost: 75_200_000, zhoutianCount: 6, acupointPoolSize: 6 },
  { realm: 5, name: '一流高手', hp: 8400, atk: 840, def: 440, accuracy: 148, evasion: 22, leaveCost: 280_000_000, zhoutianCount: 8, acupointPoolSize: 8 },
  // MVP-2A §8.1：从 Realm 5 冻结值逐境界对 HP/ATK/DEF 乘 2.0；HIT/DODGE +12/+3；技能上限固定 10
  // 本版终点 = 突破入境界 6（pacing/design.md §4）：境界 6 可达不可再突破，境界 7 封存
  { realm: 6, name: '一代宗师', hp: 16800, atk: 1680, def: 880,  accuracy: 160, evasion: 25, leaveCost: null, zhoutianCount: null, acupointPoolSize: null },
  { realm: 7, name: '登峰造极', hp: 33600, atk: 3360, def: 1760, accuracy: 172, evasion: 28, leaveCost: null, zhoutianCount: null, acupointPoolSize: null },
];

export const BASE_CRIT_RATE = 0.05;
export const BASE_CRIT_DMG = 1.5;

/**
 * 内功重数（sect-neigong/spec.md §1.2，接替原门径武学）：
 * 第 1–SHICHENG 重沿用各路数逐重效果；之后每重是「火候」，每 HUOHOU_PER_REALM 重折合一个境界
 * （品质倍率见 neigong.ts）。重数不设上限，只受内力约束；价格见 neigong.zhongCost。
 */
export const SHICHENG = 10;
export const HUOHOU_PER_REALM = 20;

/** 生效于路数逐重效果的重数：封顶十重 */
export const zhaoshiLevel = (level: number) => Math.min(level, SHICHENG);

/** 火候折合的境界数（寻常品质）：从第 1 重起每 20 重折合 1 个境界（sect-neigong/spec.md §1.2 v1.x：不再等到十成之后） */
export const huohouRealms = (level: number) => Math.max(0, level) / HUOHOU_PER_REALM;

/** 火候对属性的作用（与境界曲线同形）：气血/攻击/防御 × 1.7^dx，命中 +12dx，闪避 +3dx */
export function huohouEffect(level: number): { statMult: number; hit: number; dodge: number } {
  const dx = huohouRealms(level);
  return { statMult: Math.pow(1.7, dx), hit: 12 * dx, dodge: 3 * dx };
}

/** 武道源流 id：旧三路沿用路线 id（狂澜 huashan / 镇岳 shaolin / 蚀骨 tangmen），新四路见 wudao-yuanliu/design.md §2 */
export type RouteId = 'huashan' | 'shaolin' | 'tangmen' | 'taixu' | 'xuanji' | 'jinghong' | 'fenxue';

// TODO(内容表 §2)：三地图 28 关敌人表 —— 实现战斗模块时搬运
// TODO(声望经济表)：8 节点定稿与里程碑声望
