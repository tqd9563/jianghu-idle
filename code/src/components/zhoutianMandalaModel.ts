/**
 * 周天年轮视图模型与几何 —— 纯函数，无 React 依赖。
 * 权威来源：docs/systems/zhoutian/spec.md §1（呈现一致性三层语义）+ design.md §3（数值）
 *          + docs/rules/copy/zhoutian.md（冻结文案，逐字使用）
 *
 * 几何与状态全部由数据推导（窍穴池/经脉分组见 engine/acupoints，周天段数见 content.REALMS）：
 * 后续增脉增穴只改数据，年轮自行生长，不需要改布局代码。
 */
import { REALMS } from '../engine/content';
import { CHARGE_SEGMENTS, zhoutianProgress } from '../engine/formulas';
import {
  REALM_ACUPOINTS, currentSuccessRate, isMeridianComplete, qishiToBonus,
} from '../engine/acupoints';
import type { AcupointState } from '../engine/acupoints';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

// ── 几何常量（视图坐标系，SVG 等比缩放） ──
// 版式意图：内环=丹田周天，外弧=经脉，经脉名落在内外之间的空档里，
// 窍穴名向外——三层信息各占一环，互不压字。
export const VIEW_W = 480;
export const VIEW_H = 430;
export const CX = 240;
export const CY = 220;
export const R_ZT = 86;         // 丹田周天环半径
export const R_PEARL = 76;      // 高水位印记内轨（常亮，不随回落消失）
export const R_QI = 62;         // 丹田内的气流圈
export const R_M = 158;         // 经脉弧半径
export const R_ACU_LABEL = 178; // 窍穴名（向外）
export const R_M_LABEL = 126;   // 经脉名（向内，落在内外环之间的空档）
const SLOT_GAP_DEG = 20;        // 脉位之间的留白
export const ZT_GAP_DEG = 4;    // 周天分段之间的刻痕

/** 终局脉位数：取各境界经脉条数的最大值（数据驱动，增脉后自动扩位） */
export const MAX_SLOTS = Math.max(
  ...Object.values(REALM_ACUPOINTS).map(d => d.meridians.length)
);

/** 某个脉位首次出现的境界与占位名（未解锁脉位的目标指引） */
function slotUnlock(slotIndex: number): { realm: number; name: string } | null {
  const realms = Object.keys(REALM_ACUPOINTS).map(Number).sort((a, b) => a - b);
  for (const r of realms) {
    const ms = REALM_ACUPOINTS[r].meridians;
    if (ms.length > slotIndex) return { realm: r, name: ms[slotIndex].name };
  }
  return null;
}

// ── 纯视图模型 ──

export interface MandalaInput {
  realm: number;
  dantian: number;
  breakCost: number | null;
  chargeHighWater: number;
  chongxueChances: number;
  qishi: number;
  acupointProgress: Record<string, AcupointState>;
}

export interface MandalaAcupoint {
  id: string; name: string; opened: boolean; failCount: number;
  /** 当前成功率（含气势加成，design.md §3.3） */
  rate: number;
  /** 可冲穴：未通且尚有冲穴机会——有机会时才显示成功率，避免常驻噪声 */
  actionable: boolean;
}

export type MandalaSlot =
  | { locked: true; name: string; unlockRealm: number | null }
  | {
      locked: false; id: string; name: string; through: boolean;
      openedCount: number; total: number; acupoints: MandalaAcupoint[];
    };

export interface MandalaModel {
  n: number;
  cost: number;
  dantianShown: number;
  /** 每段：filled 为该段填充比例（0–1），pearl 为高水位印记 */
  segments: { filled: number; pearl: boolean }[];
  centerText: string;
  slots: MandalaSlot[];
  chances: number;
  statusText: string;
}

export function buildMandalaModel(s: MandalaInput): MandalaModel | null {
  if (s.breakCost === null) return null;   // 境界圆满：无周天可运转

  const n = REALMS[s.realm - 1].zhoutianCount ?? CHARGE_SEGMENTS;
  const p = zhoutianProgress(s.dantian, s.breakCost, n);
  const qishiBonus = qishiToBonus(s.qishi);
  const openedIds = new Set(
    Object.entries(s.acupointProgress).filter(([, a]) => a.opened).map(([id]) => id)
  );
  const meridians = REALM_ACUPOINTS[s.realm]?.meridians ?? [];
  const acupoints = REALM_ACUPOINTS[s.realm]?.acupoints ?? [];

  const segments = Array.from({ length: n }, (_, i) => ({
    filled: i < p.segmentsFull ? 1 : i === p.segmentsFull ? p.currentSegmentPct : 0,
    pearl: i < s.chargeHighWater,
  }));

  const slots: MandalaSlot[] = Array.from({ length: MAX_SLOTS }, (_, si) => {
    const m = meridians[si];
    if (!m) {
      const lock = slotUnlock(si);
      return { locked: true, name: lock?.name ?? '经脉', unlockRealm: lock?.realm ?? null };
    }
    return {
      locked: false,
      id: m.id,
      name: m.name,
      through: isMeridianComplete(m, openedIds),
      openedCount: m.acupointIds.filter(id => openedIds.has(id)).length,
      total: m.acupointIds.length,
      acupoints: m.acupointIds.map(aid => {
        const def = acupoints.find(a => a.id === aid)!;
        const st = s.acupointProgress[aid] ?? { failCount: 0, opened: false };
        return {
          id: aid,
          name: def.name,
          opened: st.opened,
          failCount: st.failCount,
          rate: currentSuccessRate(st, qishiBonus),
          actionable: !st.opened && s.chongxueChances > 0,
        };
      }),
    };
  });

  return {
    n,
    cost: s.breakCost,
    dantianShown: Math.min(s.dantian, s.breakCost),
    segments,
    centerText: p.ready
      ? `${CN[n]}周天圆满 · 丹田已满`                                   // 冻结文案 §2
      : `第${CN[p.segmentsFull + 1]}周天 ${Math.floor(p.currentSegmentPct * 100)}%`,
    slots,
    chances: s.chongxueChances,
    statusText: s.chongxueChances > 0
      ? `冲穴机会 ${s.chongxueChances} · 点亮窍穴以行气冲穴`
      : '冲穴机会不足 · 运转周天获取',                                  // 冻结文案 §1
  };
}

// ── 几何helpers ──

const rad = (deg: number) => (deg * Math.PI) / 180;
export const polar = (r: number, deg: number): [number, number] =>
  [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];

export function arcPath(r: number, deg0: number, deg1: number): string {
  const [x0, y0] = polar(r, deg0);
  const [x1, y1] = polar(r, deg1);
  const large = Math.abs(deg1 - deg0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}
export const arcLen = (r: number, spanDeg: number) => (Math.abs(spanDeg) / 360) * 2 * Math.PI * r;

/**
 * 窍穴名的排布：靠近水平方向的节点改用左右对齐、并贴近节点放置，
 * 否则径向外推的居中标签会压在节点上（真机截图暴露的问题）。
 */
export function acuLabelLayout(deg: number): { r: number; anchor: 'start' | 'end' | 'middle' } {
  const cos = Math.cos(rad(deg));
  if (cos > 0.35) return { r: R_M + 14, anchor: 'start' };
  if (cos < -0.35) return { r: R_M + 14, anchor: 'end' };
  return { r: R_ACU_LABEL, anchor: 'middle' };
}

/** 脉位 i 的中心角与展角（脉位数由 MAX_SLOTS 推导，增脉自动重排） */
export function slotGeometry(i: number): { mid: number; span: number } {
  return { mid: -90 + (360 * i) / MAX_SLOTS, span: 360 / MAX_SLOTS - SLOT_GAP_DEG };
}

