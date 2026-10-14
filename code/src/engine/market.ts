/**
 * 市集与黑市 —— 权威来源：docs/systems/battle-loot/design.md 裁决 20 / 31–35（市集摊位、黑市解锁与蒙面货三条规矩）、
 * spec.md §4（市集第 8 关开张）、§7（定价与额度的实测复核，2026-10-14）。定价基数 = 已通关卡里最高的首通银两（gameStore priceBasisOf）。
 * 市集 = 武馆（四门寻常武学全本，见 wuxue.ts SHOP_ITEMS）+ 兵器铺 + 衣饰铺 + 药铺（留位）；黑市是市集的暗门。
 */
import { SELL_MULT, WEAPON_CATS, rollGear, type GearGrade, type GearItem, type GearSlot, type WeaponCat } from './gear';
import { QUALITY_PARAMS, WUXUE, WUXUE_IDS, type WuxueId } from './wuxue';

/** 市集开张：传功后，在第 8 关（含）以后首次战败时（spec §4 首次卡关中位数） */
export const MARKET_OPEN_STAGE = 8;
/** 黑市解锁：市集累计消费满此数的那一笔（实测第 10–13 天解锁，境界 3 中段；spec §7） */
export const BLACK_UNLOCK_SPENT = 10000;
/** 蒙面货：每轮几件、几小时换一轮、每世几次（裁决 40；spec §7） */
export const BLACK_PER_ROUND = 3;
export const BLACK_ROUND_H = 4;
export const BLACK_PER_LIFE = 20;
/** 保底：连开几件凡品后下一件必精良以上（不公示） */
export const BLACK_PITY = 3;

// ---------------------------------------------------------------- 兵器铺 / 衣饰铺（裁决 31）

/** 铺子定价 = 定价基数 × 倍率：凡品约半小时挂机银两、精良约两小时（spec §7；卖回铺子是 SELL_MULT 的 0.5 / 1） */
export const STALL_PRICE_MULT: Record<1 | 2, number> = { 1: 25, 2: 100 };

export interface MarketGood {
  id: string;
  slot: GearSlot;
  cat?: WeaponCat;
  grade: GearGrade;
  /** 展示用样品（属性取中位） */
  sample: GearItem;
  price: number;
}

/** 固定序列：型取第一型、属性取中位、词条数取区间下限 */
const midRng = () => {
  const seq = [0.1, 0.5, 0.5, 0.5, 0.0, 0.5, 0.5];
  let i = 0;
  return () => seq[Math.min(i++, seq.length - 1)];
};

/** 一件铺子货：按前沿当量与定价基数生成样品与价格 */
export function marketGood(slot: GearSlot, grade: 1 | 2, level: number, clearSilver: number, cat?: WeaponCat): MarketGood {
  const sample = rollGear({ slot, cat, grade, level, clearSilver }, midRng());
  return {
    id: `stall:${slot}:${cat ?? ''}:${grade}`, slot, ...(cat ? { cat } : {}), grade, sample,
    price: Math.max(1, Math.round(clearSilver * STALL_PRICE_MULT[grade])),
  };
}

/** 兵器铺：四类兵器与暗器各凡品、精良一件；衣饰铺：衣甲、佩饰各凡品、精良一件 */
export function stallGoods(level: number, clearSilver: number): { arms: MarketGood[]; wear: MarketGood[] } {
  const arms: MarketGood[] = [];
  const wear: MarketGood[] = [];
  for (const grade of [1, 2] as const) {
    for (const cat of WEAPON_CATS) arms.push(marketGood('兵器', grade, level, clearSilver, cat));
    arms.push(marketGood('暗器', grade, level, clearSilver));
    wear.push(marketGood('衣甲', grade, level, clearSilver));
    wear.push(marketGood('佩饰', grade, level, clearSilver));
  }
  return { arms, wear };
}

/** 买下：按同一前沿重新掷一件（型随机、数值随机），不是样品本身 */
export function buyStallGood(g: MarketGood, rng: () => number): GearItem {
  return { ...rollGear({ slot: g.slot, cat: g.cat, grade: g.grade, level: g.sample.level, clearSilver: Math.round(g.sample.sell / SELL_MULT[g.grade]) }, rng), fresh: true };
}

// ---------------------------------------------------------------- 黑市（裁决 32–34）

/** 蒙面货：只露部位 / 类目或「半卷残谱」，买下才揭晓 */
export type MaskedKind = { kind: 'gear'; slot: GearSlot; cat?: WeaponCat } | { kind: 'pages' };
export interface MaskedGood {
  id: string;
  mask: MaskedKind;
  /** 露出的一句（「一柄剑 · 来路不明」） */
  label: string;
  hint: string;
  price: number;
  /** 揭晓后的货（装备或残页）；null = 还蒙着 */
  revealed: { gear: GearItem } | { pages: { id: WuxueId; k: number; n: number } } | null;
}

/**
 * 蒙面货定价（裁决 40）= 定价基数 × 本境界倍率：倍率按实测「一天挂机进账 ÷ 目标件数」拟合，
 * 境界 2–3 一天买得起一件、境界 4 两件、境界 5 起三件（spec §7.3）；残谱按装备的四成。银两规则一变就要重拟。
 */
export const MASK_PRICE_MULT: Record<number, number> = { 1: 135, 2: 135, 3: 800, 4: 140, 5: 95, 6: 95, 7: 95 };
export const MASK_PAGES_RATIO = 0.4;
export const maskPrice = (kind: 'gear' | 'pages', realm: number, basis: number) =>
  Math.round(basis * (MASK_PRICE_MULT[realm] ?? 95) * (kind === 'pages' ? MASK_PAGES_RATIO : 1));
/** 开出品阶的权重（凡 / 精 / 上 / 珍 / 极），不公示；spec §7 复核维持 */
export const MASK_GRADE_WEIGHTS = [40, 35, 20, 4.5, 0.5];
/** 半卷残谱给几页 */
export const MASK_PAGES = 2;

const MASK_LABEL: Record<GearSlot, (cat?: WeaponCat) => string> = {
  兵器: (c) => `一柄${c ?? '兵刃'}`, 暗器: () => '一只暗器囊', 衣甲: () => '一件衣甲', 佩饰: () => '一枚佩饰',
};
const HINTS = ['来路不明', '血迹洗过', '夜里送来的', '不许问出处', '刻字被磨掉了', '主人已不在江湖'];

/** 这一轮的三件蒙面货（按轮次键固定，同一轮不换）：两件装备、一件残谱；clearSilver 为定价基数 */
export function roundMasked(roundKey: string, realm: number, clearSilver: number, rng: () => number): MaskedGood[] {
  const out: MaskedGood[] = [];
  for (let i = 0; i < BLACK_PER_ROUND; i++) {
    const hint = HINTS[Math.floor(rng() * HINTS.length)];
    if (i === BLACK_PER_ROUND - 1) {
      out.push({ id: `${roundKey}:${i}`, mask: { kind: 'pages' }, label: '半卷残谱', hint, price: maskPrice('pages', realm, clearSilver), revealed: null });
    } else {
      const slots: GearSlot[] = ['兵器', '暗器', '衣甲', '佩饰'];
      const slot = slots[Math.floor(rng() * slots.length)];
      const cat = slot === '兵器' ? WEAPON_CATS[Math.floor(rng() * WEAPON_CATS.length)] : undefined;
      out.push({
        id: `${roundKey}:${i}`, mask: { kind: 'gear', slot, ...(cat ? { cat } : {}) }, label: MASK_LABEL[slot](cat), hint,
        price: maskPrice('gear', realm, clearSilver), revealed: null,
      });
    }
  }
  return out;
}

/** 揭晓一件：装备按黑市权重开品阶（连开 BLACK_PITY 件凡品后必精良以上），残谱给随机一门上乘的某一式两页 */
export function revealMasked(
  g: MaskedGood, level: number, clearSilver: number, lowStreak: number, rng: () => number,
): { revealed: NonNullable<MaskedGood['revealed']>; lowStreak: number } {
  if (g.mask.kind === 'pages') {
    const pool = WUXUE_IDS.filter((id) => WUXUE[id].quality === '上乘');
    const id = pool[Math.floor(rng() * pool.length)];
    const k = 1 + Math.floor(rng() * QUALITY_PARAMS.上乘.forms);
    return { revealed: { pages: { id, k, n: MASK_PAGES } }, lowStreak };
  }
  let grade = pickGrade(rng);
  if (lowStreak >= BLACK_PITY && grade < 2) grade = 2;
  const gear = rollGear({ slot: g.mask.slot, cat: g.mask.cat, grade, level, clearSilver }, rng);
  return { revealed: { gear }, lowStreak: grade === 1 ? lowStreak + 1 : 0 };
}

function pickGrade(rng: () => number): GearGrade {
  const total = MASK_GRADE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < MASK_GRADE_WEIGHTS.length; i++) { r -= MASK_GRADE_WEIGHTS[i]; if (r < 0) return (i + 1) as GearGrade; }
  return 5;
}

/** 轮次键：每 BLACK_ROUND_H 小时一轮（按墙钟整点分段，更漏到下一轮换货） */
export function roundKeyOf(now: number): string {
  return String(Math.floor(now / (BLACK_ROUND_H * 3600 * 1000)));
}
/** 到下一轮换货的毫秒 */
export function msToNextRound(now: number): number {
  const span = BLACK_ROUND_H * 3600 * 1000;
  return span - (now % span);
}
