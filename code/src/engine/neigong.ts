/**
 * 内功 —— 权威来源：docs/systems/sect-neigong/spec.md §1（名录 / 重数 / 台阶 / 真气 / 转修）与 §3（悟性与顿悟）。
 * 路数（惊雷 / 镇岳 / 蚀骨）沿用路线 id：huashan / shaolin / tangmen，路数参数仍在 routes.ts。
 * 寻常内功 = 原「招式十成 + 火候」构筑（spec §7 判据零），所以关卡与敌人不用重调。禁止在此调参。
 */
import { huohouRealms, type RouteId } from './content';
import { makeBuild, type Build } from './combat';

export type Quality = '寻常' | '上乘' | '绝学';
export type NeigongId =
  | 'jingleijue' | 'zhenyuegong' | 'shiguxinfa'
  | 'leimingjianjing' | 'panshigong' | 'xuanyinjue'
  | 'yuntaixinfa' | 'putixingong' | 'qianguxinjue';

export interface NeigongDef {
  id: NeigongId;
  name: string;
  quality: Quality;
  route: RouteId;
}

export const NEIGONG: Record<NeigongId, NeigongDef> = {
  jingleijue:      { id: 'jingleijue',      name: '惊雷诀',   quality: '寻常', route: 'huashan' },
  zhenyuegong:     { id: 'zhenyuegong',     name: '镇岳功',   quality: '寻常', route: 'shaolin' },
  shiguxinfa:      { id: 'shiguxinfa',      name: '蚀骨心法', quality: '寻常', route: 'tangmen' },
  leimingjianjing: { id: 'leimingjianjing', name: '雷鸣剑经', quality: '上乘', route: 'huashan' },
  panshigong:      { id: 'panshigong',      name: '磐石功',   quality: '上乘', route: 'shaolin' },
  xuanyinjue:      { id: 'xuanyinjue',      name: '玄阴诀',   quality: '上乘', route: 'tangmen' },
  yuntaixinfa:     { id: 'yuntaixinfa',     name: '云台心法', quality: '绝学', route: 'huashan' },
  putixingong:     { id: 'putixingong',     name: '菩提心功', quality: '绝学', route: 'shaolin' },
  qianguxinjue:    { id: 'qianguxinjue',    name: '千蛊心诀', quality: '绝学', route: 'tangmen' },
};

export const NEIGONG_IDS = Object.keys(NEIGONG) as NeigongId[];
export const QUALITY_ORDER: Quality[] = ['寻常', '上乘', '绝学'];

/** 某路数某品质的内功 */
export function neigongOf(route: RouteId, quality: Quality): NeigongId {
  return NEIGONG_IDS.find((id) => NEIGONG[id].route === route && NEIGONG[id].quality === quality)!;
}

/** 三部寻常内功：首世三选一 */
export const STARTER_NEIGONG: NeigongId[] = ['jingleijue', 'zhenyuegong', 'shiguxinfa'];

// ---------------------------------------------------------------- 重数（spec §1.2）

/** 第 n 重的内力价 = 3,490 × 1.08^(n−1)，与品质无关；四舍五入到整数 */
export function zhongCost(n: number): number {
  return Math.round(3490 * Math.pow(1.08, n - 1));
}

/** 火候每重折合境界数的品质倍率 */
export const HUOHOU_MULT: Record<Quality, number> = { 寻常: 1.0, 上乘: 1.02, 绝学: 1.04 };

/** 火候折合的境界数（含品质倍率） */
export function foldRealms(zhong: number, quality: Quality): number {
  return huohouRealms(zhong) * HUOHOU_MULT[quality];
}

// ---------------------------------------------------------------- 台阶（spec §1.3）

export type TierName = '登堂' | '入室' | '大成' | '化境' | '归真';

export interface TierDef {
  name: TierName;
  /** 跨阶所需重数 */
  at: number;
  /** 挂机每 10 分钟一判的基础顿悟概率 */
  p: number;
  /** 需卷册（归真） */
  scroll?: boolean;
  /** 各路数的质变说明（UI 用） */
  effect: Record<RouteId, string>;
}

export const TIERS: TierDef[] = [
  { name: '登堂', at: 2, p: 0.5, effect: { huashan: '剑意需求 5 → 4', shaolin: '开场护盾 +15pp', tangmen: '初始毒层 +2' } },
  { name: '入室', at: 4, p: 0.5, effect: { huashan: '剑招 400% → 550%', shaolin: '反伤 +15pp', tangmen: '毒层上限 8 → 10' } },
  { name: '大成', at: 6, p: 0.5, effect: { huashan: '剑意需求 → 3', shaolin: '气血 < 30% 受伤 −30%', tangmen: '毒爆 50% → 80%' } },
  { name: '化境', at: 20, p: 0.02, effect: { huashan: '剑招 +50pp', shaolin: '反伤 +5pp', tangmen: '毒伤系数 +3pp' } },
  { name: '归真', at: 40, p: 0.01, scroll: true, effect: { huashan: '暴伤 +20pp', shaolin: '开场护盾 +8pp', tangmen: '毒伤系数 +2pp' } },
];

/** 该品质有几级台阶：寻常 3、上乘 4、绝学 5 */
export const TIER_COUNT: Record<Quality, number> = { 寻常: 3, 上乘: 4, 绝学: 5 };

/** 顿悟一判的间隔（秒）：挂机修炼每 10 分钟 */
export const DUNWU_INTERVAL_SEC = 600;

/**
 * 升重是否被台阶挡住：重数到了下一台阶、但还没跨过去。
 * 返回 null = 不挡；否则返回挡住的台阶（及是否因缺卷册而连顿悟都判不了）。
 */
export function tierGate(
  quality: Quality, zhong: number, passed: number, hasScroll = false,
): { tier: TierDef; index: number; needScroll: boolean } | null {
  if (passed >= TIER_COUNT[quality]) return null;
  const tier = TIERS[passed];
  if (zhong < tier.at) return null;
  return { tier, index: passed, needScroll: !!tier.scroll && !hasScroll };
}

/** 一次顿悟判定的成功概率 = 基础概率 × 悟性 */
export function dunwuChance(tier: TierDef, wuxing: number): number {
  return Math.min(1, tier.p * wuxing);
}

// ---------------------------------------------------------------- 构筑

/**
 * 内功构筑：前三阶即原机制节点 1/2/3（makeBuild 的 nodes），火候按品质倍率放大，
 * 化境 / 归真在最外层改参数。寻常内功与 makeBuild 逐项一致。
 */
export function neigongBuild(id: NeigongId, realm: number, zhong: number, passed: number): Build {
  const ng = NEIGONG[id];
  const b = makeBuild(ng.route, realm, zhong, Math.min(passed, 3));
  const extra = huohouRealms(zhong) * (HUOHOU_MULT[ng.quality] - 1);
  if (extra > 0) {
    const k = Math.pow(1.7, extra);
    b.hp *= k; b.atk *= k; b.def *= k;
    b.hit += 12 * extra; b.dodge += 3 * extra;
  }
  if (passed >= 4) {
    if (ng.route === 'huashan') b.burstMult += 0.5;
    else if (ng.route === 'shaolin') b.thorns += 0.05;
    else b.poison = { ...b.poison, coef: b.poison.coef + 0.03 };
  }
  if (passed >= 5) {
    if (ng.route === 'huashan') b.cd += 0.2;
    else if (ng.route === 'shaolin') b.shieldPct += 0.08;
    else b.poison = { ...b.poison, coef: b.poison.coef + 0.02 };
  }
  return b;
}

// ---------------------------------------------------------------- 真气（spec §1.4）

export const QI_COEF: Record<Quality, number> = { 寻常: 1.0, 上乘: 1.1, 绝学: 1.2 };

/** 真气上限 = (70 + 15 × (境界 − 2) + 重数) × 品质系数 */
export function qiMax(realm: number, zhong: number, quality: Quality): number {
  return Math.round((70 + 15 * (Math.max(realm, 2) - 2) + zhong) * QI_COEF[quality]);
}

// ---------------------------------------------------------------- 转修（spec §1.5）

/** 同路数转修少掉的重数：保留八成累计内力 ≈ ln(1.25)/ln(1.08) ≈ 2.9 重 */
export const SAME_ROUTE_ZHONG_LOSS = 3;

/** 转修后的起始重数：同路数少 3 重，跨路数归零 */
export function zhongAfterSwitch(from: NeigongId, to: NeigongId, zhong: number): number {
  return NEIGONG[from].route === NEIGONG[to].route ? Math.max(0, zhong - SAME_ROUTE_ZHONG_LOSS) : 0;
}

/** 一世之内转修的银两手续费 = 境界 × 100 [待测试] */
export const switchFee = (realm: number) => realm * 100;

// ---------------------------------------------------------------- 悟性（spec §3）

export const WUXING_MIN = 0.8;
export const WUXING_MAX = 1.2;
/** 声望阁「武道笔记」：每世悟性 +0.1（spec S9） */
export const WUDAO_BIJI_WUXING = 0.1;

/** 新一世的悟性：0.8–1.2 均匀，保留两位小数 */
export function rollWuxing(rand: number, bonus = 0): number {
  return Math.round((WUXING_MIN + (WUXING_MAX - WUXING_MIN) * rand + bonus) * 100) / 100;
}
