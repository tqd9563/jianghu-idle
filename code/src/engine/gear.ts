/**
 * 装备 —— 权威来源：docs/systems/battle-loot/design.md §3（部位 / 型 / 品阶 / 词条 / 前缀 / 背包 / 每世清零）
 * 与 spec.md §1（基础属性 / 词条区间 / 出售价）、§2.1（掉落率与品阶权重）、§6（实装口径：开战前叠进构筑，fight() 不认识装备）。
 * 名表出自 docs/rules/copy/gear-names.md（一名一图，图在 public/art/gear/）。数值一律整数（裁决 37）。
 */
import type { Build } from './combat';
import { STAT_SCALE } from './content';

export type GearSlot = '兵器' | '暗器' | '衣甲' | '佩饰';
export type WeaponCat = '剑' | '刀' | '枪' | '棍';
export type GearGrade = 1 | 2 | 3 | 4 | 5;
export type AffixKey = 'atk' | 'crit' | 'cd' | 'hit' | 'boss' | 'hp' | 'def' | 'dodge' | 'qi' | 'wx';
export type BaseKey = '攻击' | '气血' | '防御' | '命中' | '闪避';

export const GEAR_SLOTS: readonly GearSlot[] = ['兵器', '暗器', '衣甲', '佩饰'];
export const WEAPON_CATS: readonly WeaponCat[] = ['剑', '刀', '枪', '棍'];
/** 品阶名（design.md 裁决 5；界面叫法见 DESIGN.md「装备品阶」） */
export const GRADE_NAMES = ['', '凡品', '精良', '上乘', '珍品', '极品'] as const;

/** 型（裁决 36）：每部位两型，0 / 1 对应名表的上下两行 */
export const FORM_NAMES: Record<GearSlot, readonly [string, string]> = {
  兵器: ['重型', '轻型'], 暗器: ['锐型', '准型'], 衣甲: ['厚型', '坚型'], 佩饰: ['命中型', '闪避型'],
};

export interface GearItem {
  id: string;
  slot: GearSlot;
  /** 兵器类别（只有兵器有，裁决 23） */
  cat?: WeaponCat;
  form: 0 | 1;
  grade: GearGrade;
  /** 装备等级 = 掉落关卡当量（内部数，界面不露出） */
  level: number;
  /** 物件名（不含前缀） */
  name: string;
  /** 道具图 key（public/art/gear/<key>.png） */
  img: string;
  base: Partial<Record<BaseKey, number>>;
  /** 词条：[词条, 整数数值]，百分比 / pp 按 1% 计，命中 / 闪避 / 真气按 1 计 */
  afx: [AffixKey, number][];
  /** 出售价（两） */
  sell: number;
  /** 新得（点开看过即清） */
  fresh: boolean;
}

// ---------------------------------------------------------------- 名表（gear-names.md v0.1）

type Named = readonly [name: string, key: string];
const N = (s: string): Named[] => s.split(' ').map((p) => { const [name, key] = p.split('/'); return [name, key] as const; });

const WEAPON_NAMES: Record<WeaponCat, readonly [Named[], Named[]]> = {
  剑: [N('铁剑/jian-tie 青锋剑/jian-qingfeng 玄铁剑/jian-xuantie 龙泉剑/jian-longquan 太阿剑/jian-taie'),
       N('柳叶剑/jian-liuye 青萍剑/jian-qingping 游龙剑/jian-youlong 幽兰剑/jian-youlan 湛卢剑/jian-zhanlu')],
  刀: [N('柴刀/dao-chai 朴刀/dao-pu 鬼头刀/dao-guitou 斩马刀/dao-zhanma 龙雀刀/dao-longque'),
       N('柳叶刀/dao-liuye 雁翎刀/dao-yanling 苗刀/dao-miao 绣春刀/dao-xiuchun 冷月刀/dao-lengyue')],
  枪: [N('白蜡枪/qiang-bailayan 铁枪/qiang-tie 点钢枪/qiang-diangang 虎头枪/qiang-hutou 霸王枪/qiang-bawang'),
       N('竹枪/qiang-zhu 梨花枪/qiang-lihua 银枪/qiang-yin 亮银枪/qiang-liangyin 龙胆枪/qiang-longdan')],
  棍: [N('齐眉棍/gun-qimei 铁棍/gun-tie 熟铜棍/gun-shutong 镔铁棍/gun-bintie 镇岳棍/gun-zhenyue'),
       N('竹棍/gun-zhu 白蜡棍/gun-baila 藤棍/gun-teng 乌木棍/gun-wumu 紫檀棍/gun-zitan')],
};
const OTHER_NAMES: Record<Exclude<GearSlot, '兵器'>, readonly [Named[], Named[]]> = {
  暗器: [N('铁蒺藜/anqi-jili 柳叶镖囊/anqi-liuye 透骨钉匣/anqi-tougu 飞蝗石囊/anqi-feihuang 暴雨梨花针/anqi-liha'),
         N('石囊/anqi-shi 梅花针筒/anqi-meihua 袖箭/anqi-xiujian 子母镖囊/anqi-zimu 满天花雨囊/anqi-mantian')],
  衣甲: [N('粗布短打/jia-cubu 皮甲/jia-pi 棉甲/jia-mian 虎皮甲/jia-hupi 乌金甲/jia-wujin'),
         N('麻衣/jia-mayi 锁子甲/jia-suozi 鳞甲/jia-lin 蝮蛇甲/jia-fushe 金丝软甲/jia-jinsi')],
  佩饰: [N('铜钱串/pei-tongqian 香囊/pei-xiangnang 青玉佩/pei-qingyu 翡翠扳指/pei-feicui 鹰眼坠/pei-yingyan'),
         N('平安符/pei-pingan 红绳/pei-hongsheng 白玉环/pei-baiyu 燕尾佩/pei-yanwei 踏雪铃/pei-taxue')],
};

/** 按部位（兵器再按类别）、型、品阶查名表 */
export function gearNameOf(slot: GearSlot, form: 0 | 1, grade: GearGrade, cat?: WeaponCat): Named {
  const rows = slot === '兵器' ? WEAPON_NAMES[cat ?? '剑'] : OTHER_NAMES[slot];
  return rows[form][grade - 1];
}

// ---------------------------------------------------------------- 词条（design.md §3.2，spec §1.2）

export const AFFIX_PREFIX: Record<AffixKey, string> = {
  atk: '锋锐', crit: '凌厉', cd: '穿心', hit: '精准', boss: '破军', hp: '强健', def: '坚韧', dodge: '轻灵', qi: '蕴气', wx: '通玄',
};
export const AFFIX_LABEL: Record<AffixKey, readonly [name: string, unit: string]> = {
  atk: ['攻击', '%'], crit: ['会心率', 'pp'], cd: ['会心伤害', 'pp'], hit: ['命中', ''], boss: ['对精英 / Boss 伤害', '%'],
  hp: ['气血', '%'], def: ['防御', '%'], dodge: ['闪避', ''], qi: ['真气上限', ''], wx: ['武学伤害', '%'],
};
export const AFFIX_POOL: Record<GearSlot, readonly AffixKey[]> = {
  兵器: ['atk', 'crit', 'cd', 'hit', 'boss'],
  暗器: ['crit', 'cd', 'hit', 'boss', 'wx'],
  衣甲: ['hp', 'def', 'dodge', 'qi'],
  佩饰: ['crit', 'hit', 'dodge', 'qi', 'wx'],
};
/** 白装区间；命中 / 闪避另乘 (1 + ℓ/5) */
const AFFIX_RANGE: Record<AffixKey, readonly [number, number]> = {
  atk: [1.7, 2.7], crit: [0.7, 1.1], cd: [1.7, 3.0], hit: [1.7, 2.7], boss: [2.0, 3.4],
  hp: [1.7, 2.7], def: [1.7, 2.7], dodge: [1.0, 1.7], qi: [3.4, 5.1], wx: [1.7, 2.7],
};
const LEVEL_SCALED: ReadonlySet<AffixKey> = new Set(['hit', 'dodge']);

/** 品阶系数（spec §1.1）：基础属性 / 词条取值 / 词条条数 / 出售倍率 */
const GRADE_BASE = [0, 1.0, 1.1, 1.2, 1.3, 1.4];
const GRADE_AFFIX = [0, 1.0, 1.2, 1.4, 1.6, 1.8];
const AFFIX_COUNT: readonly (readonly [number, number])[] = [[0, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 4]];
export const SELL_MULT = [0, 0.5, 1, 2, 5, 15];

// ---------------------------------------------------------------- 基础属性（spec §1.1）

const BASE_ATK = 10 * STAT_SCALE, BASE_HP = 100 * STAT_SCALE, BASE_DEF = 5 * STAT_SCALE;
const GEAR_RATIO = 0.034;
const FLOAT: readonly [number, number] = [0.90, 1.10];
const WEAPON_LIGHT_HIT = 0.4;

const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
const iv = (v: number) => Math.max(1, Math.round(v));

function rollBase(slot: GearSlot, form: 0 | 1, grade: GearGrade, level: number, rng: () => number): GearItem['base'] {
  const g = GRADE_BASE[grade];
  const curve = Math.pow(1.7, level - 1) * g;
  const lv = 1 + level / 5;
  const f = () => lerp(FLOAT, rng());
  switch (slot) {
    case '兵器': {
      const atk = GEAR_RATIO * BASE_ATK * curve * f() * (form === 0 ? 1.08 : 0.92);
      return form === 0 ? { 攻击: iv(atk) } : { 攻击: iv(atk), 命中: iv(WEAPON_LIGHT_HIT * g * lv * f()) };
    }
    case '暗器': {
      const atk = GEAR_RATIO * BASE_ATK * 0.5 * curve * f() * (form === 0 ? 1.15 : 0.85);
      const hit = 0.85 * g * f() * lv * (form === 0 ? 0.85 : 1.15);
      return { 攻击: iv(atk), 命中: iv(hit) };
    }
    case '衣甲': {
      const hp = GEAR_RATIO * BASE_HP * curve * f() * (form === 0 ? 1.15 : 0.85);
      const def = GEAR_RATIO * BASE_DEF * curve * f() * (form === 0 ? 0.85 : 1.15);
      return { 气血: iv(hp), 防御: iv(def) };
    }
    case '佩饰': {
      const v = iv(1.35 * g * f() * lv);
      return form === 0 ? { 命中: v } : { 闪避: v };
    }
  }
}

function rollAffixes(slot: GearSlot, grade: GearGrade, level: number, rng: () => number): [AffixKey, number][] {
  const [lo, hi] = AFFIX_COUNT[grade];
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const pool = [...AFFIX_POOL[slot]];
  const out: [AffixKey, number][] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    let v = lerp(AFFIX_RANGE[k], rng()) * GRADE_AFFIX[grade];
    if (LEVEL_SCALED.has(k)) v *= 1 + level / 5;
    out.push([k, iv(v)]);
  }
  return out;
}

export interface GearRollInput {
  slot?: GearSlot;
  /** 兵器类别；缺省随机（裁决 25） */
  cat?: WeaponCat;
  grade: GearGrade;
  /** 掉落关卡当量 */
  level: number;
  /** 掉落关卡首通银两（出售价基数） */
  clearSilver: number;
}

let nextId = 0;
/** 生成一件装备：部位 / 类别 / 型随机，品阶与等级由调用方定 */
export function rollGear(input: GearRollInput, rng: () => number): GearItem {
  const slot = input.slot ?? GEAR_SLOTS[Math.floor(rng() * GEAR_SLOTS.length)];
  const cat = slot === '兵器' ? input.cat ?? WEAPON_CATS[Math.floor(rng() * WEAPON_CATS.length)] : undefined;
  const form: 0 | 1 = rng() < 0.5 ? 0 : 1;
  const [name, img] = gearNameOf(slot, form, input.grade, cat);
  nextId += 1;
  return {
    id: `g${Date.now().toString(36)}${nextId.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    slot, ...(cat ? { cat } : {}), form, grade: input.grade, level: input.level, name, img,
    base: rollBase(slot, form, input.grade, input.level, rng),
    afx: rollAffixes(slot, input.grade, input.level, rng),
    sell: Math.max(1, Math.round(input.clearSilver * SELL_MULT[input.grade])),
    fresh: true,
  };
}

// ---------------------------------------------------------------- 掉落（spec §2.1）

export const DROP_RATE: Record<'normal' | 'elite' | 'boss', number> = { normal: 0.06, elite: 0.20, boss: 1 };
/** 入门关（图 1 初入前 6 关，content.md §2.0 v2.6）：传功后只出凡品、精良（裁决 19） */
export const INTRO_STAGES = 6;
export const isIntroStage = (map: number, tier: number, stage: number) => map === 1 && tier === 0 && stage <= INTRO_STAGES;

/** 品阶权重：pos = 关卡在本段里的位置（0 段首、1 段末） */
export function gradeWeights(pos: number): number[] {
  const p = Math.min(1, Math.max(0, pos));
  return [55 - 40 * p, 35, 8 + 14 * p, 0.06 + 0.18 * p, 0.01 + 0.03 * p];
}

export function rollGrade(pos: number, kind: 'normal' | 'elite' | 'boss', rng: () => number, intro = false): GearGrade {
  const w = gradeWeights(pos);
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  let g = 1;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) { g = i + 1; break; } }
  if (kind === 'boss' || (kind === 'elite' && rng() < 0.3)) g += 1;
  g = Math.min(5, g);
  if (intro) g = Math.min(2, g);
  return g as GearGrade;
}

// ---------------------------------------------------------------- 背包（design.md §3.5，DESIGN.md 行囊）

/** 形态格：列 × 行 */
export const GEAR_SHAPE: Record<GearSlot, readonly [number, number]> = { 兵器: [1, 3], 暗器: [1, 2], 衣甲: [2, 2], 佩饰: [1, 1] };
export const BAG_CELLS = 80;
export const cellsOf = (slot: GearSlot) => GEAR_SHAPE[slot][0] * GEAR_SHAPE[slot][1];
export const bagUsed = (bag: readonly GearItem[]) => bag.reduce((n, it) => n + cellsOf(it.slot), 0);
export const bagFits = (bag: readonly GearItem[], it: GearItem) => bagUsed(bag) + cellsOf(it.slot) <= BAG_CELLS;

// ---------------------------------------------------------------- 名字与数值

/** 词条相对白装区间中位的强度，用于前缀排序（数值从高到低，裁决 29） */
const affixStrength = ([k, v]: [AffixKey, number]) => v / ((AFFIX_RANGE[k][0] + AFFIX_RANGE[k][1]) / 2);

/** 前缀部分（「锋锐凌厉的」）；无词条为空串 */
export function gearPrefix(it: Pick<GearItem, 'afx'>): string {
  if (it.afx.length === 0) return '';
  return [...it.afx].sort((a, b) => affixStrength(b) - affixStrength(a)).map(([k]) => AFFIX_PREFIX[k]).join('') + '的';
}
/** 装备全名 = 前缀 + 物件名（design.md §3.1a） */
export const gearFullName = (it: Pick<GearItem, 'afx' | 'name'>) => gearPrefix(it) + it.name;

export const affixText = ([k, v]: [AffixKey, number]) => `${AFFIX_LABEL[k][0]} +${v}${AFFIX_LABEL[k][1]}`;

/** 一身装备的合计加成（spec §6：百分比乘进基础值，命中 / 闪避 / 真气相加） */
export interface GearBonus {
  atk: number; hp: number; def: number; hit: number; dodge: number;
  atkPct: number; hpPct: number; defPct: number;
  critPP: number; cdPP: number;
  /** 对精英 / Boss 伤害（比例） */
  hardPct: number;
  qi: number;
  /** 武学伤害（比例） */
  wxPct: number;
}

export type Worn = Partial<Record<GearSlot, GearItem>>;

export function gearBonusOf(worn: Worn | undefined): GearBonus {
  const b: GearBonus = { atk: 0, hp: 0, def: 0, hit: 0, dodge: 0, atkPct: 0, hpPct: 0, defPct: 0, critPP: 0, cdPP: 0, hardPct: 0, qi: 0, wxPct: 0 };
  for (const it of Object.values(worn ?? {})) {
    if (!it) continue;
    b.atk += it.base.攻击 ?? 0; b.hp += it.base.气血 ?? 0; b.def += it.base.防御 ?? 0;
    b.hit += it.base.命中 ?? 0; b.dodge += it.base.闪避 ?? 0;
    for (const [k, v] of it.afx) {
      switch (k) {
        case 'atk': b.atkPct += v / 100; break;
        case 'hp': b.hpPct += v / 100; break;
        case 'def': b.defPct += v / 100; break;
        case 'crit': b.critPP += v; break;
        case 'cd': b.cdPP += v; break;
        case 'hit': b.hit += v; break;
        case 'dodge': b.dodge += v; break;
        case 'boss': b.hardPct += v / 100; break;
        case 'qi': b.qi += v; break;
        case 'wx': b.wxPct += v / 100; break;
      }
    }
  }
  return b;
}

const CRIT_CAP = 0.8;
/** 装备叠进构筑（spec §6 apply_gear）：不穿装备时逐项不变 */
export function applyGearToBuild(build: Build, g: GearBonus): Build {
  return {
    ...build,
    atk: (build.atk + g.atk) * (1 + g.atkPct),
    hp: (build.hp + g.hp) * (1 + g.hpPct),
    def: (build.def + g.def) * (1 + g.defPct),
    hit: build.hit + g.hit,
    dodge: build.dodge + g.dodge,
    crit: Math.min(CRIT_CAP, build.crit + g.critPP / 100),
    cd: build.cd + g.cdPP / 100,
  };
}

/** 穿着中比较：背包这件是否比身上同部位的强（品阶高即算） */
export function betterThanWorn(it: GearItem, worn: Worn | undefined): boolean {
  const cur = worn?.[it.slot];
  return !cur || it.grade > cur.grade;
}
