/**
 * 内容数据 —— 权威来源：docs/mvp0/content.md v1.1（MVP-0 §1 境界 1-5）
 * + docs/mvp2/content.md §8.1（MVP-2A 境界 6-7）。
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
  /** 突破到本境界的内力消耗（境界 1 为起点，无消耗） */
  breakthroughCost: number | null;
  /** 武学等级上限 = 境界 × 2（规格书 §6.4）；境界 6/7 上限固定 10，不开放 lv11 */
  skillCap: number;
}

/** 境界表（内容表 §1 + MVP-2 内容表 §8.1）。基础暴击率 5%、暴击伤害 150% 全境界一致 */
export const REALMS: RealmDef[] = [
  { realm: 1, name: '江湖新丁', hp: 100, atk: 10, def: 5,  accuracy: 100, evasion: 10, breakthroughCost: null,   skillCap: 2 },
  { realm: 2, name: '初窥门径', hp: 170, atk: 17, def: 9,  accuracy: 112, evasion: 13, breakthroughCost: 2800,  skillCap: 4 },
  { realm: 3, name: '小有所成', hp: 290, atk: 29, def: 15, accuracy: 124, evasion: 16, breakthroughCost: 5000,  skillCap: 6 },
  { realm: 4, name: '炉火纯青', hp: 495, atk: 49, def: 26, accuracy: 136, evasion: 19, breakthroughCost: 10000, skillCap: 8 },
  { realm: 5, name: '一流高手', hp: 840, atk: 84, def: 44, accuracy: 148, evasion: 22, breakthroughCost: 21000, skillCap: 10 },
  // MVP-2A §8.1：从 Realm 5 冻结值逐境界对 HP/ATK/DEF 乘 2.0；HIT/DODGE +12/+3；技能上限固定 10
  { realm: 6, name: '一代宗师', hp: 1680, atk: 168, def: 88,  accuracy: 160, evasion: 25, breakthroughCost: 48000,  skillCap: 10 },
  { realm: 7, name: '登峰造极', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, breakthroughCost: 108000, skillCap: 10 },
];

export const BASE_CRIT_RATE = 0.05;
export const BASE_CRIT_DMG = 1.5;

/** 武学升级消耗：200 × 1.4^(等级−1)（内容表 §3.1），四舍五入到整数 */
export function skillUpgradeCost(level: number): number {
  return Math.round(200 * Math.pow(1.4, level - 1));
}

export type RouteId = 'huashan' | 'shaolin' | 'tangmen';

/** 换路线银两摩擦成本（内容表 §4；银两唯一核心 sink，阅历 100% 返还见规格书 §6.4） */
export const ROUTE_SWITCH_SILVER = 200;

// TODO(内容表 §2)：三地图 28 关敌人表 —— 实现战斗模块时搬运
// TODO(内容表 §3)：三路线赠予参数与机制节点表
// TODO(声望经济表)：8 节点定稿与里程碑声望
