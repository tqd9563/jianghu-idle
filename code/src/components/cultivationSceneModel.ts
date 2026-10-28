/**
 * 修炼页纯视图模型 —— 权威来源：
 * docs/systems/zhoutian/spec.md §4（呈现方案）、design.md §3–§4（数值与突破条件）。
 * 实现基准原型：docs/design/cultivate-redesign-prototype.html（修炼页改版，2026-10-27 定稿）。
 *
 * 本模块只做几何与状态推导，不含 React / DOM 依赖，可单测。
 * 组件只负责把结果画出来，不再自己算任何位置或状态。
 */
import { zhoutianProgress, currentSegmentNeili, currentSegmentQuota } from '../engine/formulas';
import { REALMS } from '../engine/content';
import {
  REALM_ACUPOINTS, acupointBonus, acupointPos, blockingPrevAcupoint, chongxueGate, currentSuccessRate,
  isMeridianComplete, meridianBonus, neiliCostFor, openedInRealm, requiredMeridian, requiredMeridianOpened,
  type AcupointState, type ChongxueGate,
} from '../engine/acupoints';

// ── 内景图坐标系：public/zhoutian/inner-jing.jpg 按 768×1024 计 ──
export const INNER_W = 768;
export const INNER_H = 1024;

type Pt = [number, number];
/** 窍穴落在身上的位置；第三项为穴名落在左 / 右 */
const ACU_AT: Record<string, [number, number, 'l' | 'r']> = {
  // 境界 1 · 手太阴：肩前 → 肘 → 腕（左臂）
  zhongfu: [285, 398, 'r'], chize: [222, 512, 'l'], taiyuan: [188, 628, 'l'],
  // 境界 2 · 手阳明（左臂）/ 手少阴（右臂）
  quchi: [218, 505, 'l'], hegu: [178, 645, 'l'], shaohai: [548, 505, 'r'], shenmen: [588, 640, 'r'],
  // 境界 3 · 足阳明 / 足太阴（两腿）
  futu: [255, 668, 'l'], zusanli: [178, 708, 'l'], fenglong: [275, 758, 'l'],
  xuehai: [515, 668, 'r'], sanyinjiao: [480, 758, 'r'],
  // 境界 4 · 任脉（前中线）/ 足少阴（左足）
  guanyuan: [384, 655, 'r'], qihai: [384, 548, 'r'], danzhong: [384, 440, 'r'],
  yongquan: [300, 778, 'l'], taixi: [238, 748, 'l'], fuliu: [205, 708, 'l'],
  // 境界 5 · 督脉（脊）/ 冲脉（腹前）/ 带脉（腰）
  mingmen: [395, 528, 'r'], dazhui: [392, 355, 'r'], baihui: [386, 203, 'l'],
  henggu: [352, 668, 'l'], dahe: [330, 598, 'l'], youmen: [348, 470, 'l'],
  wushu: [236, 642, 'l'], weidao: [530, 642, 'r'],
};
/** 经脉沿身体的整条路线：窍穴 id 或途经点；经脉名的落点 */
const ROUTE: Record<string, { route: (string | Pt)[]; label: Pt }> = {
  shoutaiyin: { route: [[330, 380], 'zhongfu', [248, 455], 'chize', 'taiyuan', [175, 668]], label: [150, 560] },
  shouyangming: { route: [[300, 372], [250, 430], 'quchi', 'hegu', [160, 672]], label: [140, 560] },
  shoushaoyin: { route: [[470, 372], [520, 430], 'shaohai', 'shenmen', [606, 668]], label: [630, 560] },
  zuyangming: { route: [[330, 640], 'futu', [205, 682], 'zusanli', [215, 738], 'fenglong', [335, 772]], label: [150, 800] },
  zutaiyin: { route: [[440, 640], 'xuehai', [565, 684], [590, 708], [545, 740], 'sanyinjiao', [425, 772]], label: [612, 800] },
  renmai: { route: [[384, 700], 'guanyuan', 'qihai', 'danzhong', [384, 370]], label: [470, 500] },
  zushaoyin: { route: [[340, 790], 'yongquan', 'taixi', 'fuliu', [215, 660]], label: [150, 800] },
  dumai: { route: [[388, 598], 'mingmen', [398, 450], 'dazhui', [432, 325], [440, 262], [416, 214], 'baihui'], label: [500, 285] },
  chongmai: { route: [[372, 700], 'henggu', 'dahe', [332, 530], 'youmen', [366, 418]], label: [285, 420] },
  daimai: { route: [[205, 652], 'wushu', [300, 630], [385, 624], [470, 630], 'weidao', [560, 652]], label: [384, 820] },
};

export interface SceneInput {
  realm: number;
  dantian: number;
  breakCost: number | null;
  chargeHighWater: number;
  acupointProgress: Record<string, AcupointState>;
}

/** 窍穴三态：墨圈（不可冲）/ 朱砂圈（可冲）/ 太极（已通），spec §4.2 */
export type StarState = 'dim' | 'actionable' | 'opened';
export interface SceneStar {
  id: string; name: string; state: StarState;
  /** 成功率（位次基础值 + 失败累进） */
  rate: number;
  /** 冲一次要扣的内力（design.md §3.3），成败同扣 */
  neiliCost: number;
  /** 不可冲的具体原因——每个原因对应一条冻结文案，不能合并成 boolean */
  gate: ChongxueGate;
  /** gate = 'prev-unopened' 时，挡路的那个前穴名；否则 null */
  blockedBy: string | null;
  /** 在内景图上的位置（INNER_W × INNER_H） */
  x: number; y: number; side: 'l' | 'r';
}
export interface SceneMeridian {
  id: string; name: string; through: boolean;
  /** 本境界突破须贯通的那条 */
  required: boolean;
  /** 沿身体的整条路线（含窍穴点） */
  route: Pt[];
  /** 已通的那段路线（通到哪穴亮到哪，贯通则整条）；无则空 */
  litRoute: Pt[];
  label: Pt;
  stars: SceneStar[];
}

export interface SceneModel {
  zhoutianCount: number;
  segmentsFull: number;
  /** 本段进度 0–1；丹田满时为 0，渲染层按 segmentsFull 走「圆满」 */
  currentSegmentPct: number;
  /** 整体进度 0–1 */
  totalPct: number;
  meridians: SceneMeridian[];
  /** 本境界已通窍穴数（突破与账目口径） */
  openedThisRealm: number;
  poolSize: number;
  /** 每通一穴、每贯通一脉加在气血攻防上的比例 */
  perAcupoint: number;
  perMeridian: number;
  /** 突破必须贯通的经脉名（design.md §4） */
  requiredMeridianName: string | null;
  requiredMeridianOpened: number;
  requiredMeridianSize: number;
}

export function buildSceneModel(s: SceneInput): SceneModel | null {
  if (s.breakCost === null) return null;   // 境界圆满：无周天可运转

  const def = REALMS[s.realm - 1];
  const n = def.zhoutianCount!;
  const p = zhoutianProgress(s.dantian, s.breakCost, n);
  const segmentQuota = currentSegmentQuota(s.breakCost, n, s.chargeHighWater);
  const segmentNeili = currentSegmentNeili(s.dantian, s.breakCost, n, s.chargeHighWater);
  const openedIds = new Set(
    Object.entries(s.acupointProgress).filter(([, a]) => a.opened).map(([id]) => id)
  );
  const data = REALM_ACUPOINTS[s.realm];
  const req = requiredMeridian(s.realm);

  const meridians: SceneMeridian[] = (data?.meridians ?? []).map(m => {
    const stars: SceneStar[] = m.acupointIds.map(aid => {
      const acu = data!.acupoints.find(a => a.id === aid)!;
      const st = s.acupointProgress[aid] ?? { failCount: 0, opened: false };
      const gate = chongxueGate({
        realm: s.realm, acupointId: aid, progress: s.acupointProgress,
        chargeHighWater: s.chargeHighWater, zhoutianCount: n, segmentNeili, segmentQuota,
      });
      const [x, y, side] = ACU_AT[aid];
      return {
        id: aid, name: acu.name,
        state: st.opened ? 'opened' : gate === 'ok' ? 'actionable' : 'dim',
        rate: currentSuccessRate(st, acupointPos(s.realm, aid)),
        neiliCost: neiliCostFor(s.realm, aid, segmentQuota),
        gate,
        blockedBy: gate === 'prev-unopened' ? blockingPrevAcupoint(s.realm, aid, s.acupointProgress)?.name ?? null : null,
        x, y, side,
      };
    });
    const r = ROUTE[m.id];
    const route = r.route.map((pt): Pt => (typeof pt === 'string' ? [ACU_AT[pt][0], ACU_AT[pt][1]] : pt));
    const at = r.route.flatMap((pt, i) => (typeof pt === 'string' ? [i] : []));
    const litN = stars.findIndex(v => v.state !== 'opened');
    const lit = litN < 0 ? stars.length : litN;
    // 通到第 k 穴：亮到第 k 穴在路线上的位置；整条贯通则亮到路线末端
    const litRoute = lit === 0 ? [] : route.slice(0, (lit === stars.length ? route.length - 1 : at[lit - 1]) + 1);
    return {
      id: m.id, name: m.name, through: isMeridianComplete(m, openedIds), required: req?.id === m.id,
      route, litRoute, label: r.label, stars,
    };
  });

  return {
    zhoutianCount: n,
    segmentsFull: p.segmentsFull,
    currentSegmentPct: p.currentSegmentPct,
    totalPct: p.segmentsFull >= n ? 1 : (p.segmentsFull + p.currentSegmentPct) / n,
    meridians,
    openedThisRealm: openedInRealm(s.realm, s.acupointProgress),
    poolSize: def.acupointPoolSize ?? 0,
    perAcupoint: acupointBonus(s.realm),
    perMeridian: meridianBonus(s.realm),
    requiredMeridianName: req?.name ?? null,
    requiredMeridianOpened: requiredMeridianOpened(s.realm, s.acupointProgress),
    requiredMeridianSize: req?.acupointIds.length ?? 0,
  };
}

/** 进入内视默认选中的穴：破境那条脉上第一个可冲 → 任一可冲 → 破境脉上第一个未通 → 第一穴 */
export function defaultSelection(m: SceneModel): string | null {
  const all = m.meridians.flatMap(x => x.stars.map(st => ({ st, req: x.required })));
  if (all.length === 0) return null;
  const pick = all.find(v => v.req && v.st.state === 'actionable')
    ?? all.find(v => v.st.state === 'actionable')
    ?? all.find(v => v.req && v.st.state !== 'opened')
    ?? all.find(v => v.st.state !== 'opened')
    ?? all[0];
  return pick.st.id;
}

/** 过点的柔和曲线（Catmull-Rom → 三次贝塞尔），给经脉路线用 */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${+c1x.toFixed(1)} ${+c1y.toFixed(1)} ${+c2x.toFixed(1)} ${+c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** 月相受光区：右半圆 + 晨昏线（半椭圆），f 为本段进度 0–1，半径 r，圆心在原点 */
export function moonLitPath(f: number, r = 100): string {
  if (f <= 0.001) return '';
  if (f >= 0.999) return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  const rx = +(Math.abs(1 - 2 * f) * r).toFixed(2), sweep = f < 0.5 ? 0 : 1;
  return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${sweep} 0 ${-r} Z`;
}

/** 一串小月：第 i 段的位置（上弧，半径 R）与受光比例 */
export function moonArc(n: number, segmentsFull: number, segPct: number, R: number): { x: number; y: number; lit: number }[] {
  const span = n <= 4 ? 84 : 130;
  return Array.from({ length: n }, (_, i) => {
    const a = ((-span / 2 + span * (n === 1 ? 0.5 : i / (n - 1)) - 90) * Math.PI) / 180;
    return { x: +(R * Math.cos(a)).toFixed(1), y: +(R * Math.sin(a)).toFixed(1), lit: i < segmentsFull ? 1 : i === segmentsFull ? segPct : 0 };
  });
}

// ── 外视版面：画按舞台高铺满，先保人物整身；月在人与题跋之间，放不下就挪到题跋上方 ──
/** 人物在场景画幅里的横向范围、丹田位置（public/art/cultivate-scene.jpg，16:9） */
export const SCENE_FIG: Pt = [0.15, 0.37];
export const SCENE_QI: Pt = [0.266, 0.608];
const RIGHT = 40;      // 题跋离舞台右缘
const LEDGER_W = 270;  // 内视账目宽

export interface CultLayout {
  artLeft: number; artW: number;
  moon: { x: number; y: number; d: number };
  text: { w: number; top: number };
  featherPct: number;
  inner: { left: number; top: number; h: number };
}
export function cultLayout(W: number, H: number): CultLayout {
  const aw = (H * 16) / 9;
  const tw = Math.max(270, Math.min(330, W * 0.32));
  const textLeft = W - RIGHT - tw;
  const artLeft = Math.max(-SCENE_FIG[0] * aw + 12, Math.min(-0.1 * aw, textLeft - 30 - SCENE_FIG[1] * aw - 0.16 * aw));
  const figR = artLeft + SCENE_FIG[1] * aw;
  let d = Math.min(240, Math.max(150, aw * 0.14));
  let moon: CultLayout['moon'], top: number;
  if (textLeft - figR >= d + 50) {
    moon = { x: (figR + textLeft) / 2, y: H * 0.27, d };
    top = H * 0.22;
  } else {
    d = Math.min(d, H * 0.19);
    const y = 30 + d * 0.62 + 34;
    moon = { x: textLeft + tw / 2, y, d };
    top = y + d / 2 + 54;
  }
  const avail = W - RIGHT - LEDGER_W - 20;
  const ih = Math.min(H, (avail / 0.75) * 1.05);
  return {
    artLeft, artW: aw, moon, text: { w: tw, top }, featherPct: Math.min(70, ((tw + 120) / W) * 100),
    inner: { left: Math.max(0, avail / 2 - ih * 0.375), top: (H - ih) / 2, h: ih },
  };
}
