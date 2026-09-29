/**
 * 武学 —— 权威来源：docs/systems/sect-neigong/spec.md §2（参数 / 熟练 / 领悟 / 装配 / 触发 / 特效 / 共鸣 / 名录）
 * 与 §3（顿悟）、§4（书肆 / Boss 掉落）。数值由 docs/systems/sect-neigong/sim.py 标定，禁止在此调参。
 * 招式名进文案冻结批次，本版以「第 N 式」占位。
 */
import type { RouteId } from './content';
import type { Quality } from './neigong';

export type WuxueId =
  | 'liuyunjian' | 'kaishanzhang' | 'xiulizhen' | 'xingzhegun'
  | 'jinghongjian' | 'fuhuquan' | 'feihuangshi' | 'duanshuidao'
  | 'cangyajianjue' | 'luoxingjian' | 'luohanfumogun' | 'xiangmochufa' | 'luoyingfeizhen' | 'qianjibiao';

/** 招式特效（spec §2.6）：前四种挂在第 1 式与末式，后三种是门派独门、每式都带 */
export type FormEffect = '必暴' | '附毒' | '护体' | '回气' | '蓄势' | '反震' | '引爆';

export type WuxueSource = '书肆' | 'Boss' | '华山' | '少林' | '唐门';

export interface WuxueDef {
  id: WuxueId;
  name: string;
  quality: Quality;
  category: string;
  /** 路数标签：与所修内功同路数吃共鸣；null = 不吃任何共鸣 */
  route: RouteId | null;
  effect: FormEffect;
  /** 门派独门机制：每一式都带特效 */
  signature?: boolean;
  source: WuxueSource;
}

export const WUXUE: Record<WuxueId, WuxueDef> = {
  liuyunjian:     { id: 'liuyunjian',     name: '流云剑',     quality: '寻常', category: '剑法', route: 'huashan', effect: '必暴', source: '书肆' },
  kaishanzhang:   { id: 'kaishanzhang',   name: '开山掌',     quality: '寻常', category: '拳掌', route: 'shaolin', effect: '护体', source: '书肆' },
  xiulizhen:      { id: 'xiulizhen',      name: '袖里针',     quality: '寻常', category: '暗器', route: 'tangmen', effect: '附毒', source: '书肆' },
  xingzhegun:     { id: 'xingzhegun',     name: '行者棍',     quality: '寻常', category: '棍法', route: null,      effect: '回气', source: '书肆' },
  jinghongjian:   { id: 'jinghongjian',   name: '惊鸿剑',     quality: '上乘', category: '剑法', route: 'huashan', effect: '回气', source: 'Boss' },
  fuhuquan:       { id: 'fuhuquan',       name: '伏虎拳',     quality: '上乘', category: '拳掌', route: 'shaolin', effect: '必暴', source: 'Boss' },
  feihuangshi:    { id: 'feihuangshi',    name: '飞蝗石',     quality: '上乘', category: '暗器', route: 'tangmen', effect: '护体', source: 'Boss' },
  duanshuidao:    { id: 'duanshuidao',    name: '断水刀',     quality: '上乘', category: '刀法', route: 'huashan', effect: '附毒', source: 'Boss' },
  cangyajianjue:  { id: 'cangyajianjue',  name: '苍崖剑诀',   quality: '绝学', category: '剑法', route: 'huashan', effect: '必暴', source: '华山' },
  luoxingjian:    { id: 'luoxingjian',    name: '落星剑',     quality: '绝学', category: '剑法', route: 'huashan', effect: '蓄势', signature: true, source: '华山' },
  luohanfumogun:  { id: 'luohanfumogun',  name: '罗汉伏魔棍', quality: '绝学', category: '棍法', route: 'shaolin', effect: '护体', source: '少林' },
  xiangmochufa:   { id: 'xiangmochufa',   name: '降魔杵法',   quality: '绝学', category: '杵法', route: 'shaolin', effect: '反震', signature: true, source: '少林' },
  luoyingfeizhen: { id: 'luoyingfeizhen', name: '落英飞针',   quality: '绝学', category: '暗器', route: 'tangmen', effect: '附毒', source: '唐门' },
  qianjibiao:     { id: 'qianjibiao',     name: '牵机镖',     quality: '绝学', category: '暗器', route: 'tangmen', effect: '引爆', signature: true, source: '唐门' },
};

export const WUXUE_IDS = Object.keys(WUXUE) as WuxueId[];

// ---------------------------------------------------------------- 参数（spec §2.1）

export interface QualityParams {
  forms: number;
  cost: number;
  /** 出招后这门武学停几回合 */
  cd: number;
  /** 第 1 式倍率（相对普攻） */
  mult0: number;
  /** 秘籍自带前几式 */
  given: number;
  /** 单式累计出招 → 熟练 / 精通 / 圆熟 */
  shulian: [number, number, number];
  /** 新招每出一次招的基础顿悟概率 */
  dunwuP: number;
}

export const QUALITY_PARAMS: Record<Quality, QualityParams> = {
  寻常: { forms: 3, cost: 25, cd: 2, mult0: 1.30, given: 1, shulian: [4, 10, 25], dunwuP: 0.25 },
  上乘: { forms: 5, cost: 40, cd: 3, mult0: 1.50, given: 2, shulian: [5, 12, 28], dunwuP: 0.08 },
  绝学: { forms: 7, cost: 55, cd: 4, mult0: 1.45, given: 3, shulian: [6, 15, 32], dunwuP: 0.05 },
};

export const MULT_STEP = 0.04;
export const SHULIAN_STEP = 0.07;
export const TRIGGER_RATE = 0.55;
export const QI_REGEN = 20;
export const RESONANCE_MULT = 1.1;
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

/** 熟练档：0 生疏 · 1 熟练 · 2 精通 · 3 圆熟 */
export function shulianTier(quality: Quality, casts: number): number {
  const th = QUALITY_PARAMS[quality].shulian;
  return casts >= th[2] ? 3 : casts >= th[1] ? 2 : casts >= th[0] ? 1 : 0;
}

/** 第 k 式的倍率（含熟练与共鸣） */
export function formMult(quality: Quality, k: number, casts: number, resonance: boolean): number {
  const p = QUALITY_PARAMS[quality];
  return (p.mult0 + MULT_STEP * (k - 1)) * (1 + SHULIAN_STEP * shulianTier(quality, casts)) * (resonance ? RESONANCE_MULT : 1);
}

/** 第 k 式是否带特效：门派独门每式都带，其余只在第 1 式与末式 */
export function formHasEffect(def: WuxueDef, k: number): boolean {
  return !!def.signature || k === 1 || k === QUALITY_PARAMS[def.quality].forms;
}

// ---------------------------------------------------------------- 领悟条件（spec §2.3）

export interface FormGate {
  realm: number;
  qi: number;
  /** 需要该式的招式秘籍 */
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
 * 第 k 式的领悟条件逐条核对（spec §2.3）：境界、真气上限、招式秘籍、前一式熟练到「熟练」档。
 * 自带的式恒为已领悟，不走这里。
 */
export function checkFormGate(
  def: WuxueDef, k: number, realm: number, qiMax: number, hasScroll: boolean, prevCasts: number,
): FormGateCheck {
  const g = FORM_GATES[def.quality][k];
  const c = {
    realm: realm >= g.realm,
    qi: qiMax >= g.qi,
    scroll: !g.scroll || hasScroll,
    prev: shulianTier(def.quality, prevCasts) >= 1,
  };
  return { ...c, ready: c.realm && c.qi && c.scroll && c.prev };
}

/** 新招一次顿悟判定的成功概率 */
export function formDunwuChance(quality: Quality, wuxing: number, pastLearned: boolean, shimen: boolean): number {
  return Math.min(1, QUALITY_PARAMS[quality].dunwuP * wuxing
    * (pastLearned ? PAST_LEARNED_MULT : 1) * (shimen ? SHIMEN_ZHIYIN_MULT : 1));
}

// ---------------------------------------------------------------- 装配（spec §2.4）

/** 装配槽跟境界走：境界 2 起 2 槽，逐境界 +1，境界 5 起 5 槽 */
export function slotCount(realm: number): number {
  return realm < 2 ? 0 : Math.min(5, realm);
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

/** 书肆货架（银两）：寻常武学、上乘招式秘籍；上乘内功那一件按「尚未拥有的第一部」动态给出 */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'book:liuyunjian', label: '流云剑', price: 150, realm: 2, kind: 'wuxue', wuxue: 'liuyunjian' },
  { id: 'book:kaishanzhang', label: '开山掌', price: 200, realm: 2, kind: 'wuxue', wuxue: 'kaishanzhang' },
  { id: 'book:xiulizhen', label: '袖里针', price: 250, realm: 2, kind: 'wuxue', wuxue: 'xiulizhen' },
  { id: 'book:xingzhegun', label: '行者棍', price: 300, realm: 2, kind: 'wuxue', wuxue: 'xingzhegun' },
  ...(['jinghongjian', 'fuhuquan', 'feihuangshi', 'duanshuidao'] as WuxueId[]).flatMap((w) => [4, 5].map((k) => ({
    id: `scroll:${formKey(w, k)}`, label: `${WUXUE[w].name} · ${formName(k)}`, price: 1500, realm: 4,
    kind: 'scroll' as const, wuxue: w, form: k,
  }))),
];
export const SHOP_NEIGONG_PRICE = 5000;
export const SHOP_NEIGONG_REALM = 5;
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
