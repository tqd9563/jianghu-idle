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
/** 周天圆满赠予的气势（design.md §表 D5：气势来源 = 周天圆满 +40） */
export const QISHI_GRANT_PER_ZHOUTIAN = 40;

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

/**
 * 各境界窍穴池与经脉分组（境界 2–5；境界 1/6/7 不接入本版）。
 *
 * 名称取真实经络：窍穴的经脉归属、穴位在经上的位置均与中医经络学一致。
 * 次第为手 → 足 → 任 → 督，境界 5 任督俱通即小周天圆满，与 design.md
 * 「小周天段止于境界 5」吻合；大周天（境界 6–8）见 design.md §7 敞口。
 * 手太阴肺经预留给境界 1 教学脉（design.md §3.2 v3.0 已定、代码未接入）。
 *
 * 奇经八脉除任督外无专属穴位，冲脉/带脉列出的是其交会穴（分属肾经、胆经），
 * 这是经络学事实而非简化。
 *
 * **id 与位置解耦**：id 取穴位本身的拼音，不编码境界与脉序。调整窍穴所属境界、
 * 或改动脉内顺序时 id 不变，存档（acupointProgress / acupointLog 皆按 id 存）
 * 无需迁移；只有真正新增/删除窍穴才需要动存档。
 */
export const REALM_ACUPOINTS: Record<number, {
  acupoints: AcupointDef[];
  meridians: MeridianDef[];
}> = {
  2: {
    acupoints: [
      { id: 'quchi',   name: '曲池', meridianId: 'shouyangming' },
      { id: 'hegu',    name: '合谷', meridianId: 'shouyangming' },
      { id: 'shaohai', name: '少海', meridianId: 'shoushaoyin' },
      { id: 'shenmen', name: '神门', meridianId: 'shoushaoyin' },
    ],
    meridians: [
      { id: 'shouyangming', name: '手阳明', acupointIds: ['quchi', 'hegu'] },
      { id: 'shoushaoyin',  name: '手少阴', acupointIds: ['shaohai', 'shenmen'] },
    ],
  },
  3: {
    acupoints: [
      { id: 'futu',      name: '伏兔',   meridianId: 'zuyangming' },
      { id: 'zusanli',   name: '足三里', meridianId: 'zuyangming' },
      { id: 'fenglong',  name: '丰隆',   meridianId: 'zuyangming' },
      { id: 'xuehai',    name: '血海',   meridianId: 'zutaiyin' },
      { id: 'sanyinjiao', name: '三阴交', meridianId: 'zutaiyin' },
    ],
    meridians: [
      { id: 'zuyangming', name: '足阳明', acupointIds: ['futu', 'zusanli', 'fenglong'] },
      { id: 'zutaiyin',   name: '足太阴', acupointIds: ['xuehai', 'sanyinjiao'] },
    ],
  },
  4: {
    acupoints: [
      { id: 'guanyuan', name: '关元', meridianId: 'renmai' },
      { id: 'qihai',    name: '气海', meridianId: 'renmai' },
      { id: 'danzhong', name: '膻中', meridianId: 'renmai' },
      { id: 'yongquan', name: '涌泉', meridianId: 'zushaoyin' },
      { id: 'taixi',    name: '太溪', meridianId: 'zushaoyin' },
      { id: 'fuliu',    name: '复溜', meridianId: 'zushaoyin' },
    ],
    meridians: [
      { id: 'renmai',    name: '任脉',   acupointIds: ['guanyuan', 'qihai', 'danzhong'] },
      { id: 'zushaoyin', name: '足少阴', acupointIds: ['yongquan', 'taixi', 'fuliu'] },
    ],
  },
  5: {
    acupoints: [
      { id: 'mingmen', name: '命门', meridianId: 'dumai' },
      { id: 'dazhui',  name: '大椎', meridianId: 'dumai' },
      { id: 'baihui',  name: '百会', meridianId: 'dumai' },
      { id: 'henggu',  name: '横骨', meridianId: 'chongmai' },
      { id: 'dahe',    name: '大赫', meridianId: 'chongmai' },
      { id: 'youmen',  name: '幽门', meridianId: 'chongmai' },
      { id: 'wushu',   name: '五枢', meridianId: 'daimai' },
      { id: 'weidao',  name: '维道', meridianId: 'daimai' },
    ],
    meridians: [
      { id: 'dumai',    name: '督脉', acupointIds: ['mingmen', 'dazhui', 'baihui'] },
      { id: 'chongmai', name: '冲脉', acupointIds: ['henggu', 'dahe', 'youmen'] },
      { id: 'daimai',   name: '带脉', acupointIds: ['wushu', 'weidao'] },
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
/**
 * 本境界已通窍穴数。
 *
 * 突破的 M 条件按**境界**计，不跨境界累计——`sim.py` 的 P(≥M) 验算即按
 * 「每境界重建 pool、N 次机会、判 successes ≥ M」建模（design.md §3.2/§4）。
 * 加成口径与此不同：窍穴加成保留至归隐，按全局累计（design.md §5 D1 裁决）。
 */
export function openedInRealm(
  realm: number,
  progress: Record<string, AcupointState>
): number {
  const data = REALM_ACUPOINTS[realm];
  if (!data) return 0;
  return data.acupoints.reduce((n, a) => n + (progress[a.id]?.opened ? 1 : 0), 0);
}

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

/** 周天圆满赠气势（D5）：+40 并封顶于满档，防止无上限累积使「消耗 70%」形同虚设 */
export function grantQishi(qishi: number): number {
  return Math.min(QISHI_FULL, qishi + QISHI_GRANT_PER_ZHOUTIAN);
}
