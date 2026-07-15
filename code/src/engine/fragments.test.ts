import { describe, expect, it } from 'vitest';
import { REP_NODES } from './prestige';
import { MVP2_TRIAL_ENEMIES } from './mvp2Content';
import {
  BOOK_TABLE,
  EFFECT_TABLE,
  PAGE_SOURCE_TABLE,
  SHOP_PRICE_TABLE,
  TRIAL_TABLE,
} from './fragments';

describe('manual fragments data layer', () => {
  it('defines six placeholder books and exactly three unique pages per book', () => {
    expect(BOOK_TABLE).toHaveLength(6);
    expect(BOOK_TABLE.map((book) => book.name)).toEqual(['江湖残卷', '武林旧闻', '侠骨遗篇', '惊雷剑意录', '镇岳护体诀', '蚀骨毒经']);
    expect(BOOK_TABLE.map((book) => book.type)).toEqual(['遗篇', '遗篇', '遗篇', '真传', '真传', '真传']);
    expect(BOOK_TABLE.map((book) => book.route)).toEqual(['none', 'none', 'none', 'huashan', 'shaolin', 'tangmen']);
    expect(new Set(BOOK_TABLE.flatMap((book) => book.pages)).size).toBe(18);
    expect(BOOK_TABLE.every((book) => book.pages.length === 3)).toBe(true);
  });

  it('defines the deterministic 18-page source sequence and shop-only finale tail', () => {
    expect(PAGE_SOURCE_TABLE).toHaveLength(18);
    expect(new Set(PAGE_SOURCE_TABLE.map((page) => page.page_id)).size).toBe(18);
    expect(PAGE_SOURCE_TABLE.every((page) => page.drop_type === 'fixed')).toBe(true);
    expect(PAGE_SOURCE_TABLE.filter((page) => page.channel === 'Boss_kill')).toHaveLength(8);
    expect(PAGE_SOURCE_TABLE.filter((page) => page.channel === 'trial_victory')).toHaveLength(9);
    expect(PAGE_SOURCE_TABLE.map((page) => page.channel)).not.toContain('offline_zero');
    expect(PAGE_SOURCE_TABLE.find((page) => page.page_id === 'legacy_finale_page_3')).toEqual({
      page_id: 'legacy_finale_page_3',
      book_id: 'legacy_finale',
      channel: 'shop_named',
      sequence: 3,
      grant_rule: 'named_purchase_only',
      drop_type: 'fixed',
      price_tier: 'finale_tail',
    });
  });

  it('reuses the three fixed trial enemies and grants each route true-transmission sequence', () => {
    expect(TRIAL_TABLE).toHaveLength(3);
    expect(TRIAL_TABLE.map((trial) => trial.enemy_ref)).toEqual(MVP2_TRIAL_ENEMIES);
    expect(TRIAL_TABLE.every((trial) => trial.unlock_after === 'Boss 2')).toBe(true);
    expect(TRIAL_TABLE.map((trial) => trial.pages_granted)).toEqual([
      ['true_jinglei_page_1', 'true_jinglei_page_2', 'true_jinglei_page_3'],
      ['true_zhenyue_page_1', 'true_zhenyue_page_2', 'true_zhenyue_page_3'],
      ['true_shigu_page_1', 'true_shigu_page_2', 'true_shigu_page_3'],
    ]);
  });

  it('derives exact completion effects within the permanent-growth budget', () => {
    expect(EFFECT_TABLE).toEqual([
      { effect_id: 'legacy_perm_5', kind: 'permPct', attributes: ['hp', 'atk', 'def', 'accuracy', 'evasion', 'critRate', 'critDmg'], value: 0.05, equivalent_reputation: 30 },
      { effect_id: 'legacy_perm_7', kind: 'permPct', attributes: ['hp', 'atk', 'def', 'accuracy', 'evasion', 'critRate', 'critDmg'], value: 0.07, equivalent_reputation: 30 },
      { effect_id: 'legacy_perm_8', kind: 'permPct', attributes: ['hp', 'atk', 'def', 'accuracy', 'evasion', 'critRate', 'critDmg'], value: 0.08, equivalent_reputation: 30 },
      { effect_id: 'jinglei_fourth_insight', kind: 'route_parameter', route: 'huashan', parameter: 'sword_intent_required', operation: 'add', value: -1, equivalent_reputation: 30 },
      { effect_id: 'zhenyue_fourth_insight', kind: 'route_parameter', route: 'shaolin', parameter: 'thorns_pct', operation: 'add', value: 0.15, equivalent_reputation: 30 },
      { effect_id: 'shigu_fourth_insight', kind: 'route_parameter', route: 'tangmen', parameter: 'poison_per_hit', operation: 'add', value: 1, equivalent_reputation: 30 },
    ]);

    const repNodeTotal = REP_NODES.reduce((sum, node) => sum + node.price, 0);
    const fragmentEquivalentTotal = EFFECT_TABLE.reduce((sum, effect) => sum + effect.equivalent_reputation, 0);
    const legacyPermTotal = EFFECT_TABLE
      .filter((effect) => effect.kind === 'permPct')
      .reduce((sum, effect) => sum + effect.value, 0);
    expect(repNodeTotal).toBe(420);
    expect(fragmentEquivalentTotal).toBe(180);
    expect(fragmentEquivalentTotal).toBeLessThanOrEqual(repNodeTotal / 2);
    expect(EFFECT_TABLE.every((effect) => effect.equivalent_reputation >= 30)).toBe(true);
    expect(legacyPermTotal).toBeCloseTo(0.20);
  });

  it('prices named purchases above Boss reputation milestones and reserves a tail premium', () => {
    expect(SHOP_PRICE_TABLE).toEqual([
      { sku: 'named', price_tier: 'named', reputation: 80, per_round_limit: 1 },
      { sku: 'named', price_tier: 'finale_tail', reputation: 120, per_round_limit: 1 },
    ]);
    expect(SHOP_PRICE_TABLE[0].reputation).toBeGreaterThan(50);
    expect(SHOP_PRICE_TABLE[1].reputation).toBeGreaterThan(SHOP_PRICE_TABLE[0].reputation);
  });
});
