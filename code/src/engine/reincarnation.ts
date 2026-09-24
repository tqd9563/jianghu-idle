/**
 * 转世系统纯函数引擎 —— 权威来源：docs/systems/reincarnation/spec.md v1.1
 * （设定与裁决理由见同目录 design.md v0.2）。本模块纯函数，禁止引入 UI / 存储依赖。
 *
 * 两个时钟（spec §1）：
 *   角色年岁 —— 这一世的岁数，每次转世重置为 INIT_AGE；
 *   江湖历   —— 世界纪年，跨世累进、永不回退。
 * 两者都只随游戏内时间前进，且是同一个速率：角色老一岁，江湖历走一年。
 */
import { LIFESPAN_LOSS_HEAVY } from './injury';

/** 初始年龄：每世重置，重生为少年（spec §2.2） */
export const INIT_AGE = 18;
/** 寿元上限：一世能活到的岁数（spec §3.1）；重伤折寿从这里扣 */
export const LIFESPAN_CAP = 120;
/**
 * 年岁速率：年 / 游戏内分钟（spec §2.2）。
 * 由「一世典型跨度 45 年 ÷ 典型世时长 34 分钟」反解；改它须重跑 reincarnation_sim.py V1–V5。
 */
export const AGE_YEARS_PER_MIN = 1.322;
/** 江湖历起点：第一世出生年份（spec §2.2） */
export const ERA_START = 100;
/** 魂魄未稳的产出折扣（spec §4.1）：强制转世后到首次突破为止 */
export const SOUL_WEAK_MULT = 0.6;
/**
 * 垂暮阈值：离寿元不足一次重伤的折寿量时进入垂暮——此时再挨一记重伤就是老死。
 * 与折寿量绑死而非另设常量，折寿一改，垂暮跟着变（原型 reincarnation-prototype.html §1-B）。
 */
export const DUSK_MARGIN = LIFESPAN_LOSS_HEAVY;

/** 死因：老死（年岁触顶）或战死（伤势越过致死线，或重伤折寿后年岁已超剩余寿元） */
export type DeathCause = 'old' | 'battle';

/** 本世实际寿元 = 上限 − 已折寿年数 */
export function lifespanCap(lifespanLost: number): number {
  return LIFESPAN_CAP - lifespanLost;
}

/** 经过 minutes 游戏内分钟后的年岁。在线离线同一速率（spec §2.3） */
export function ageAfter(age: number, minutes: number): number {
  return age + minutes * AGE_YEARS_PER_MIN;
}

/** 年岁是否已到寿元 */
export function isOldDeath(age: number, lifespanLost: number): boolean {
  return age >= lifespanCap(lifespanLost);
}

/** 是否垂暮：还活着，但离寿元不足一次重伤 */
export function isDusk(age: number, lifespanLost: number): boolean {
  return !isOldDeath(age, lifespanLost) && age >= lifespanCap(lifespanLost) - DUSK_MARGIN;
}

/** 当前江湖历年份 = 本世出生年 + 已活年数（spec §2.1） */
export function currentEra(eraStart: number, age: number): number {
  return eraStart + (age - INIT_AGE);
}

/**
 * 转世后的下一世时钟（spec §6）：年岁重置，江湖历从上一世谢幕的年份接着算。
 * 主动归隐与强制转世都走这里——江湖历不因死法而不同。
 */
export function nextLife(eraStart: number, ageAtEnd: number): { age: number; eraStart: number } {
  return { age: INIT_AGE, eraStart: currentEra(eraStart, ageAtEnd) };
}

/** 魂魄状态对挂机产出的乘数（spec §4.1）。布尔标记，不叠加——连续被迫转世也只挂一层 */
export function soulMult(unsettled: boolean): number {
  return unsettled ? SOUL_WEAK_MULT : 1;
}
