/**
 * 修炼面板（外视/内视星图式）纯视图模型 —— 权威来源：
 * docs/systems/zhoutian/spec.md §4（呈现方案）、design.md §3–§4（数值与突破条件）。
 * 实现基准原型：docs/design/zhoutian-composite-v3.html。
 *
 * 本模块只做几何与状态推导，不含 React / DOM 依赖，可单测。
 * 组件只负责把结果画出来，不再自己算任何位置或状态。
 */
import { CHARGE_SEGMENTS, currentSegmentNeili, zhoutianProgress } from '../engine/formulas';
import { REALMS } from '../engine/content';
import {
  REALM_ACUPOINTS, acupointPos, blockingPrevAcupoint, chongxueGate, currentSuccessRate,
  isMeridianComplete, neiliCostFor, openedInRealm, requiredMeridian, requiredMeridianOpened,
  type AcupointState, type ChongxueGate,
} from '../engine/acupoints';

// ── 几何常量（viewBox 400×500，器皿中心 CX/CY）──
export const VIEW_W = 400;
export const VIEW_H = 500;
export const CX = 200;
export const CY = 250;
/** 器皿半径 */
export const R_V = 124;
/** 月相串所在半径 */
export const R_MOON = R_V + 18;
/** 月相串张角（顶部居中） */
export const MOON_SPAN_DEG = 116;
/** 月轮精灵含光晕，图幅约为月盘直径的 1.7 倍 */
export const MOON_SPRITE_SCALE = 1.7;
/** 星曜精灵含灵气飘带，图幅远大于星芒本体 */
export const STAR_SPRITE_SCALE = 4.3;
/** 星等：窍穴星点的半径梯度，摆脱整齐划一的贴片感 */
const MAG = [5.4, 4.0, 6.0, 4.6];
/** 角度与半径的确定性抖动（由索引驱动，可复现），让星官不等距 */
const JIT_A = [4, -6, 2, -3];
const JIT_R = [0, 18, 7, 24];
/** 三个星官扇区：左下 / 右下 / 正下。境界 5 有三条经脉，两扇区不够用 */
const ZONES: readonly (readonly [number, number])[] = [[196, 250], [110, 164], [166, 194]];

export const polar = (r: number, deg: number): [number, number] => [
  CX + r * Math.cos(((deg - 90) * Math.PI) / 180),
  CY + r * Math.sin(((deg - 90) * Math.PI) / 180),
];

export interface SceneInput {
  realm: number;
  dantian: number;
  breakCost: number | null;
  chargeHighWater: number;
  acupointProgress: Record<string, AcupointState>;
}

/** 月相三态：晦月（未行）→ 上弦（当前）→ 满月（已圆满），spec §4.2 */
export type MoonPhase = 'new' | 'waxing' | 'full';
export interface SceneMoon { phase: MoonPhase; x: number; y: number; r: number; sprite: number }

/** 星曜三态：墨星（不可冲）/ 朱砂星（可冲）/ 金星（已通），spec §4.2 */
export type StarState = 'dim' | 'actionable' | 'opened';
export interface SceneStar {
  id: string; name: string; state: StarState;
  /** 成功率（位次基础值 + 失败累进），供 tooltip / 无障碍标签用 */
  rate: number;
  /** 冲一次要扣的真气（design.md §3.3），成败同扣 */
  neiliCost: number;
  /** 不可冲的具体原因——每个原因对应一条冻结文案，不能合并成 boolean */
  gate: ChongxueGate;
  /** gate = 'prev-unopened' 时，挡路的那个前穴名；否则 null */
  blockedBy: string | null;
  x: number; y: number; size: number; labelX: number; labelY: number;
}
export interface SceneMeridian {
  id: string; name: string; through: boolean;
  /** 星官连线（依次相连） */
  line: string;
  labelX: number; labelY: number;
  glowCx: number; glowCy: number;
  stars: SceneStar[];
}

export interface SceneModel {
  zhoutianCount: number;
  segmentsFull: number;
  currentSegmentPct: number;
  perSegment: number;
  /** 液面以上的留空百分比，直接喂给 CSS --empty */
  emptyPct: number;
  /** 气流周期（秒），境界与段进度越高越快 */
  qiSpeedSec: number;
  /** 器皿辉光强度，外视据此表达进度 */
  vesselGlow: number;
  /** 周身罡气不透明度：炉火纯青（境界 4）起显影 */
  auraOpacity: number;
  /** 人影底图亮度 */
  backdropBrightness: number;
  /** 经脉辉光不透明度 */
  qiOpacity: number;
  moons: SceneMoon[];
  meridians: SceneMeridian[];
  /** 当前段已蓄真气（冲穴从这里扣，design.md §2） */
  segmentNeili: number;
  /** 本境界已通窍穴数（加成口径；突破门槛见下三项） */
  openedThisRealm: number;
  poolSize: number;
  /** 突破必须贯通的经脉名（design.md §4）；本版境界 1/6/7 为 null */
  requiredMeridianName: string | null;
  /** 该脉已通 / 总穴数 */
  requiredMeridianOpened: number;
  requiredMeridianSize: number;
}

export function buildSceneModel(s: SceneInput): SceneModel | null {
  if (s.breakCost === null) return null;   // 境界圆满：无周天可运转

  const def = REALMS[s.realm - 1];
  const n = def.zhoutianCount ?? CHARGE_SEGMENTS;
  const p = zhoutianProgress(s.dantian, s.breakCost, n);
  const segmentQuota = s.breakCost / n;
  const segmentNeili = currentSegmentNeili(s.dantian, s.breakCost, n, s.chargeHighWater);
  const pct = p.currentSegmentPct;
  const totalPct = (p.segmentsFull + pct) / n;

  // 月相串：顶部均布。已缴=满月，当前=上弦，其余=晦月
  const moons: SceneMoon[] = Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 0 : -MOON_SPAN_DEG / 2 + (MOON_SPAN_DEG * i) / (n - 1);
    const [x, y] = polar(R_MOON, a);
    const phase: MoonPhase =
      i < p.segmentsFull ? 'full' : i === p.segmentsFull ? 'waxing' : 'new';
    return { phase, x, y, r: 7.5, sprite: 7.5 * 2 * MOON_SPRITE_SCALE };
  });

  const openedIds = new Set(
    Object.entries(s.acupointProgress).filter(([, a]) => a.opened).map(([id]) => id)
  );
  const data = REALM_ACUPOINTS[s.realm];
  const meridians: SceneMeridian[] = (data?.meridians ?? []).map((m, mi) => {
    const [a0, a1] = ZONES[mi] ?? ZONES[ZONES.length - 1];
    const stars: SceneStar[] = m.acupointIds.map((aid, ai) => {
      const acu = data!.acupoints.find(a => a.id === aid)!;
      const st = s.acupointProgress[aid] ?? { failCount: 0, opened: false };
      const mag = MAG[ai % MAG.length];
      const ang = a0 + ((a1 - a0) * (ai + 0.5)) / m.acupointIds.length + JIT_A[ai % JIT_A.length];
      const r = R_V + 28 + JIT_R[ai % JIT_R.length];
      const [x, y] = polar(r, ang);
      const [labelX, labelY] = polar(r + 25, ang);
      const gate = chongxueGate({
        realm: s.realm, acupointId: aid, progress: s.acupointProgress,
        chargeHighWater: s.chargeHighWater, zhoutianCount: n,
        segmentNeili, segmentQuota,
      });
      return {
        id: aid, name: acu.name,
        state: st.opened ? 'opened' : gate === 'ok' ? 'actionable' : 'dim',
        rate: currentSuccessRate(st, acupointPos(s.realm, aid)),
        neiliCost: neiliCostFor(s.realm, aid, segmentQuota),
        gate,
        blockedBy: gate === 'prev-unopened'
          ? blockingPrevAcupoint(s.realm, aid, s.acupointProgress)?.name ?? null
          : null,
        x, y, size: mag * STAR_SPRITE_SCALE, labelX, labelY,
      };
    });
    const line = stars.map((v, i) => `${i ? 'L' : 'M'} ${v.x.toFixed(1)} ${v.y.toFixed(1)}`).join(' ');
    const mid = (a0 + a1) / 2;
    // 经脉名必须让开窍穴名：窍穴名最远约在 R_V+77，与 R_V+78 几乎同半径，
    // 底部扇区会叠字；底部有纵向余量，单独外推。
    const [labelX, labelY] = polar(mid > 160 && mid < 200 ? R_V + 108 : R_V + 78, mid);
    return {
      id: m.id, name: m.name,
      through: isMeridianComplete(m, openedIds),
      line, labelX, labelY,
      glowCx: stars.reduce((a, v) => a + v.x, 0) / stars.length,
      glowCy: stars.reduce((a, v) => a + v.y, 0) / stars.length,
      stars,
    };
  });

  return {
    zhoutianCount: n,
    segmentsFull: p.segmentsFull,
    currentSegmentPct: pct,
    perSegment: s.breakCost / n,
    // 留 6% 底、8% 顶的呼吸空间，液面不完全贴边
    emptyPct: 92 - pct * 86,
    qiSpeedSec: +(4.0 - s.realm * 0.35 - pct * 0.6).toFixed(2),
    vesselGlow: +(0.14 + pct * 0.5).toFixed(2),
    auraOpacity: s.realm >= 4 ? +(0.15 + totalPct * 0.4).toFixed(2) : 0,
    backdropBrightness: +(0.52 + totalPct * 0.14 + s.realm * 0.02).toFixed(2),
    qiOpacity: +(0.25 + totalPct * 0.35).toFixed(2),
    moons,
    meridians,
    segmentNeili,
    openedThisRealm: openedInRealm(s.realm, s.acupointProgress),
    poolSize: def.acupointPoolSize ?? 0,
    requiredMeridianName: requiredMeridian(s.realm)?.name ?? null,
    requiredMeridianOpened: requiredMeridianOpened(s.realm, s.acupointProgress),
    requiredMeridianSize: requiredMeridian(s.realm)?.acupointIds.length ?? 0,
  };
}
