/**
 * 核心结算公式 —— 权威来源：docs/rules/formulas.md §2 / §3
 * 本模块为纯函数，禁止引入 UI/存储依赖；与 docs/systems/sim/mvp0_sim.py 做 golden 对照。
 */

/** 双曲防御减免系数：受到伤害 = 攻击 × 100/(100+DEF)。常数 K=100（调境界底数须联动复查，公式表 §3.1） */
export function mitigationMultiplier(def: number): number {
  return 100 / (100 + def);
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

/** 周天进度派生显示（规格书 §6.1 v0.9 单钱包模型 + 主题版本 spec §2 N 段推广）：
 *  丹田内力对突破消耗的 N 段阈值；segments 默认 5（MVP-0 固定 5 段 fallback，维持 golden 用例） */
export const CHARGE_SEGMENTS = 5;
export function zhoutianProgress(
  dantianNeili: number,
  breakthroughCost: number,
  segments?: number
): {
  segmentsFull: number;      // 已圆满周天数 0–N
  currentSegmentPct: number; // 进行中周天的百分比 0–1
  ready: boolean;            // 丹田 ≥ 全额，可点「突破」
} {
  const N = segments ?? CHARGE_SEGMENTS;
  const clamped = Math.max(0, Math.min(dantianNeili, breakthroughCost));
  const perSegment = breakthroughCost / N;
  const segmentsFull = Math.min(N, Math.floor(clamped / perSegment));
  const remainder = clamped - segmentsFull * perSegment;
  return {
    segmentsFull,
    currentSegmentPct: segmentsFull >= N ? 0 : remainder / perSegment,
    ready: dantianNeili >= breakthroughCost,
  };
}

/**
 * 当前段已蓄内力（design.md §2：冲穴与升武学都从「当前段」扣款）。
 *
 * 当前段由 **chargeHighWater**（已沉入根基的段数）划定，不由 dantian 反推：
 * 冲穴扣款会让液面回落到已缴线以下，但已沉入根基的部分不退回，
 * 此时当前段真气归零、须重蓄（印记常亮 / 进度回落，spec §1）。
 *
 * 段配额当前为**均分**（cost / N）。design.md §3.1 的「段间公比 2」与长线数值
 * 同属 v3.0 挂账、尚未落到代码，本函数按代码现行口径计算。
 */
export function currentSegmentNeili(
  dantianNeili: number,
  breakthroughCost: number,
  segments: number,
  chargeHighWater: number
): number {
  const perSegment = breakthroughCost / segments;
  // 当前段封顶在第 N 段：末段圆满后丹田也就满了，若仍按「已缴 N 段」算，
  // 当前段真气会恒为 0、最后一个窍穴永远冲不动——那正是 v4.0 要消灭的死锁。
  // 满额时当前段读作「第 N 段已蓄满」，冲穴扣款后液面回落、重蓄即可再冲（design.md §3.4 W1）。
  const paid = Math.min(chargeHighWater, segments - 1);
  return Math.max(0, Math.min(dantianNeili, breakthroughCost) - paid * perSegment);
}
