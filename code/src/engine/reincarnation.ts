/**
 * 转世系统纯函数引擎 —— 权威来源：docs/systems/reincarnation/spec.md v1.5
 * （设定与裁决理由见同目录 design.md v0.4；多天一世见 docs/systems/pacing/design.md §2）。
 * 本模块纯函数，禁止引入 UI / 存储依赖。
 *
 * 两个时钟（spec §1）：
 *   角色年岁 —— 这一世的岁数，每次转世重置为 INIT_AGE；
 *   江湖历   —— 世界纪年，跨世累进、永不回退。
 * 两者都只随游戏内时间前进，且是同一个速率：角色老一岁，江湖历走一年。
 */
import { LIFESPAN_LOSS_HEAVY } from './injury';

/** 初始年龄：每世重置，重生为少年（spec §2.2） */
export const INIT_AGE = 18;
/** 寿元上限：随当前境界提高（spec §3.1，pacing_sim 表三） */
export const LIFESPAN: Readonly<Record<number, number>> = { 1: 70, 2: 70, 3: 90, 4: 110, 5: 130, 6: 150, 7: 150 };
/** 各阶段（历来最高境界）一世活几天（pacing/design.md 裁决 17） */
export const LIFE_DAYS: Readonly<Record<number, number>> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 5 };
/** 寿元比整天数多留的在线时段（天）：第 L 天上线时人还在，先突破、推前沿，再归隐（spec §2.2） */
export const ONLINE_MARGIN_DAYS = 4 / 24;
/** 江湖历起点：第一世出生年份（spec §2.2） */
export const ERA_START = 100;
/** 魂魄未稳的产出折扣（spec §4.1）：战死转世后的前 SOUL_WEAK_YEARS 年 */
export const SOUL_WEAK_MULT = 0.6;
export const SOUL_WEAK_YEARS = 10;
/**
 * 垂暮阈值：离寿元不足一次重伤的折寿量时进入垂暮——此时再挨一记重伤就寿终。
 * 与折寿量绑死而非另设常量，折寿一改，垂暮跟着变（原型 reincarnation-prototype.html §1-B）。
 */
export const DUSK_MARGIN = LIFESPAN_LOSS_HEAVY;

/** 死因：寿终正寝（年岁触顶，等于自动归隐）或战死（伤势越过致死线，或重伤折寿后年岁已超剩余寿元） */
export type DeathCause = 'old' | 'battle';

/** 本世实际寿元 = 当前境界的寿元上限 − 已折寿年数 */
export function lifespanCap(realm: number, lifespanLost: number): number {
  return LIFESPAN[Math.min(Math.max(realm, 1), 7)] - lifespanLost;
}

/**
 * 年岁速率（年 / 天）：随历来最高境界分档（spec §2.2）。
 * 阶段 P 的一世活 LIFE_DAYS[P] 天、寿终于境界 P 的寿元 ⇒ (寿元 − 18) ÷ (天数 + 在线时段)。
 * 境界 6 起沿用境界 5 的速率（本版终点）。
 */
export function ageYearsPerDay(peakRealm: number): number {
  const p = Math.min(Math.max(peakRealm, 1), 5);
  return (LIFESPAN[p] - INIT_AGE) / (LIFE_DAYS[p] + ONLINE_MARGIN_DAYS);
}

/** 经过 minutes 游戏内分钟后的年岁。在线离线同一速率（spec §2.3） */
export function ageAfter(age: number, minutes: number, peakRealm: number): number {
  return age + (minutes / 1440) * ageYearsPerDay(peakRealm);
}

/** 从 age 活到 targetAge 要多少游戏内分钟（离线中寿终时截断结算用） */
export function minutesUntilAge(age: number, targetAge: number, peakRealm: number): number {
  return Math.max(0, ((targetAge - age) / ageYearsPerDay(peakRealm)) * 1440);
}

/** 年岁是否已到寿元 */
export function isOldDeath(age: number, realm: number, lifespanLost: number): boolean {
  return age >= lifespanCap(realm, lifespanLost);
}

/** 是否垂暮：还活着，但离寿元不足一次重伤 */
export function isDusk(age: number, realm: number, lifespanLost: number): boolean {
  return !isOldDeath(age, realm, lifespanLost) && age >= lifespanCap(realm, lifespanLost) - DUSK_MARGIN;
}

/** 剩余寿元是否还够再活一天：够则归隐确认框写出寿元提示（retire.md §3） */
export function outlivesADay(age: number, realm: number, lifespanLost: number, peakRealm: number): boolean {
  return lifespanCap(realm, lifespanLost) - age >= ageYearsPerDay(peakRealm);
}

/** 当前江湖历年份 = 本世出生年 + 已活年数（spec §2.1） */
export function currentEra(eraStart: number, age: number): number {
  return eraStart + (age - INIT_AGE);
}

/**
 * 转世后的下一世时钟（spec §6）：年岁重置，江湖历从上一世谢幕的年份接着算。
 * 归隐、寿终与战死都走这里——江湖历不因死法而不同。
 */
export function nextLife(eraStart: number, ageAtEnd: number): { age: number; eraStart: number } {
  return { age: INIT_AGE, eraStart: currentEra(eraStart, ageAtEnd) };
}

/** 魂魄状态对挂机产出的乘数（spec §4.1）。布尔标记，不叠加——连续战死也只挂一层 */
export function soulMult(unsettled: boolean): number {
  return unsettled ? SOUL_WEAK_MULT : 1;
}

/** 魂魄未稳是否已到解除年岁：转世后前 10 年 */
export function soulSettles(age: number): boolean {
  return age >= INIT_AGE + SOUL_WEAK_YEARS;
}
