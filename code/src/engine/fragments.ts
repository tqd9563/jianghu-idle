/**
 * 秘籍残页数据层 —— docs/rules/manual-fragments.md v1.4。
 * 本模块只定义首发内容与数值，不实现发放、集齐、效果应用或商店行为。
 */
import type { RouteId } from './content';
import { MVP2_TRIAL_ENEMIES, type Mvp2TrialEnemy } from './mvp2Content';

export type BookId =
  | 'legacy_intro'
  | 'legacy_advanced'
  | 'legacy_finale'
  | 'true_jinglei'
  | 'true_zhenyue'
  | 'true_shigu';

export type PageId = `${BookId}_page_${1 | 2 | 3}`;
export type TrialId = Mvp2TrialEnemy['id'];
export type BookType = '遗篇' | '真传';
export type BookRoute = RouteId | 'none';
export type FragmentChannel = 'Boss_kill' | 'trial_victory' | 'shop_named' | 'offline_zero';
export type FragmentDropType = 'fixed' | 'random';
export type ShopPriceTier = 'none' | 'named' | 'finale_tail';
export type FragmentAttribute = 'hp' | 'atk' | 'def' | 'accuracy' | 'evasion' | 'critRate' | 'critDmg';

export interface FragmentCollection {
  readonly collectedPages: readonly PageId[];
  readonly completedBooks: readonly BookId[];
}

export interface BookDef {
  readonly book_id: BookId;
  readonly name: string;
  readonly type: BookType;
  readonly route: BookRoute;
  readonly pages: readonly [PageId, PageId, PageId];
  readonly effect_pointer: FragmentEffectId;
}

export interface PageSourceDef {
  readonly page_id: PageId;
  readonly book_id: BookId;
  readonly channel: FragmentChannel;
  readonly sequence: 1 | 2 | 3;
  readonly grant_rule: 'boss_1_first_kill' | 'boss_2_first_kill' | 'trial_first_victory' | 'named_purchase_only';
  readonly drop_type: FragmentDropType;
  readonly price_tier: ShopPriceTier;
}

export interface TrialDef {
  readonly trial_id: TrialId;
  readonly route: RouteId;
  readonly enemy_ref: Mvp2TrialEnemy;
  readonly unlock_after: 'Boss 2';
  readonly pages_granted: readonly [PageId, PageId, PageId];
}

export interface ShopPriceDef {
  readonly sku: 'named';
  readonly price_tier: Exclude<ShopPriceTier, 'none'>;
  readonly reputation: 80 | 120;
  readonly per_round_limit: 1;
}

export type FragmentEffectId =
  | 'legacy_perm_5'
  | 'legacy_perm_7'
  | 'legacy_perm_8'
  | 'jinglei_fourth_insight'
  | 'zhenyue_fourth_insight'
  | 'shigu_fourth_insight';

export interface LegacyCompletionEffect {
  readonly effect_id: Extract<FragmentEffectId, `legacy_${string}`>;
  readonly kind: 'permPct';
  readonly attributes: readonly FragmentAttribute[];
  readonly value: number;
  readonly equivalent_reputation: 30;
}

export interface RouteParameterCompletionEffect {
  readonly effect_id: Exclude<FragmentEffectId, `legacy_${string}`>;
  readonly kind: 'route_parameter';
  readonly route: RouteId;
  readonly parameter: 'sword_intent_required' | 'thorns_pct' | 'poison_per_hit';
  readonly operation: 'add';
  readonly value: number;
  readonly equivalent_reputation: 30;
}

export type FragmentEffect = LegacyCompletionEffect | RouteParameterCompletionEffect;

const pages = <T extends BookId>(bookId: T): readonly [
  `${T}_page_1`, `${T}_page_2`, `${T}_page_3`,
] => [`${bookId}_page_1`, `${bookId}_page_2`, `${bookId}_page_3`];

export const BOOK_TABLE = [
  { book_id: 'legacy_intro', name: '江湖残卷', type: '遗篇', route: 'none', pages: pages('legacy_intro'), effect_pointer: 'legacy_perm_5' },
  { book_id: 'legacy_advanced', name: '武林旧闻', type: '遗篇', route: 'none', pages: pages('legacy_advanced'), effect_pointer: 'legacy_perm_7' },
  { book_id: 'legacy_finale', name: '侠骨遗篇', type: '遗篇', route: 'none', pages: pages('legacy_finale'), effect_pointer: 'legacy_perm_8' },
  { book_id: 'true_jinglei', name: '惊雷剑意录', type: '真传', route: 'huashan', pages: pages('true_jinglei'), effect_pointer: 'jinglei_fourth_insight' },
  { book_id: 'true_zhenyue', name: '镇岳护体诀', type: '真传', route: 'shaolin', pages: pages('true_zhenyue'), effect_pointer: 'zhenyue_fourth_insight' },
  { book_id: 'true_shigu', name: '蚀骨毒经', type: '真传', route: 'tangmen', pages: pages('true_shigu'), effect_pointer: 'shigu_fourth_insight' },
] as const satisfies readonly BookDef[];

export const PAGE_SOURCE_TABLE = [
  { page_id: 'legacy_intro_page_1', book_id: 'legacy_intro', channel: 'Boss_kill', sequence: 1, grant_rule: 'boss_1_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_intro_page_2', book_id: 'legacy_intro', channel: 'Boss_kill', sequence: 2, grant_rule: 'boss_2_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_intro_page_3', book_id: 'legacy_intro', channel: 'Boss_kill', sequence: 3, grant_rule: 'boss_1_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_advanced_page_1', book_id: 'legacy_advanced', channel: 'Boss_kill', sequence: 1, grant_rule: 'boss_2_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_advanced_page_2', book_id: 'legacy_advanced', channel: 'Boss_kill', sequence: 2, grant_rule: 'boss_1_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_advanced_page_3', book_id: 'legacy_advanced', channel: 'Boss_kill', sequence: 3, grant_rule: 'boss_2_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_finale_page_1', book_id: 'legacy_finale', channel: 'Boss_kill', sequence: 1, grant_rule: 'boss_1_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_finale_page_2', book_id: 'legacy_finale', channel: 'Boss_kill', sequence: 2, grant_rule: 'boss_2_first_kill', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'legacy_finale_page_3', book_id: 'legacy_finale', channel: 'shop_named', sequence: 3, grant_rule: 'named_purchase_only', drop_type: 'fixed', price_tier: 'finale_tail' },
  { page_id: 'true_jinglei_page_1', book_id: 'true_jinglei', channel: 'trial_victory', sequence: 1, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_jinglei_page_2', book_id: 'true_jinglei', channel: 'trial_victory', sequence: 2, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_jinglei_page_3', book_id: 'true_jinglei', channel: 'trial_victory', sequence: 3, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_zhenyue_page_1', book_id: 'true_zhenyue', channel: 'trial_victory', sequence: 1, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_zhenyue_page_2', book_id: 'true_zhenyue', channel: 'trial_victory', sequence: 2, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_zhenyue_page_3', book_id: 'true_zhenyue', channel: 'trial_victory', sequence: 3, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_shigu_page_1', book_id: 'true_shigu', channel: 'trial_victory', sequence: 1, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_shigu_page_2', book_id: 'true_shigu', channel: 'trial_victory', sequence: 2, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
  { page_id: 'true_shigu_page_3', book_id: 'true_shigu', channel: 'trial_victory', sequence: 3, grant_rule: 'trial_first_victory', drop_type: 'fixed', price_tier: 'named' },
] as const satisfies readonly PageSourceDef[];

const trialById = (id: TrialId): Mvp2TrialEnemy => {
  const trial = MVP2_TRIAL_ENEMIES.find((entry) => entry.id === id);
  if (!trial) throw new Error(`Missing MVP-2 trial enemy: ${id}`);
  return trial;
};

export const TRIAL_TABLE = [
  { trial_id: 'trial_jinglei', route: 'huashan', enemy_ref: trialById('trial_jinglei'), unlock_after: 'Boss 2', pages_granted: pages('true_jinglei') },
  { trial_id: 'trial_zhenyue', route: 'shaolin', enemy_ref: trialById('trial_zhenyue'), unlock_after: 'Boss 2', pages_granted: pages('true_zhenyue') },
  { trial_id: 'trial_shigu', route: 'tangmen', enemy_ref: trialById('trial_shigu'), unlock_after: 'Boss 2', pages_granted: pages('true_shigu') },
] as const satisfies readonly TrialDef[];

export const SHOP_PRICE_TABLE = [
  { sku: 'named', price_tier: 'named', reputation: 80, per_round_limit: 1 },
  { sku: 'named', price_tier: 'finale_tail', reputation: 120, per_round_limit: 1 },
] as const satisfies readonly ShopPriceDef[];

// 坊间秘闻在验证窗口后才上架；首发只保留未来定价位，不导出、不实现。
// const SHOP_BOX_PRICE = '[窗口后定价]';

const ALL_FRAGMENT_ATTRIBUTES: readonly FragmentAttribute[] = [
  'hp', 'atk', 'def', 'accuracy', 'evasion', 'critRate', 'critDmg',
];

/**
 * 预算推导：声望节点总价 420，秘籍等效总量 6×30=180，不超过一半预算 210；
 * 每本 30 等效达到最低档节点的可感知下限。遗篇永久加成合计 5%+7%+8%=20%。
 */
export const EFFECT_TABLE = [
  { effect_id: 'legacy_perm_5', kind: 'permPct', attributes: ALL_FRAGMENT_ATTRIBUTES, value: 0.05, equivalent_reputation: 30 },
  { effect_id: 'legacy_perm_7', kind: 'permPct', attributes: ALL_FRAGMENT_ATTRIBUTES, value: 0.07, equivalent_reputation: 30 },
  { effect_id: 'legacy_perm_8', kind: 'permPct', attributes: ALL_FRAGMENT_ATTRIBUTES, value: 0.08, equivalent_reputation: 30 },
  { effect_id: 'jinglei_fourth_insight', kind: 'route_parameter', route: 'huashan', parameter: 'sword_intent_required', operation: 'add', value: -1, equivalent_reputation: 30 },
  { effect_id: 'zhenyue_fourth_insight', kind: 'route_parameter', route: 'shaolin', parameter: 'thorns_pct', operation: 'add', value: 0.15, equivalent_reputation: 30 },
  { effect_id: 'shigu_fourth_insight', kind: 'route_parameter', route: 'tangmen', parameter: 'poison_per_hit', operation: 'add', value: 1, equivalent_reputation: 30 },
] as const satisfies readonly FragmentEffect[];
