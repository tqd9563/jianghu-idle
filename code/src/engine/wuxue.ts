/**
 * 武学 —— 权威来源：docs/systems/wuxue-catalog/design.md（名录、触发求和、特效池、路数标签、兵器搭配）、
 * docs/systems/battle-loot/spec.md §3（五项参数、触发求和 75%、特效四档、熟练改耗气 / 触发 / 冷却）、§2.1（掉落）、
 * docs/systems/battle-loot/design.md §4（一式一页、前式圆满接下式）、docs/systems/sect-neigong/spec.md §2.2 / §2.4（熟练、装配槽）。
 * 参数一律读 data/wuxue-catalog.json（由 docs/systems/battle-loot/export_wuxue.py 从 sim 产物生成），禁止在此调参。
 * 第一批 66 门；第二批不进池、不上架。
 */
import { QI_SCALE, type RouteId } from './content';
import type { Quality } from './neigong';
import catalog from './data/wuxue-catalog.json';

export type WuxueId = string;
export type WuxueCat = '剑' | '刀' | '枪' | '棍' | '拳' | '掌' | '指' | '腿' | '暗器';
export type WuxueBig = '器械' | '肉身' | '暗器';
/** 类目分三大类（design.md §3.7）：器械挑兵器，肉身不挑，暗器要暗器槽 */
export const BIG_OF: Record<WuxueCat, WuxueBig> = {
  剑: '器械', 刀: '器械', 枪: '器械', 棍: '器械', 拳: '肉身', 掌: '肉身', 指: '肉身', 腿: '肉身', 暗器: '暗器',
};
export const CAT_GROUPS: Record<WuxueBig, readonly WuxueCat[]> = { 器械: ['刀', '枪', '剑', '棍'], 肉身: ['拳', '掌', '指', '腿'], 暗器: ['暗器'] };

/** 招式特效：14 种通用（名录 §3.1）+ 3 种门派独门（§3.2） */
export type FormEffect = '必暴' | '回气' | '护体' | '附毒' | '回元' | '连击' | '运劲' | '凝眸' | '轻身'
  | '透劲' | '封穴' | '卸力' | '迷目' | '破绽' | '蓄势' | '反震' | '引爆';
/** 持续类特效（3 回合，同名只刷新不叠加） */
export const LASTING_EFFECTS: ReadonlySet<FormEffect> = new Set(['运劲', '凝眸', '轻身', '卸力', '迷目', '破绽']);
export const EFFECT_ROUNDS = 3;

/** 特点标签（名录 §3.3 W19）：一门一个，按特效归类 */
export type WuxueTag = '刚猛' | '绵长' | '守御' | '诡谲' | '阴毒';
export const EFFECT_TAG: Record<FormEffect, WuxueTag> = {
  必暴: '刚猛', 透劲: '刚猛', 连击: '刚猛', 蓄势: '刚猛', 反震: '刚猛',
  运劲: '绵长', 凝眸: '绵长', 轻身: '绵长',
  回气: '守御', 回元: '守御', 护体: '守御',
  封穴: '诡谲', 卸力: '诡谲', 迷目: '诡谲', 破绽: '诡谲',
  附毒: '阴毒', 引爆: '阴毒',
};

/** 来路：书肆 / Boss 首杀 / 挂机掉落 / 某家门派的货架（sect-overhaul/design.md §3 总表） */
export type WuxueSource = '书肆' | 'Boss' | '挂机' | '苍崖派' | '千岩寺' | '擎天门' | '花影坊' | '乾元观' | '苍梧派' | '千蛇窟' | '鸣沙教';

export interface WuxueDef {
  id: WuxueId;
  name: string;
  /** 批注：一联题词，书页左页标签下显示（docs/rules/copy/wuxue-epigraphs.md） */
  epigraph: string;
  quality: Quality;
  cat: WuxueCat;
  /** 路数：与所修内功同路数吃共鸣；null = 不吃任何共鸣 */
  route: RouteId | null;
  effect: FormEffect;
  /** 门派独门机制（蓄势 / 反震 / 引爆），不分档 */
  signature?: boolean;
  source: WuxueSource;
  /** 第 1 式倍率（相对普攻） */
  mult0: number;
  /** 各式倍率：每步约 ×MULT_GROWTH、按门固定浮动，首末式不动（裁决 46；calib_cast.py 生成） */
  mults: readonly number[];
  /** 每次出招耗真气（生疏口径） */
  cost: number;
  /** 这门武学对总触发率的贡献 */
  p: number;
  /** 出招后停几回合 */
  cd: number;
  /** 类型（裁决 46）：重击 = 高倍率弱特效 · 折中 · 双强 = 高倍率强特效 */
  type: WuxueType;
  /** 特效数值系数：重击 0.5 · 折中 1（倍率低的 1.25）· 双强 1.5 */
  ek: number;
}

export type WuxueType = '重击' | '折中' | '双强';

interface CatalogRow extends Omit<WuxueDef, 'route'> {
  route: string | null;
  forms?: string[];
  lines?: string[];
}
const ROWS = catalog.wuxue as CatalogRow[];

export const WUXUE: Record<WuxueId, WuxueDef> = Object.fromEntries(ROWS.map((r) => [r.id, {
  id: r.id, name: r.name, epigraph: r.epigraph, quality: r.quality, cat: r.cat, route: (r.route ?? null) as RouteId | null, effect: r.effect,
  ...(r.signature ? { signature: true } : {}), source: r.source, mult0: r.mult0, mults: r.mults, cost: r.cost * QI_SCALE, p: r.p, cd: r.cd,
  type: r.type, ek: r.ek,
}]));
export const WUXUE_IDS: WuxueId[] = ROWS.map((r) => r.id);
/** 第一批新增 52 门的式名与每式句子（现有 14 门仍在 formNames.ts / narration.ts） */
export const CATALOG_FORMS: Record<WuxueId, readonly string[]> = Object.fromEntries(ROWS.filter((r) => r.forms).map((r) => [r.id, r.forms!]));
export const CATALOG_LINES: Record<WuxueId, readonly string[]> = Object.fromEntries(ROWS.filter((r) => r.lines).map((r) => [r.id, r.lines!]));

// ---------------------------------------------------------------- 按品质的参数（sect-neigong/spec.md §2.2 / §2.3）

export interface QualityParams {
  forms: number;
  /** 单式累计出招 → 熟练 / 精通 / 圆熟（issue #79 按挂机节奏重标：寻常整门约半天、上乘约一天、绝学约三天） */
  shulian: [number, number, number];
}

export const QUALITY_PARAMS: Record<Quality, QualityParams> = {
  寻常: { forms: 3, shulian: [40, 100, 250] },
  上乘: { forms: 5, shulian: [50, 125, 300] },
  绝学: { forms: 7, shulian: [60, 150, 350] },
};

/** 每式倍率与基础耗气的倍数（裁决 46；calib_cast.py 定，读名录） */
const CALIB = (catalog as unknown as { calib: { mult_growth: number; cost_growth: number } }).calib;
export const MULT_GROWTH: number = CALIB.mult_growth;
export const COST_GROWTH: number = CALIB.cost_growth;
export const RESONANCE_MULT = 1.1;
/** 总触发率上限（spec §3.3） */
export const TRIGGER_CAP: number = catalog.trigger_cap;

export const SHULIAN_NAMES = ['生疏', '熟练', '精通', '圆熟'] as const;
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 招式键：`武学 id:式序`（式序从 1 起） */
export const formKey = (id: WuxueId, k: number) => `${id}:${k}`;
export const formName = (k: number) => `第${CN[k]}式`;

/** 门派本门小甜头（spec §5.4）：本门绝学武学的熟练阈值 ×0.8 */
export const BENMEN_SHULIAN = 0.8;

/** 熟练 / 精通 / 圆熟三档所需出招数；本门武学 ×0.8 后向上取整 */
export function shulianThresholds(quality: Quality, benmen = false): [number, number, number] {
  const th = QUALITY_PARAMS[quality].shulian;
  return benmen ? th.map((n) => Math.ceil(n * BENMEN_SHULIAN)) as [number, number, number] : th;
}

/** 熟练档：0 生疏 · 1 熟练 · 2 精通 · 3 圆熟 */
export function shulianTier(quality: Quality, casts: number, benmen = false): number {
  const th = shulianThresholds(quality, benmen);
  return casts >= th[2] ? 3 : casts >= th[1] ? 2 : casts >= th[0] ? 1 : 0;
}


/** 第 k 式的倍率（含共鸣；熟练不加倍率）：读名录的逐式倍率；没有时按第一式 × MULT_GROWTH^(k − 1) */
export function formMult(def: Pick<WuxueDef, 'mult0'> & { mults?: readonly number[] }, k: number, resonance: boolean): number {
  const m = def.mults?.[k - 1] ?? def.mult0 * MULT_GROWTH ** (k - 1);
  return m * (resonance ? RESONANCE_MULT : 1);
}

/** 熟练只减耗气（裁决 45）：生疏 / 熟练 / 精通 / 圆熟的耗气倍率 `[待 sim]` */
export const SHULIAN_COST: [number, number, number, number] = [1, 0.92, 0.84, 0.75];

/** 第 k 式未经熟练打折的基础耗气（抽式权重用它，不然练熟的招反而少出）；按 sim 尺度取整再 × QI_SCALE */
export function formBaseCost(def: Pick<WuxueDef, 'cost'>, k: number): number {
  return Math.round(def.cost / QI_SCALE * COST_GROWTH ** (k - 1)) * QI_SCALE;
}
/** 第 k 式实际耗气：基础耗气 × 熟练倍率（同样按 sim 尺度取整） */
export function formCost(def: Pick<WuxueDef, 'cost'>, k: number, tier: number): number {
  return Math.round(formBaseCost(def, k) / QI_SCALE * SHULIAN_COST[tier]) * QI_SCALE;
}
/** 冷却不再随熟练变（裁决 45） */
export function formCd(def: Pick<WuxueDef, 'cd'>): number {
  return Math.max(1, def.cd);
}

// ---------------------------------------------------------------- 特效分档（spec §3.4）

type EffectTable = Record<string, { n?: number } & Record<string, number[] | number | undefined>>;
const EFFECTS = catalog.effects as EffectTable;
const TIER_SPAN = catalog.tier_span as Record<Quality, [number, number]>;

/** 特效的数值列（四档 Ⅰ–Ⅳ）；独门三种没有 */
function effectValues(effect: FormEffect): number[] | null {
  const row = EFFECTS[effect];
  if (!row) return null;
  const key = Object.keys(row).find((k) => k !== 'n')!;
  return row[key] as number[];
}

/** 几率类特效（连击 / 封穴 / 附毒再 +1）乘系数后封顶 100% */
const PROB_EFFECTS = new Set<FormEffect>(['连击', '封穴', '附毒']);

/** 第 k 式的特效数值：第 1 式取本品质起档、末式取止档，中间线性插值，再乘类型系数（裁决 46）；整数列四舍五入 */
export function effectValue(def: Pick<WuxueDef, 'quality' | 'effect'> & { ek?: number }, k: number): number {
  const vals = effectValues(def.effect);
  if (!vals) return 0;
  const n = QUALITY_PARAMS[def.quality].forms;
  const [lo, hi] = TIER_SPAN[def.quality];
  const t = n > 1 ? lo + ((hi - lo) * (k - 1)) / (n - 1) : lo;
  const i = Math.min(Math.floor(t), 3);
  const raw = (vals[i] + (vals[Math.min(i + 1, 3)] - vals[i]) * (t - i)) * (def.ek ?? 1);
  const v = PROB_EFFECTS.has(def.effect) ? Math.min(1, raw) : raw;
  const integer = vals.every((x) => Number.isInteger(x));
  // 回元回的是真气点数，名录是 sim 尺度，取整后 × QI_SCALE
  if (def.effect === '回元') return Math.round(v) * QI_SCALE;
  return integer ? Math.round(v) : Math.round(v * 1000) / 1000;
}

/** 特效一句话（界面与悬停共用；{} 为本式数值） */
const EFFECT_SAY: Record<FormEffect, string> = {
  必暴: '必定会心 · 会心伤害 +{}%', 回气: '返还耗气 {}%', 护体: '护体 {}% 气血', 附毒: '叠毒 +1 层 · {}% 再 +1',
  运劲: '3 回合攻击 +{}%', 凝眸: '3 回合会心 +{} pp', 轻身: '3 回合闪避 +{}', 回元: '回真气 {}',
  连击: '{}% 追加一次普攻', 透劲: '无视防御 {}%', 封穴: '{}% 封穴', 卸力: '3 回合敌攻击 −{}%',
  迷目: '3 回合敌命中 −{}', 破绽: '3 回合敌防御 −{}%',
  蓄势: '本场每出过一招，本式倍率 +10%', 反震: '按攻击加防御计伤', 引爆: '引爆对方身上毒层',
};
const PCT_EFFECTS: ReadonlySet<FormEffect> = new Set(['必暴', '回气', '护体', '附毒', '运劲', '凝眸', '连击', '透劲', '封穴', '卸力', '破绽']);
export function effectText(def: Pick<WuxueDef, 'quality' | 'effect'> & { ek?: number }, k: number): string {
  const v = effectValue(def, k);
  const shown = PCT_EFFECTS.has(def.effect) ? Math.round(v * 100) : v;
  if (def.effect === '附毒' && shown === 0) return '叠毒 +1 层';
  return EFFECT_SAY[def.effect].replace('{}', String(shown));
}

// ---------------------------------------------------------------- 招式解锁（battle-loot/design.md §4）

/**
 * 能出的式：从第一式起逐式接续，第 k 式要「到手」且第 k − 1 式已圆满（熟练第 3 档）。
 * 到手：寻常得了这门就是整门；上乘 / 绝学一式一页，要有这一式的残页。中间缺一式，后面的都接不上。
 */
export function usableForms(
  def: Pick<WuxueDef, 'quality'>, has: (k: number) => boolean, casts: (k: number) => number, benmen = false,
): number[] {
  const out: number[] = [];
  for (let k = 1; k <= QUALITY_PARAMS[def.quality].forms; k++) {
    if (!has(k) || (k > 1 && shulianTier(def.quality, casts(k - 1), benmen) < 3)) break;
    out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------- 装配（spec §2.4，design.md §3.7 兵器搭配）

/** 传功选完内功后，前辈再授一门武学：拳、掌、腿各一门寻常，不挑兵器、特效各不相同（battle-loot/design.md §5.1） */
export const GIFT_WUXUE_OPTIONS: readonly WuxueId[] = ['luohanquan', 'kaishanzhang', 'xuanfengtui'];

/** 装配槽 = 境界 + 4：境界 1 传功后 5 槽，逐境界 +1（battle-loot/design.md §5.3） */
export function slotCount(realm: number): number {
  return Math.max(1, realm) + 4;
}

/** 手里的家伙：兵器类别与是否备着暗器 */
export interface Hands { weapon: WuxueCat | null; anqi: boolean }

/** 这门武学现在装得上吗：器械要拿同类兵器，暗器要暗器槽里有暗器，肉身不挑 */
export function usableWith(def: Pick<WuxueDef, 'cat'>, hands: Hands): boolean {
  const big = BIG_OF[def.cat];
  return big === '肉身' || (big === '暗器' ? hands.anqi : hands.weapon === def.cat);
}

// ---------------------------------------------------------------- 掉落（battle-loot/design.md §4，spec §2.1）

/** 每场胜利掉一次武学（整门 / 残页）的概率 */
export const WX_DROP_P = catalog.wx_p as Record<'normal' | 'elite' | 'boss', number>;
/** 上乘残页进池的比例：境界 3 起三成、境界 4 起五成（spec §2.2） */
export function shangchengShare(realm: number): number {
  return realm >= 4 ? 0.5 : realm >= 3 ? 0.3 : 0;
}

/** 寻常掉整门（k 恒为 1），上乘 / 绝学掉某一式的那一页 */
export type WuxueDrop = { id: WuxueId; k: number; kind: 'book' | 'page' };

/** 掷一次武学掉落：寻常掉整门，上乘掉某一式残页；绝学不进池（W2）。掉哪门、哪式纯随机（裁决 12） */
export function rollWuxueDrop(
  realm: number, kind: 'normal' | 'elite' | 'boss', rng: () => number,
  /** 侠名录：阅历线管寻常整门、残页线管残页；都为 1 时随机序列与旧版一致 */
  mult: { book: number; page: number } = { book: 1, page: 1 },
): WuxueDrop | null {
  const roll = rng();
  if (roll >= WX_DROP_P[kind] * Math.max(mult.book, mult.page)) return null;
  const share = shangchengShare(realm);
  const quality: Quality = share > 0 && rng() < share ? '上乘' : '寻常';
  if (roll >= WX_DROP_P[kind] * (quality === '寻常' ? mult.book : mult.page)) return null;
  const pool = WUXUE_IDS.filter((id) => WUXUE[id].quality === quality);
  const id = pool[Math.floor(rng() * pool.length)];
  if (quality === '寻常') return { id, k: 1, kind: 'book' };
  return { id, k: 1 + Math.floor(rng() * QUALITY_PARAMS[quality].forms), kind: 'page' };
}

/** 重复掉落折银两（裁决 17 改）：已有的寻常整门、已有的那一页 [待 sim] */
export const DUP_DROP_SILVER = { book: 30, page: 60 } as const;

// ---------------------------------------------------------------- 获取（spec §4）

export type ShopItemId = string;

export interface ShopItem {
  id: ShopItemId;
  label: string;
  price: number;
  /** 上架所需境界 */
  realm: number;
  kind: 'wuxue' | 'scroll' | 'neigong';
  wuxue?: WuxueId;
  form?: number;
}

/** 市集武馆（银两，裁决 31 / 35）：四门寻常武学全本；上乘招式秘籍与上乘内功已下架（残页靠挂机、内功靠 Boss）。新增寻常暂不上架（W9） */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'book:liuyunjian', label: WUXUE.liuyunjian.name, price: 150, realm: 1, kind: 'wuxue', wuxue: 'liuyunjian' },
  { id: 'book:kaishanzhang', label: WUXUE.kaishanzhang.name, price: 200, realm: 1, kind: 'wuxue', wuxue: 'kaishanzhang' },
  { id: 'book:xiulizhen', label: WUXUE.xiulizhen.name, price: 250, realm: 1, kind: 'wuxue', wuxue: 'xiulizhen' },
  { id: 'book:xingzhegun', label: WUXUE.xingzhegun.name, price: 300, realm: 1, kind: 'wuxue', wuxue: 'xingzhegun' },
];
/** 声望阁「轻装上路」：书肆八折（spec S9） */
export const QINGZHUANG_DISCOUNT = 0.8;

export type BossDrop = { kind: 'wuxue'; wuxue: WuxueId } | { kind: 'neigong'; which: 'own' | 'other' };

/**
 * Boss 首次击杀（跨世只算第一次）必掉（spec §4.1 / §4.3）：键为卷 `v{卷}`，该卷任一章门户 Boss 首杀即得。
 * 卷章图关改造时按原各前沿 Boss 所在的境界段改挂，内功两件对齐原来的境界门槛（节奏守卫实测：上乘内功早到 10 天会让境界 5 提前一周）：
 * 原 1-0 → 卷四；2-0（上乘内功）→ 卷六（境界 3 段门槛），1-1 → 卷五；1-2（他路上乘内功）→ 卷八（境界 4 段门槛），3-0、2-1 → 卷七、卷九
 */
export const BOSS_DROPS: Record<string, BossDrop> = {
  v4: { kind: 'wuxue', wuxue: 'jinghongjian' },
  v5: { kind: 'wuxue', wuxue: 'fuhuquan' },
  v6: { kind: 'neigong', which: 'own' },
  v7: { kind: 'wuxue', wuxue: 'feihuangshi' },
  v8: { kind: 'neigong', which: 'other' },
  v9: { kind: 'wuxue', wuxue: 'duanshuidao' },
};

/** 掉落物已拥有时改给的银两（书肆价的一成；非书肆货按上乘武学 3,000、上乘内功 5,000 折算） */
export const DUPLICATE_SILVER = { wuxue: 300, neigong: 500 } as const;
