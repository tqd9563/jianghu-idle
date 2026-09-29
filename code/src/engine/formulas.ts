/**
 * 核心结算公式 —— 权威来源：docs/rules/formulas.md §2 / §3
 * 本模块为纯函数，禁止引入 UI/存储依赖；与 docs/systems/sim/mvp0_sim.py 做 golden 对照。
 */

/** 双曲防御减免系数：受到伤害 = 攻击 × K/(K+DEF)。K 缺省 100；长线关卡 K 随当量放大（公式表 §1.3 v1.6） */
export function mitigationMultiplier(def: number, k = 100): number {
  return k / (k + def);
}

/** 命中率 = 命中/(命中+闪避)，下限 30%（公式表 §2） */
export const HIT_FLOOR = 0.3;
export function hitChance(accuracy: number, evasion: number): number {
  return Math.max(HIT_FLOOR, accuracy / (accuracy + evasion));
}

/** 挂机内力产出（内力/秒）= 9 × 1.25^(境界−1)（公式表 §3.2） */
export function idleNeiliPerSec(realm: number): number {
  return 9 * Math.pow(1.25, realm - 1);
}

/** 周天段间公比（zhoutian/design.md §3.1）：第 i 段配额 = 首段 × 2^(i−1)，末段约占本境界一半时长 */
export const QUOTA_RATIO = 2;

/** 各段配额：总额按公比 2 分成 N 段（首段 = 总额 × (r−1)/(r^N−1)） */
export function segmentQuotas(total: number, segments: number): number[] {
  const first = total * (QUOTA_RATIO - 1) / (QUOTA_RATIO ** segments - 1);
  return Array.from({ length: segments }, (_, i) => first * QUOTA_RATIO ** i);
}

/** 缴满前 k 段所需的累计内力（k = 0..N） */
export function paidThrough(total: number, segments: number, k: number): number {
  const first = total * (QUOTA_RATIO - 1) / (QUOTA_RATIO ** segments - 1);
  return first * (QUOTA_RATIO ** Math.max(0, Math.min(k, segments)) - 1) / (QUOTA_RATIO - 1);
}

/** 周天进度派生显示：丹田内力对本境界总额的 N 段阈值（段间公比 2） */
export function zhoutianProgress(
  dantianNeili: number,
  total: number,
  segments: number,
): {
  segmentsFull: number;      // 已圆满周天数 0–N
  currentSegmentPct: number; // 进行中周天的百分比 0–1
  ready: boolean;            // 丹田 ≥ 全额，可点「突破」
} {
  const clamped = Math.max(0, Math.min(dantianNeili, total));
  // 浮点：末段阈值 = total，用 1e-9 相对容差避免满额时差一丝不算圆满
  const eps = total * 1e-9;
  let segmentsFull = 0;
  while (segmentsFull < segments && clamped + eps >= paidThrough(total, segments, segmentsFull + 1)) segmentsFull++;
  const quota = segmentQuotas(total, segments);
  return {
    segmentsFull,
    currentSegmentPct: segmentsFull >= segments ? 0
      : (clamped - paidThrough(total, segments, segmentsFull)) / quota[segmentsFull],
    ready: dantianNeili + eps >= total,
  };
}

/** 当前段的配额（冲穴所需真气锚在它上面，zhoutian/design.md §3.3）；末段圆满后仍读第 N 段 */
export function currentSegmentQuota(total: number, segments: number, chargeHighWater: number): number {
  return segmentQuotas(total, segments)[Math.min(chargeHighWater, segments - 1)];
}

/**
 * 当前段已蓄内力（design.md §2：冲穴与升武学都从「当前段」扣款）。
 *
 * 当前段由 **chargeHighWater**（已沉入根基的段数）划定，不由 dantian 反推：
 * 冲穴扣款会让液面回落到已缴线以下，但已沉入根基的部分不退回，
 * 此时当前段真气归零、须重蓄（印记常亮 / 进度回落，spec §1）。
 */
export function currentSegmentNeili(
  dantianNeili: number,
  total: number,
  segments: number,
  chargeHighWater: number,
): number {
  // 当前段封顶在第 N 段：末段圆满后丹田也就满了，若仍按「已缴 N 段」算，
  // 当前段真气会恒为 0、最后一个窍穴永远冲不动——那正是 v4.0 要消灭的死锁。
  // 满额时当前段读作「第 N 段已蓄满」，冲穴扣款后液面回落、重蓄即可再冲（design.md §3.4 W1）。
  const paid = Math.min(chargeHighWater, segments - 1);
  return Math.max(0, Math.min(dantianNeili, total) - paidThrough(total, segments, paid));
}
