/**
 * 武学 —— 权威来源：docs/systems/wuxue-catalog/design.md（名录、触发求和、特效池、路数标签、兵器搭配）、
 * docs/systems/battle-loot/spec.md §3（五项参数、触发求和 75%、特效四档、熟练改耗气 / 触发 / 冷却）、§2.1（掉落）、
 * docs/systems/sect-neigong/spec.md §2.3 / §2.4 / §3（领悟、装配槽、顿悟）。
 * 参数一律读 data/wuxue-catalog.json（由 docs/systems/battle-loot/export_wuxue.py 从 sim 产物生成），禁止在此调参。
 * 第一批 66 门；第二批不进池、不上架。
 */
import type { RouteId } from './content';
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

export type WuxueSource = '书肆' | 'Boss' | '挂机' | '华山' | '少林' | '唐门' | '武当' | '峨眉' | '丐帮' | '崆峒' | '百蛊门' | '雁门世家';

export interface WuxueDef {
  id: WuxueId;
  name: string;
  quality: Quality;
  cat: WuxueCat;
  /** 路数：与所修内功同路数吃共鸣；null = 不吃任何共鸣 */
  route: RouteId | null;
  effect: FormEffect;
  /** 门派独门机制（蓄势 / 反震 / 引爆），不分档 */
  signature?: boolean;
  source: WuxueSource;
  /** 第 1 式倍率（相对普攻），往后每式 +0.04 */
  mult0: number;
  /** 每次出招耗真气（生疏口径） */
  cost: number;
  /** 这门武学对总触发率的贡献 */
  p: number;
  /** 出招后停几回合 */
  cd: number;
}

interface CatalogRow extends Omit<WuxueDef, 'route'> {
  route: string | null;
  forms?: string[];
  lines?: string[];
}
const ROWS = catalog.wuxue as CatalogRow[];

export const WUXUE: Record<WuxueId, WuxueDef> = Object.fromEntries(ROWS.map((r) => [r.id, {
  id: r.id, name: r.name, quality: r.quality, cat: r.cat, route: (r.route ?? null) as RouteId | null, effect: r.effect,
  ...(r.signature ? { signature: true } : {}), source: r.source, mult0: r.mult0, cost: r.cost, p: r.p, cd: r.cd,
}]));
export const WUXUE_IDS: WuxueId[] = ROWS.map((r) => r.id);
/** 第一批新增 52 门的式名与每式句子（现有 14 门仍在 formNames.ts / narration.ts） */
export const CATALOG_FORMS: Record<WuxueId, readonly string[]> = Object.fromEntries(ROWS.filter((r) => r.forms).map((r) => [r.id, r.forms!]));
export const CATALOG_LINES: Record<WuxueId, readonly string[]> = Object.fromEntries(ROWS.filter((r) => r.lines).map((r) => [r.id, r.lines!]));

// ---------------------------------------------------------------- 按品质的参数（sect-neigong/spec.md §2.2 / §2.3）

export interface QualityParams {
  forms: number;
  /** 秘籍自带前几式 */
  given: number;
  /** 单式累计出招 → 熟练 / 精通 / 圆熟 */
  shulian: [number, number, number];
  /** 新招每出一次招的基础顿悟概率 */
  dunwuP: number;
}

export const QUALITY_PARAMS: Record<Quality, QualityParams> = {
  寻常: { forms: 3, given: 1, shulian: [4, 10, 25], dunwuP: 0.25 },
  上乘: { forms: 5, given: 2, shulian: [5, 12, 28], dunwuP: 0.08 },
  绝学: { forms: 7, given: 3, shulian: [6, 15, 32], dunwuP: 0.05 },
};

export const MULT_STEP = 0.04;
export const QI_REGEN = 20;
export const RESONANCE_MULT = 1.1;
/** 总触发率上限（spec §3.3） */
export const TRIGGER_CAP: number = catalog.trigger_cap;
/** 前世领悟过的招式，顿悟概率 ×3（spec S4） */
export const PAST_LEARNED_MULT = 3;
/** 声望阁「师门指引」：武学新招顿悟概率翻倍（spec S9） */
export const SHIMEN_ZHIYIN_MULT = 2;
/** 转世带入下一世的熟练比例（spec §6.1） */
export const SHULIAN_CARRY = 0.5;

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

/** 练熟了更顺手（spec §3.6）：耗气倍率、触发几率加成、冷却减少 */
export interface ShulianMods { cost: number; p: number; cd: number }
const SHU = catalog.shulian as unknown as Record<string, [number, number, number]>;
export function shulianMods(tier: number): ShulianMods {
  const [cost, p, cd] = SHU[String(tier)] ?? SHU['0'];
  return { cost, p: 1 + p, cd };
}

/** 第 k 式的倍率（含共鸣；熟练不再加倍率） */
export function formMult(def: Pick<WuxueDef, 'mult0'>, k: number, resonance: boolean): number {
  return (def.mult0 + MULT_STEP * (k - 1)) * (resonance ? RESONANCE_MULT : 1);
}

/** 这一式实际耗气（取整）与冷却 */
export function formCost(def: Pick<WuxueDef, 'cost'>, tier: number): number {
  return Math.round(def.cost * shulianMods(tier).cost);
}
export function formCd(def: Pick<WuxueDef, 'cd'>, tier: number): number {
  return Math.max(1, def.cd - shulianMods(tier).cd);
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

/** 第 k 式的特效数值：第 1 式取本品质起档、末式取止档，中间线性插值；整数列四舍五入 */
export function effectValue(def: Pick<WuxueDef, 'quality' | 'effect'>, k: number): number {
  const vals = effectValues(def.effect);
  if (!vals) return 0;
  const n = QUALITY_PARAMS[def.quality].forms;
  const [lo, hi] = TIER_SPAN[def.quality];
  const t = n > 1 ? lo + ((hi - lo) * (k - 1)) / (n - 1) : lo;
  const i = Math.min(Math.floor(t), 3);
  const v = vals[i] + (vals[Math.min(i + 1, 3)] - vals[i]) * (t - i);
  const integer = vals.every((x) => Number.isInteger(x));
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
export function effectText(def: Pick<WuxueDef, 'quality' | 'effect'>, k: number): string {
  const v = effectValue(def, k);
  const shown = PCT_EFFECTS.has(def.effect) ? Math.round(v * 100) : v;
  if (def.effect === '附毒' && shown === 0) return '叠毒 +1 层';
  return EFFECT_SAY[def.effect].replace('{}', String(shown));
}

// ---------------------------------------------------------------- 领悟条件（spec §2.3）

export interface FormGate {
  realm: number;
  qi: number;
  /** 需要该式的招式秘籍（或拼齐的口诀） */
  scroll: boolean;
}

/** 自带之后各式的门槛；自带的式不在表里 */
export const FORM_GATES: Record<Quality, Record<number, FormGate>> = {
  寻常: { 2: { realm: 2, qi: 80, scroll: false }, 3: { realm: 2, qi: 95, scroll: false } },
  上乘: {
    3: { realm: 3, qi: 120, scroll: false },
    4: { realm: 4, qi: 150, scroll: true },
    5: { realm: 4, qi: 170, scroll: true },
  },
  绝学: {
    4: { realm: 3, qi: 140, scroll: false },
    5: { realm: 4, qi: 170, scroll: true },
    6: { realm: 5, qi: 210, scroll: true },
    7: { realm: 5, qi: 240, scroll: true },
  },
};

export interface FormGateCheck {
  realm: boolean;
  qi: boolean;
  scroll: boolean;
  prev: boolean;
  /** 全部满足：每出一次招判一次顿悟 */
  ready: boolean;
}

/**
 * 第 k 式的领悟条件逐条核对（spec §2.3）：境界、真气上限、招式秘籍 / 口诀、前一式熟练到「熟练」档。
 * 自带的式恒为已领悟，不走这里。
 */
export function checkFormGate(
  def: WuxueDef, k: number, realm: number, qiMax: number, hasScroll: boolean, prevCasts: number, benmen = false,
): FormGateCheck {
  const g = FORM_GATES[def.quality][k];
  const c = {
    realm: realm >= g.realm,
    qi: qiMax >= g.qi,
    scroll: !g.scroll || hasScroll,
    prev: shulianTier(def.quality, prevCasts, benmen) >= 1,
  };
  return { ...c, ready: c.realm && c.qi && c.scroll && c.prev };
}

/** 新招一次顿悟判定的成功概率 */
export function formDunwuChance(quality: Quality, wuxing: number, pastLearned: boolean, shimen: boolean): number {
  return Math.min(1, QUALITY_PARAMS[quality].dunwuP * wuxing
    * (pastLearned ? PAST_LEARNED_MULT : 1) * (shimen ? SHIMEN_ZHIYIN_MULT : 1));
}

// ---------------------------------------------------------------- 装配（spec §2.4，design.md §3.7 兵器搭配）

/** 装配槽跟境界走：境界 1 选定内功后 1 槽（battle-loot/design.md §5.3），逐境界 +1，境界 5 起 5 槽 */
export function slotCount(realm: number): number {
  return Math.min(5, Math.max(1, realm));
}

/** 手里的家伙：兵器类别与是否备着暗器 */
export interface Hands { weapon: WuxueCat | null; anqi: boolean }

/** 这门武学现在装得上吗：器械要拿同类兵器，暗器要暗器槽里有暗器，肉身不挑 */
export function usableWith(def: Pick<WuxueDef, 'cat'>, hands: Hands): boolean {
  const big = BIG_OF[def.cat];
  return big === '肉身' || (big === '暗器' ? hands.anqi : hands.weapon === def.cat);
}

// ---------------------------------------------------------------- 掉落（battle-loot/design.md §4，spec §2.1）

/** 每场胜利掉一次武学（整式 / 残页）的概率 */
export const WX_DROP_P = catalog.wx_p as Record<'normal' | 'elite' | 'boss', number>;
/** 每式要凑的残页数 */
export const PAGES_NEEDED = catalog.pages as Record<'上乘' | '绝学', number>;
/** 上乘残页进池的比例：境界 3 起三成、境界 4 起五成（spec §2.2） */
export function shangchengShare(realm: number): number {
  return realm >= 4 ? 0.5 : realm >= 3 ? 0.3 : 0;
}

export type WuxueDrop = { id: WuxueId; k: number; kind: 'book' | 'page' };

/** 掷一次武学掉落：寻常掉某一式全本，上乘掉某一式残页；绝学不进池（W2）。掉哪门、哪式纯随机（裁决 12） */
export function rollWuxueDrop(realm: number, kind: 'normal' | 'elite' | 'boss', rng: () => number): WuxueDrop | null {
  if (rng() >= WX_DROP_P[kind]) return null;
  const share = shangchengShare(realm);
  const quality: Quality = share > 0 && rng() < share ? '上乘' : '寻常';
  const pool = WUXUE_IDS.filter((id) => WUXUE[id].quality === quality);
  const id = pool[Math.floor(rng() * pool.length)];
  const k = 1 + Math.floor(rng() * QUALITY_PARAMS[quality].forms);
  return { id, k, kind: quality === '寻常' ? 'book' : 'page' };
}

/** 已拥有的全本 / 口诀（书匣）：全本键为 formKey；残页按 formKey 计数 */
export interface Satchel { books: readonly string[]; pages: Readonly<Record<string, number>> }

/** 这一式的口诀是否已拼齐（上乘 / 绝学） */
export function pagesFull(def: Pick<WuxueDef, 'quality'>, pages: Readonly<Record<string, number>>, id: WuxueId, k: number): boolean {
  return def.quality !== '寻常' && (pages[formKey(id, k)] ?? 0) >= PAGES_NEEDED[def.quality];
}

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

/** Boss 首次击杀（跨世只算第一次）必掉（spec §4.1 / §4.3）：键为前沿 `{图}-{难度}` */
export const BOSS_DROPS: Record<string, BossDrop> = {
  '1-0': { kind: 'wuxue', wuxue: 'jinghongjian' },
  '1-1': { kind: 'wuxue', wuxue: 'fuhuquan' },
  '2-0': { kind: 'neigong', which: 'own' },
  '3-0': { kind: 'wuxue', wuxue: 'feihuangshi' },
  '2-1': { kind: 'wuxue', wuxue: 'duanshuidao' },
  '1-2': { kind: 'neigong', which: 'other' },
};

/** 掉落物已拥有时改给的银两（书肆价的一成；非书肆货按上乘武学 3,000、上乘内功 5,000 折算） */
export const DUPLICATE_SILVER = { wuxue: 300, neigong: 500 } as const;
