/**
 * 战斗页美术挂接（docs/design/living-jianghu-prototype.html、DESIGN.md「江湖舆图与地域分图」「据点战斗页」「长卷对阵区」）。
 *
 * 图都在 public/art/ 下，由莉刻生成：
 * - 舆图 jianghu-map-2.jpg；地域分图 region/<卷>.jpg（据点直接画在地里，热区坐标按图标定）；
 * - 据点场景 scene/<图>.jpg：按路形模板图生图，路照模板走，关卡点坐标复用模板（A 照顾家绸庄、B 为 A 左右翻转、C 盘山路草图）；
 * - 守关人像 pt/<套>-<变体>.jpg（圆形头像）与 pt/ink-<套>.jpg（长卷像），按起名的那一套取，同一套里按人取变体。
 * 没出图的卷与据点走原型里的退路：放大的舆图 + 自动摆放的据点、墨线小路。
 */
import { mapDef, mapName } from '../../engine/enemies';

/** 中文关序：「第十二关」 */
const D = '〇一二三四五六七八九';
export const cnNum = (n: number) => {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  return (h ? D[h] + '百' : '') + (t ? (t === 1 && !h ? '' : D[t]) + '十' : h && o ? '零' : '') + (o ? D[o] : '');
};

export const WORLD_MAP = '/art/jianghu-map-2.jpg';

/** 十卷在舆图上的位置（% 坐标，按样张二调过） */
export const VOL_PINS: readonly (readonly [number, number])[] = [
  [69, 16], [67, 34], [74, 64], [88, 86], [48, 26], [42, 47], [22, 29], [16, 52], [26, 82], [14, 9],
];
/** 点卷放大的倍数 */
export const ZOOM_K = 3;

/** 地域分图：卷 → 图与各据点热区中心（%，按分图标定；键是图名） */
const REGIONS: Record<number, { art: string; spots: Record<string, [number, number]> }> = {
  1: { art: '/art/region/qilu.jpg', spots: { 泰安古道: [18.5, 55], 野狐渡: [62.5, 30], 乱石隘: [86, 68] } },
  2: {
    art: '/art/region/lianghuai.jpg',
    spots: { 淮扬驿路: [15, 14], 苍崖剑坊: [15, 43], 迎客峰: [16, 77], 运河漕渡: [47, 53], 千帆水寨: [77, 18], 芦荡蛇集: [86, 50], 腥风谷: [85, 80] },
  },
  3: {
    art: '/art/jianghu-region-jiangnan.jpg',
    spots: { 姑苏驿道: [14.5, 15], 云栈香市: [15, 40], 千岩山门: [13.5, 77], 顾家绸庄: [50, 21], 镜湖别业: [79, 23], 秦淮画舫: [47, 54], 十里花阵: [84, 78] },
  },
};

/** 一卷各据点在分图上的位置；没出分图的卷：赶路图在左，各家外围在上、门户在下 */
export function regionOf(vol: number, maps: readonly number[]): { art: string | null; spot: (map: number) => [number, number] } {
  const r = REGIONS[vol];
  if (r) return { art: r.art, spot: (m) => r.spots[mapName(m)] ?? [50, 50] };
  const chapters = [...new Set(maps.map((m) => mapDef(m).chapter).filter((c) => c > 0))];
  return {
    art: null,
    spot: (m) => {
      const d = mapDef(m);
      if (d.layer === 'road') return [16, 46];
      const i = chapters.indexOf(d.chapter);
      const x = 40 + (chapters.length > 1 ? i * (46 / (chapters.length - 1)) : 23);
      return [x, d.layer === 'outer' ? 30 : 70];
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 据点场景
// ─────────────────────────────────────────────────────────────

type Pt = readonly [number, number];
/** 路形 A：顾家绸庄场景里路上的 20 个落脚点（由近及远） */
const PATH_A: readonly Pt[] = [
  [9.5, 80], [12.5, 73], [16.5, 67], [22, 61.5], [28, 58.5], [35, 56.5], [42, 55], [49, 53.5], [57, 51], [72, 41.5],
  [77, 43], [81, 45], [83.5, 42.5], [85.5, 39.5], [87, 36.5], [88.5, 33.5], [90, 30.5], [91.2, 28.2], [92.2, 26.5], [92.5, 23.5],
];
/** 路形 C：盘山路草图（tpl-c）按弧长等分的 20 点 */
const PATH_C: readonly Pt[] = [
  [43.4, 81.7], [37.9, 78.0], [32.5, 73.6], [30.4, 66.6], [35.4, 61.2], [41.0, 57.9], [47.3, 56.0], [53.4, 54.8], [59.3, 53.6], [65.2, 51.9],
  [70.5, 47.8], [67.7, 41.8], [61.5, 39.5], [55.6, 37.7], [49.7, 35.6], [44.0, 33.5], [40.6, 28.6], [46.1, 24.3], [52.0, 21.1], [57.8, 18.8],
];
const PATHS: Record<'A' | 'B' | 'C', readonly Pt[]> = {
  A: PATH_A,
  B: PATH_A.map(([x, y]) => [100 - x, y] as const),
  C: PATH_C,
};

/** 据点场景：图名 → 文件与路形 */
const SCENES: Record<string, { file: string; path: 'A' | 'B' | 'C' }> = {
  泰安古道: { file: 'taian-gudao', path: 'A' }, 野狐渡: { file: 'yehudu', path: 'A' }, 乱石隘: { file: 'luanshi-ai', path: 'C' },
  淮扬驿路: { file: 'huaiyang-yilu', path: 'B' }, 苍崖剑坊: { file: 'cangya-jianfang', path: 'B' }, 迎客峰: { file: 'yingkefeng', path: 'B' },
  运河漕渡: { file: 'yunhe-caodu', path: 'A' }, 千帆水寨: { file: 'qianfan-shuizhai', path: 'B' },
  芦荡蛇集: { file: 'ludang-sheji', path: 'C' }, 腥风谷: { file: 'xingfeng-gu', path: 'C' },
  姑苏驿道: { file: 'gusu-yidao', path: 'B' }, 云栈香市: { file: 'yunzhan-xiangshi', path: 'A' }, 千岩山门: { file: 'qianyan-shanmen', path: 'C' },
  顾家绸庄: { file: 'guzhuang', path: 'A' }, 镜湖别业: { file: 'jinghu-bieye', path: 'B' },
  秦淮画舫: { file: 'qinhuai-huafang', path: 'A' }, 十里花阵: { file: 'shili-huazhen', path: 'C' },
};

/**
 * 沿折线按画面上的弧长等分取 n 个点（图里关数 11–20 不等）。
 * 模板点本身疏密不匀（远处台阶挤在一起），一律重取，各关在画面上间距相同。
 */
function resample(pts: readonly Pt[], n: number): Pt[] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], (p[1] - pts[i][1]) * 0.5625));
  const total = seg.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, k) => {
    let d = n > 1 ? (total * k) / (n - 1) : 0;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t] as const;
  });
}

/** 场景图与关卡点；路形 B 的路收在左上，标题改放右上 */
export function sceneOf(map: number, stages: number): { art: string; pts: Pt[]; headRight: boolean } | null {
  const s = SCENES[mapName(map)];
  return s ? { art: `/art/scene/${s.file}.jpg`, pts: resample(PATHS[s.path], stages), headRight: s.path === 'B' } : null;
}

// ─────────────────────────────────────────────────────────────
// 守关人像
// ─────────────────────────────────────────────────────────────

type Style = 'mang' | 'zheng' | 'xie' | 'fo' | 'ni' | 'dao' | 'clan' | 'nv' | 'jun' | 'yelan';
const PORTRAITS: Record<Style, { m: string[]; f: string[]; ink: string | null; inkF: string | null }> = {
  mang: { m: ['mang-a', 'mang-b'], f: ['mang-f'], ink: 'mang', inkF: null },
  zheng: { m: ['zheng-a', 'zheng-b'], f: ['zheng-f'], ink: 'zheng', inkF: null },
  xie: { m: ['xie-a', 'xie-b'], f: ['xie-f'], ink: 'xie', inkF: null },
  fo: { m: ['fo-a', 'fo-b'], f: [], ink: 'fo', inkF: null },
  ni: { m: [], f: ['ni-a'], ink: null, inkF: 'ni' },
  dao: { m: ['dao-a'], f: [], ink: 'dao', inkF: null },
  clan: { m: ['clan-a', 'clan-b'], f: [], ink: 'clan', inkF: null },
  nv: { m: [], f: ['nv-a', 'nv-b'], ink: null, inkF: 'nv' },
  jun: { m: ['jun-a'], f: [], ink: 'jun', inkF: null },
  yelan: { m: ['yelan-a'], f: [], ink: 'yelan', inkF: null },
};

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

/** 守关人：头像与长卷像（缺长卷像时为 null，对阵区用头像去色代替） */
export function portraitOf(style: string, female: boolean, who: string): { pt: string; cap: string | null } {
  const set = PORTRAITS[style as Style] ?? PORTRAITS.zheng;
  const pool = (female ? set.f : set.m).length ? (female ? set.f : set.m) : [...set.m, ...set.f];
  const key = pool[hash(who) % pool.length];
  const ink = female ? set.inkF : set.ink;
  return { pt: `/art/pt/${key}.jpg`, cap: ink ? `/art/pt/ink-${ink}.jpg` : null };
}

/** 普通敌人与玩家自己 */
export const FOE_PT = '/art/scene/p-guard.png';
export const FOE_CAP = '/art/scene/duel-foe.jpg';
export const HERO_PT = '/art/scene/p-hero.png';
export const HERO_CAP = '/art/scene/duel-hero.jpg';
