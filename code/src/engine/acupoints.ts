/**
 * 窍穴 / 经脉 / 冲穴 / 气势纯函数引擎 —— 权威来源：docs/systems/zhoutian/design.md v2.0
 * 本模块为纯函数，禁止引入 UI/存储依赖；与 sim.py（同目录）做 golden 对照。
 */

// ─────────────────────────────────────────────────────────────
// 参数（spec §4/§5/§6.3 定稿）
// ─────────────────────────────────────────────────────────────

/** 基础冲穴成功率（spec §4：85%） */
export const BASE_P = 0.85;
/** 每次失败 +10pp（spec §4） */
export const FAIL_BONUS_PP = 0.10;
/** 第 3 次必成兜底（spec §4：累计失败 2 次后第 3 次必成） */
export const FORCE_SUCCESS_K = 3;
/** 单次冲穴气势加成封顶 +15pp（spec §5） */
export const QISHI_CAP_PP = 0.15;
/** 每次冲穴消耗 70% 当前气势（spec §5） */
export const QISHI_CONSUME_RATE = 0.7;
/** 气势满档阈值（spec §5：100 气势 = 满档，加成 = +15pp） */
export const QISHI_FULL = 100;

// ─────────────────────────────────────────────────────────────
// 数据结构
// ─────────────────────────────────────────────────────────────

/** 窍穴定义（静态，spec §3） */
export interface AcupointDef {
  id: string;          // 唯一 ID，如 'r2-a11'
  name: string;        // 占位名称，P5 文案冻结时定稿
  meridianId: string;  // 所属经脉 ID
}

/** 经脉定义（静态，spec §3） */
export interface MeridianDef {
  id: string;          // 唯一 ID，如 'r2-m1'
  name: string;        // 占位名称
  acupointIds: string[];  // 包含的窍穴 ID
}

/** 窍穴运行时状态（持久化在 PersistedState） */
export interface AcupointState {
  failCount: number;  // 累计失败次数（保底累积，按穴独立）
  opened: boolean;    // 是否已通
}

/** 冲穴尝试结果（纯函数输出） */
export interface AttemptResult {
  success: boolean;
  newFailCount: number;
  opened: boolean;
  qishiBonusApplied: number;  // 本次应用的气势加成（pp，0–0.15）
  forced: boolean;            // 是否触发必成兜底
}

// ─────────────────────────────────────────────────────────────
// 窍穴池与经脉分组数据（spec §3）
// ─────────────────────────────────────────────────────────────

/** 各境界窍穴池与经脉分组（境界 2–5；境界 1/6/7 不接入本版） */
export const REALM_ACUPOINTS: Record<number, {
  acupoints: AcupointDef[];
  meridians: MeridianDef[];
}> = {
  2: {
    acupoints: [
      { id: 'r2-a11', name: '窍穴·甲一', meridianId: 'r2-m1' },
      { id: 'r2-a12', name: '窍穴·甲二', meridianId: 'r2-m1' },
      { id: 'r2-a21', name: '窍穴·乙一', meridianId: 'r2-m2' },
      { id: 'r2-a22', name: '窍穴·乙二', meridianId: 'r2-m2' },
    ],
    meridians: [
      { id: 'r2-m1', name: '经脉·甲', acupointIds: ['r2-a11', 'r2-a12'] },
      { id: 'r2-m2', name: '经脉·乙', acupointIds: ['r2-a21', 'r2-a22'] },
    ],
  },
  3: {
    acupoints: [
      { id: 'r3-a11', name: '窍穴·甲一', meridianId: 'r3-m1' },
      { id: 'r3-a12', name: '窍穴·甲二', meridianId: 'r3-m1' },
      { id: 'r3-a13', name: '窍穴·甲三', meridianId: 'r3-m1' },
      { id: 'r3-a21', name: '窍穴·乙一', meridianId: 'r3-m2' },
      { id: 'r3-a22', name: '窍穴·乙二', meridianId: 'r3-m2' },
    ],
    meridians: [
      { id: 'r3-m1', name: '经脉·甲', acupointIds: ['r3-a11', 'r3-a12', 'r3-a13'] },
      { id: 'r3-m2', name: '经脉·乙', acupointIds: ['r3-a21', 'r3-a22'] },
    ],
  },
  4: {
    acupoints: [
      { id: 'r4-a11', name: '窍穴·甲一', meridianId: 'r4-m1' },
      { id: 'r4-a12', name: '窍穴·甲二', meridianId: 'r4-m1' },
      { id: 'r4-a13', name: '窍穴·甲三', meridianId: 'r4-m1' },
      { id: 'r4-a21', name: '窍穴·乙一', meridianId: 'r4-m2' },
      { id: 'r4-a22', name: '窍穴·乙二', meridianId: 'r4-m2' },
      { id: 'r4-a23', name: '窍穴·乙三', meridianId: 'r4-m2' },
    ],
    meridians: [
      { id: 'r4-m1', name: '经脉·甲', acupointIds: ['r4-a11', 'r4-a12', 'r4-a13'] },
      { id: 'r4-m2', name: '经脉·乙', acupointIds: ['r4-a21', 'r4-a22', 'r4-a23'] },
    ],
  },
  5: {
    acupoints: [
      { id: 'r5-a11', name: '窍穴·甲一', meridianId: 'r5-m1' },
      { id: 'r5-a12', name: '窍穴·甲二', meridianId: 'r5-m1' },
      { id: 'r5-a13', name: '窍穴·甲三', meridianId: 'r5-m1' },
      { id: 'r5-a21', name: '窍穴·乙一', meridianId: 'r5-m2' },
      { id: 'r5-a22', name: '窍穴·乙二', meridianId: 'r5-m2' },
      { id: 'r5-a23', name: '窍穴·乙三', meridianId: 'r5-m2' },
      { id: 'r5-a31', name: '窍穴·丙一', meridianId: 'r5-m3' },
      { id: 'r5-a32', name: '窍穴·丙二', meridianId: 'r5-m3' },
    ],
    meridians: [
      { id: 'r5-m1', name: '经脉·甲', acupointIds: ['r5-a11', 'r5-a12', 'r5-a13'] },
      { id: 'r5-m2', name: '经脉·乙', acupointIds: ['r5-a21', 'r5-a22', 'r5-a23'] },
      { id: 'r5-m3', name: '经脉·丙', acupointIds: ['r5-a31', 'r5-a32'] },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// 纯函数：成功率与冲穴
// ─────────────────────────────────────────────────────────────

/** 计算本次冲穴成功率（spec §4：p=85% + 失败×10pp + 气势加成 + 必成兜底） */
export function currentSuccessRate(
  acupoint: AcupointState,
  qishiBonus: number
): number {
  if (acupoint.failCount >= FORCE_SUCCESS_K - 1) return 1.0;  // 第 3 次必成
  return Math.min(1, BASE_P + FAIL_BONUS_PP * acupoint.failCount + qishiBonus);
}

/** 计算气势加成（pp，0–0.15）：满档 100 气势 = +15pp，线性，封顶 */
export function qishiToBonus(qishi: number): number {
  return Math.min(QISHI_CAP_PP, (qishi / QISHI_FULL) * QISHI_CAP_PP);
}

/**
 * 冲穴尝试（纯函数，spec §5.2）：
 * 输入当前窍穴状态 + 气势加成 + 随机数（0–1），返回结果与新状态。
 * 失败不损失机会以外的任何资源；失败时 failCount+1，触发保底累积。
 */
export function attemptAcupoint(
  acupoint: AcupointState,
  qishiBonus: number,
  roll: number
): AttemptResult {
  const p = currentSuccessRate(acupoint, qishiBonus);
  const success = roll < p;
  const forced = !success && acupoint.failCount >= FORCE_SUCCESS_K - 1;
  // 必成兜底：第 3 次必成（currentSuccessRate 返回 1.0，roll < 1.0 必成立）
  // 但若 roll 恰好 = 1.0（极小概率），仍记为成功（forced）
  const actualSuccess = success || forced;

  return {
    success: actualSuccess,
    newFailCount: actualSuccess ? acupoint.failCount : acupoint.failCount + 1,
    opened: actualSuccess || acupoint.opened,
    qishiBonusApplied: qishiBonus,
    forced,
  };
}

// ─────────────────────────────────────────────────────────────
// 纯函数：突破双条件（spec §6）
// ─────────────────────────────────────────────────────────────

/** 突破双条件：丹田充满 且 已通窍穴数 ≥ M */
export function breakthroughReady(
  dantianNeili: number,
  breakthroughCost: number,
  openedAcupoints: number,
  requiredAcupoints: number
): boolean {
  return dantianNeili >= breakthroughCost && openedAcupoints >= requiredAcupoints;
}

// ─────────────────────────────────────────────────────────────
// 纯函数：加成计算（spec §6.3/§9，加法合并进临时乘区）
// ─────────────────────────────────────────────────────────────

/** 单穴加成（spec §6.3：境界 2–4 +2%，境界 5 +1.5%） */
export function acupointBonus(realm: number): number {
  return realm === 5 ? 0.015 : 0.02;
}

/** 经脉贯通集合加成（spec §8.3：单穴 × 1.5） */
export function meridianBonus(realm: number): number {
  return acupointBonus(realm) * 1.5;
}

/** 某经脉是否贯通（其上所有窍穴已通） */
export function isMeridianComplete(
  meridian: MeridianDef,
  openedAcupointIds: Set<string>
): boolean {
  return meridian.acupointIds.every(id => openedAcupointIds.has(id));
}

/**
 * 计算总窍穴/贯通加成（加法合并进临时乘区，spec §9 锁定点 1）：
 *  openedAcupoints × 单穴加成 + completedMeridians × 贯通加成
 */
export function totalAcupointBonus(
  realm: number,
  openedAcupoints: number,
  completedMeridians: number
): number {
  return openedAcupoints * acupointBonus(realm) + completedMeridians * meridianBonus(realm);
}

// ─────────────────────────────────────────────────────────────
// 纯函数：气势消耗（spec §5，每次冲穴消耗 70% 当前气势）
// ─────────────────────────────────────────────────────────────

/** 冲穴后气势剩余（消耗 70%） */
export function consumeQishi(qishi: number): number {
  return qishi * (1 - QISHI_CONSUME_RATE);
}
