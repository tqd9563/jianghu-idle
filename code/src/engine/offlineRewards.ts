/**
 * 基础离线收益（闭关—出关结算）—— 权威来源：docs/rules/offline-rewards.md v1.0
 * 纯函数模块：不引入 UI/存储依赖；结算时点 = 回归上线一次性结算（store.init），离线期间无后台结算。
 * 机制内部称「离线收益」；玩家侧文案一律「闭关 / 出关结算」（术语纪律，表 A 推导锚点）。
 */
import { MAP_STAGE_COUNT } from './enemies';

/** 表 A 行结构（offline-rewards.md §7 导出结构定稿） */
export interface OfflineRewardStage {
  id: number;
  idleStageMin: number;
  idleStageMax: number;
  jianghuPhase: string;
  neiliPerMin: number;
  silverPerMin: number;
  experiencePerMin: number;
  offlineEfficiency: number;
  offlineCapMin: number;
  debugCapMin: number;
  minSettleMin: number;
  catchupPerStage: number;
  catchupMax: number;
  dropGroup: 'none';
}

/** 表 A：离线收益关卡档位（MVP-1 既有 8 档 + MVP-2 地图 4/5 扩展档） */
export const OFFLINE_REWARD_STAGES: readonly OfflineRewardStage[] = [
  { id: 1001, idleStageMin: 1, idleStageMax: 4, jianghuPhase: '村外小径·试手', neiliPerMin: 90, silverPerMin: 4, experiencePerMin: 0.6, offlineEfficiency: 0.35, offlineCapMin: 20, debugCapMin: 10, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1002, idleStageMin: 5, idleStageMax: 8, jianghuPhase: '村外小径·破寨', neiliPerMin: 120, silverPerMin: 6, experiencePerMin: 0.9, offlineEfficiency: 0.35, offlineCapMin: 20, debugCapMin: 10, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1003, idleStageMin: 9, idleStageMax: 12, jianghuPhase: '洛阳近郊·入城', neiliPerMin: 155, silverPerMin: 8, experiencePerMin: 1.1, offlineEfficiency: 0.34, offlineCapMin: 22, debugCapMin: 10, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1004, idleStageMin: 13, idleStageMax: 18, jianghuPhase: '洛阳近郊·鏖战', neiliPerMin: 190, silverPerMin: 10, experiencePerMin: 1.4, offlineEfficiency: 0.34, offlineCapMin: 22, debugCapMin: 10, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1005, idleStageMin: 19, idleStageMax: 22, jianghuPhase: '华山古道·登山', neiliPerMin: 230, silverPerMin: 12, experiencePerMin: 1.7, offlineEfficiency: 0.33, offlineCapMin: 24, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1006, idleStageMin: 23, idleStageMax: 25, jianghuPhase: '华山古道·遇险', neiliPerMin: 270, silverPerMin: 14, experiencePerMin: 2.0, offlineEfficiency: 0.33, offlineCapMin: 24, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1007, idleStageMin: 26, idleStageMax: 27, jianghuPhase: '华山古道·临寨', neiliPerMin: 315, silverPerMin: 16, experiencePerMin: 2.3, offlineEfficiency: 0.32, offlineCapMin: 26, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1008, idleStageMin: 28, idleStageMax: 28, jianghuPhase: '黑风寨主前', neiliPerMin: 360, silverPerMin: 20, experiencePerMin: 2.8, offlineEfficiency: 0.32, offlineCapMin: 26, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1009, idleStageMin: 29, idleStageMax: 38, jianghuPhase: '地图四·待命名', neiliPerMin: 1653.6, silverPerMin: 25, experiencePerMin: 3.5, offlineEfficiency: 0.50, offlineCapMin: 480, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
  { id: 1010, idleStageMin: 39, idleStageMax: 48, jianghuPhase: '地图五·待命名', neiliPerMin: 2067.4, silverPerMin: 30, experiencePerMin: 4.2, offlineEfficiency: 0.50, offlineCapMin: 480, debugCapMin: 12, minSettleMin: 3, catchupPerStage: 0, catchupMax: 0, dropGroup: 'none' },
];

/** 表 C：离线结算约束（offline_settlement_rule = default 首发配置） */
export const OFFLINE_SETTLEMENT_RULE = {
  ruleId: 'default',
  /** 低于该原始离线秒数不展示出关结算（短离线静默入账，A5 在线连续口径） */
  minSettleSec: 180,
  silentGrantBelowMin: true,
  maxSingleOfflineMin: 26,
  debugCapMin: 10,
  negativeTimePolicy: 'zero_reward',
  forwardTimePolicy: 'clamp_to_cap',
  settleOncePolicy: 'consume_timestamp_once',
  dailyCapEnabled: false,
} as const;

/**
 * 当前最大可挂机关卡（全局 1–48 序号；offline-rewards.md §2.2 驱动字段）。
 * 首发实现口径 = 已通关的最高关卡（关卡在图内严格顺序通关、图间顺序解锁，故为前缀）；
 * 未通任何关时取 1（关卡 1 已解锁即为收益来源）。
 */
export function maxIdleStage(clearedStages: readonly string[]): number {
  let best = 1;
  const stageCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    ...MAP_STAGE_COUNT,
    4: 10,
    5: 10,
  };
  const offsets: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: stageCounts[1],
    3: stageCounts[1] + stageCounts[2],
    4: stageCounts[1] + stageCounts[2] + stageCounts[3],
    5: stageCounts[1] + stageCounts[2] + stageCounts[3] + stageCounts[4],
  };
  for (const key of clearedStages) {
    const m = /^m([1-5])s(\d+)$/.exec(key);
    if (!m) continue;
    const map = Number(m[1]) as 1 | 2 | 3 | 4 | 5;
    const stage = Number(m[2]);
    if (stage < 1 || stage > stageCounts[map]) continue;
    const g = offsets[map] + stage;
    if (g > best) best = g;
  }
  return best;
}

/** 按最大可挂机关卡匹配表 A（越界 clamp 到首/末档） */
export function findOfflineRewardStage(currentMaxIdleStage: number): OfflineRewardStage {
  const s = Math.max(1, Math.min(48, Math.floor(currentMaxIdleStage)));
  return OFFLINE_REWARD_STAGES.find((t) => s >= t.idleStageMin && s <= t.idleStageMax)
    ?? OFFLINE_REWARD_STAGES[OFFLINE_REWARD_STAGES.length - 1];
}

/**
 * 有效闭关分钟（可含小数）：负时间归 0（时钟回拨 zero_reward），超上限截断（前拨/跨时区 clamp_to_cap）。
 */
export function getEffectiveOfflineMinutes(lastSeenAt: number, now: number, capMin: number): {
  rawSec: number;
  effectiveMin: number;
  capped: boolean;
} {
  const rawSec = Math.max(0, (now - lastSeenAt) / 1000);
  const rawMin = rawSec / 60;
  return { rawSec, effectiveMin: Math.min(rawMin, capMin), capped: rawMin >= capMin };
}

/** 是否弹出出关结算（低于最小结算分钟静默入账） */
export function shouldShowOfflineSettlement(effectiveMin: number, minSettleMin: number): boolean {
  return effectiveMin * 60 >= minSettleMin * 60;
}

export interface OfflineSettleInput {
  currentMaxIdleStage: number;
  lastSeenAt: number;
  now: number;
  /** A4 验收调试覆盖上限（分钟）；null/undefined = 用表 A 正式上限 */
  capOverrideMin?: number | null;
}

/** 出关结算结果：三资源 + 构成因子全量裸露（§6-2 数值可信：时长 × 速率 × 效率可核对） */
export interface OfflineSettleResult {
  stageBasis: number;
  tier: OfflineRewardStage;
  rawSec: number;
  effectiveMin: number;
  capMin: number;
  capped: boolean;
  efficiency: number;
  neili: number;
  silver: number;
  xp: number;
  /** 原始离线低于最小结算阈值：静默入账，不弹出出关结算 */
  silent: boolean;
  /** 本次是否使用了调试覆盖上限（A4；正式验收记录须裸露该位） */
  debugCap: boolean;
}

/**
 * 主公式（offline-rewards.md §2.1）：
 * 最终发放 = floor(每分钟产出 × 有效闭关分钟 × 离线效率 × 追赶倍率)，首发追赶倍率恒为 1。
 */
export function calculateOfflineRewards(input: OfflineSettleInput): OfflineSettleResult {
  const tier = findOfflineRewardStage(input.currentMaxIdleStage);
  const debugCap = input.capOverrideMin != null;
  const capMin = debugCap ? input.capOverrideMin! : tier.offlineCapMin;
  const { rawSec, effectiveMin, capped } = getEffectiveOfflineMinutes(input.lastSeenAt, input.now, capMin);
  const catchup = 1; // 首发 catchup_per_stage = catchup_max = 0（表 A §6）
  const grant = (perMin: number) => Math.floor(perMin * effectiveMin * tier.offlineEfficiency * catchup);
  return {
    stageBasis: Math.max(1, Math.min(48, Math.floor(input.currentMaxIdleStage))),
    tier,
    rawSec,
    effectiveMin,
    capMin,
    capped,
    efficiency: tier.offlineEfficiency,
    neili: grant(tier.neiliPerMin),
    silver: grant(tier.silverPerMin),
    xp: grant(tier.experiencePerMin),
    // 静默判定按原始离线秒（表 C min_settle_sec 语义：短离线/会话内刷新按在线连续处理），
    // 不用截断后的 effectiveMin——调试压低上限（A4）不得把长离线误判为静默。
    silent: rawSec < OFFLINE_SETTLEMENT_RULE.minSettleSec,
    debugCap,
  };
}
