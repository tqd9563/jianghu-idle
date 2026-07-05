/**
 * 核心结算公式 —— 权威来源：docs/core-loop/mvp-0-formula-tables.md §2 / §3
 * 本模块为纯函数，禁止引入 UI/存储依赖；与 docs/core-loop/sim/mvp0_sim.py 做 golden 对照。
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

/** 周天进度派生显示（规格书 §6.1 v0.9 单钱包模型）：丹田内力对突破消耗的 5 段阈值 */
export const CHARGE_SEGMENTS = 5;
export function zhoutianProgress(dantianNeili: number, breakthroughCost: number): {
  segmentsFull: number;      // 已圆满周天数 0–5
  currentSegmentPct: number; // 进行中周天的百分比 0–1
  ready: boolean;            // 丹田 ≥ 全额，可点「突破」
} {
  const clamped = Math.max(0, Math.min(dantianNeili, breakthroughCost));
  const perSegment = breakthroughCost / CHARGE_SEGMENTS;
  const segmentsFull = Math.min(CHARGE_SEGMENTS, Math.floor(clamped / perSegment));
  const remainder = clamped - segmentsFull * perSegment;
  return {
    segmentsFull,
    currentSegmentPct: segmentsFull >= CHARGE_SEGMENTS ? 0 : remainder / perSegment,
    ready: dantianNeili >= breakthroughCost,
  };
}
