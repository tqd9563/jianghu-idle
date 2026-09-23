/**
 * 窍穴 / 经脉 / 冲穴纯函数引擎 —— 权威来源：docs/systems/zhoutian/design.md v4.0
 * 本模块为纯函数，禁止引入 UI/存储依赖；与 sim.py（同目录）做 golden 对照。
 *
 * v4.0「冲穴耗内力制」：废止冲穴机会与气势，冲穴从当前段扣「所需真气」、成败同扣；
 * 成功率与所需真气按脉内位次公式生成；突破门槛 = 本境界首条经脉贯通。
 */

// ─────────────────────────────────────────────────────────────
// 参数（design.md §3.3，2026-09-22 拍板；sim.py 判据 W1–W4 PASS）
// ─────────────────────────────────────────────────────────────

/** 脉内第 1 穴成功率 */
export const P_BASE = 0.90;
/** 每往后一穴成功率 −10pp */
export const P_STEP = 0.10;
/** 成功率下限（末穴再难也不低于此） */
export const P_FLOOR = 0.50;
/** 同穴每失败一次，下次 +10pp（累进保留；v3 的「第 3 次必成」已废止——内力可无限重试，不需保底） */
export const FAIL_BONUS_PP = 0.10;

/** 脉内第 1 穴所需真气占当前段配额的比例 */
export const T_BASE = 0.11;
/** 每往后一穴 +5pp */
export const T_STEP = 0.05;
/**
 * 境界乘数：所需真气比例 × REALM_MUL^(境界−2)。
 * 没有它，境界 2→3、4→5 这类「突破所需穴数不变」的台阶上附加时间会持平甚至倒退，
 * 与「越往上越难」相悖（sim.py 判据 W4）。
 */
export const REALM_MUL = 1.2;

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
}

/**
 * 冲穴可否放手的判定结果（design.md §2 两个条件）。
 * 每个不可冲的原因对应一条冻结文案（rules/copy/zhoutian.md §1），故须区分而非合并成 boolean。
 */
export type ChongxueGate =
  | 'ok'               // 可冲
  | 'opened'           // 已通
  | 'not-loosened'     // 真气未行至该穴
  | 'prev-unopened'    // 同脉前一穴未通（须循序而行）
  | 'insufficient';    // 当前段真气不足

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
// 纯函数：脉内位次 —— v4.0 的一切按穴难度都由它导出
// ─────────────────────────────────────────────────────────────

/**
 * 窍穴在其所属经脉内的位次（1 起）；找不到返回 0。
 * 难度不按境界定而按位次定：贯通一条脉就是一路越冲越难（design.md §3.3）。
 */
export function acupointPos(realm: number, acupointId: string): number {
  const data = REALM_ACUPOINTS[realm];
  if (!data) return 0;
  const acu = data.acupoints.find(a => a.id === acupointId);
  if (!acu) return 0;
  const m = data.meridians.find(x => x.id === acu.meridianId);
  if (!m) return 0;
  return m.acupointIds.indexOf(acupointId) + 1;
}

/** 本境界突破必须贯通的经脉：表内首条（design.md §4） */
export function requiredMeridian(realm: number): MeridianDef | null {
  return REALM_ACUPOINTS[realm]?.meridians[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// 纯函数：成功率与所需真气
// ─────────────────────────────────────────────────────────────

/** 该位次窍穴的基础成功率：max(50%, 90% − 10pp×(pos−1)) */
export function basePForPos(pos: number): number {
  return Math.max(P_FLOOR, P_BASE - P_STEP * (pos - 1));
}

/**
 * 本次冲穴成功率 = 位次基础值 + 失败累进（design.md §3.3）。
 * 无气势加成、无必成兜底——两者均随 v4.0 废止。
 */
export function currentSuccessRate(acupoint: AcupointState, pos: number): number {
  return Math.min(1, basePForPos(pos) + FAIL_BONUS_PP * acupoint.failCount);
}

/** 该位次窍穴的所需真气占当前段配额的比例：(11% + 5%×(pos−1)) × 1.2^(境界−2)，封顶 100% */
export function neiliRatioForPos(pos: number, realm: number): number {
  return Math.min(1, (T_BASE + T_STEP * (pos - 1)) * REALM_MUL ** (realm - 2));
}

/**
 * 冲一次该穴要从当前段扣的内力。
 *
 * 锚在**当前段配额**而非本境界总额：高境界前几段配额只占总额零头，
 * 按总额计价会让高境界冲穴反而便宜（sim.py 判据 W4 曾因此 FAIL）。
 * 比例封顶 100%，所以松动即装得下，没有等丹田扩容的空窗。
 */
export function neiliCostFor(realm: number, acupointId: string, segmentQuota: number): number {
  const pos = acupointPos(realm, acupointId);
  if (pos === 0) return 0;
  return segmentQuota * neiliRatioForPos(pos, realm);
}

// ─────────────────────────────────────────────────────────────
// 纯函数：松动（真气行至该穴）与冲穴门槛
// ─────────────────────────────────────────────────────────────

/**
 * 该穴是否已松动（design.md §2/§3.2）。
 *
 * 突破所需的 M 个穴（首条经脉）在**最后 M 段**依次松动：第 k 穴需已缴 N−M+k 段。
 * 其余经脉的穴在末段圆满时一并松动。前几段是筑基，真气未至窍穴——因段间递增，
 * 这几段只占本境界一小截时长。
 *
 * 用 chargeHighWater（高水位）而非当前段数：冲穴扣款会让液面回落，
 * 但真气已行至的穴不该因此重新锁上。
 */
export function isLoosened(
  realm: number,
  acupointId: string,
  chargeHighWater: number,
  zhoutianCount: number
): boolean {
  const req = requiredMeridian(realm);
  if (!req) return false;
  const k = req.acupointIds.indexOf(acupointId) + 1;
  if (k === 0) return chargeHighWater >= zhoutianCount;   // 非必贯通脉：末段圆满一并松动
  const M = req.acupointIds.length;
  return chargeHighWater >= Math.max(1, zhoutianCount - M + k);
}

/**
 * 冲穴门槛判定（design.md §2）：两个条件——该穴已松动且同脉前穴已通、当前段真气够。
 * 返回具体原因而非 boolean，因为每个原因对应一条冻结文案。
 */
export function chongxueGate(args: {
  realm: number;
  acupointId: string;
  progress: Record<string, AcupointState>;
  chargeHighWater: number;
  zhoutianCount: number;
  segmentNeili: number;
  segmentQuota: number;
}): ChongxueGate {
  const { realm, acupointId, progress, chargeHighWater, zhoutianCount, segmentNeili, segmentQuota } = args;
  const data = REALM_ACUPOINTS[realm];
  if (!data) return 'not-loosened';
  const acu = data.acupoints.find(a => a.id === acupointId);
  if (!acu) return 'not-loosened';
  if (progress[acupointId]?.opened) return 'opened';
  if (!isLoosened(realm, acupointId, chargeHighWater, zhoutianCount)) return 'not-loosened';

  // 同一条脉须按次序冲：前面任一穴未通即不可冲（不同脉之间不互相阻塞）
  const m = data.meridians.find(x => x.id === acu.meridianId);
  if (m) {
    const idx = m.acupointIds.indexOf(acupointId);
    for (let i = 0; i < idx; i++) {
      if (!progress[m.acupointIds[i]]?.opened) return 'prev-unopened';
    }
  }
  if (segmentNeili < neiliCostFor(realm, acupointId, segmentQuota)) return 'insufficient';
  return 'ok';
}

/** 同一条脉中该穴之前、尚未冲通的第一个穴（供「{前穴名} 未通」文案取名） */
export function blockingPrevAcupoint(
  realm: number,
  acupointId: string,
  progress: Record<string, AcupointState>
): AcupointDef | null {
  const data = REALM_ACUPOINTS[realm];
  const acu = data?.acupoints.find(a => a.id === acupointId);
  const m = data?.meridians.find(x => x.id === acu?.meridianId);
  if (!data || !acu || !m) return null;
  const idx = m.acupointIds.indexOf(acupointId);
  for (let i = 0; i < idx; i++) {
    if (!progress[m.acupointIds[i]]?.opened) {
      return data.acupoints.find(a => a.id === m.acupointIds[i]) ?? null;
    }
  }
  return null;
}

/**
 * 冲穴尝试（纯函数，design.md §3.3）：
 * 成败同扣所需真气（扣款在 store 侧），失败时 failCount+1 使下次 +10pp。
 */
export function attemptAcupoint(
  acupoint: AcupointState,
  pos: number,
  roll: number
): AttemptResult {
  const success = roll < currentSuccessRate(acupoint, pos);
  return {
    success,
    newFailCount: success ? acupoint.failCount : acupoint.failCount + 1,
    opened: success || acupoint.opened,
  };
}

// ─────────────────────────────────────────────────────────────
// 纯函数：突破条件（design.md §4）
// ─────────────────────────────────────────────────────────────

/**
 * 本境界已通窍穴数。
 *
 * 门槛按**境界**计，不跨境界累计——每境界重建窍穴池。
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

/** 本境界首条经脉已通的窍穴数（突破进度读数） */
export function requiredMeridianOpened(
  realm: number,
  progress: Record<string, AcupointState>
): number {
  const req = requiredMeridian(realm);
  if (!req) return 0;
  return req.acupointIds.reduce((n, id) => n + (progress[id]?.opened ? 1 : 0), 0);
}

/**
 * 突破双条件（design.md §4）：N 段周天全部缴清 且 本境界首条经脉贯通。
 * 无首条脉配置的境界（本版 1/6/7）只看丹田。
 */
export function breakthroughReady(
  dantianNeili: number,
  breakthroughCost: number,
  realm: number,
  progress: Record<string, AcupointState>
): boolean {
  if (dantianNeili < breakthroughCost) return false;
  const req = requiredMeridian(realm);
  if (!req) return true;
  return req.acupointIds.every(id => progress[id]?.opened);
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
