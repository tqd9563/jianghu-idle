import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import { useGameStore } from '../store/gameStore';
import { makeBuild } from './combat';
import {
  applyFragmentEffectsToBuild,
  computeFragmentEffects,
  getMissingPages,
  grantPage,
  nextBossPage,
  nextTrialPage,
  offlinePages,
  shopPrice,
} from './fragmentLogic';

describe('manual fragment engine', () => {
  it('selects deterministic next missing pages for boss and trial channels', () => {
    expect(nextBossPage('boss_1', [])).toBe('legacy_intro_page_1');
    expect(nextBossPage('boss_1', ['legacy_intro_page_1'])).toBe('legacy_intro_page_3');
    expect(nextBossPage('boss_2', [])).toBe('legacy_intro_page_2');
    expect(nextTrialPage('trial_jinglei', ['true_jinglei_page_1'])).toBe('true_jinglei_page_2');
    expect(offlinePages()).toEqual([]);
  });

  it('grants idempotently and completes a book only when all three pages exist', () => {
    const first = grantPage({ collectedPages: [], completedBooks: [] }, 'legacy_intro_page_1');
    const duplicate = grantPage(first, 'legacy_intro_page_1');
    const second = grantPage(first, 'legacy_intro_page_2');
    const third = grantPage(second, 'legacy_intro_page_3');
    expect(duplicate.grantedPage).toBeNull();
    expect(second.completedBooks).toEqual([]);
    expect(third.completedBooks).toEqual(['legacy_intro']);
    expect(third.completedBook).toBe('legacy_intro');
  });

  it('computes legacy and route effects and applies them to the relevant build only', () => {
    const effects = computeFragmentEffects([
      'legacy_intro', 'legacy_advanced', 'true_jinglei', 'true_zhenyue', 'true_shigu',
    ]);
    expect(effects).toEqual({
      permPct: 0.12,
      swordIntentRequiredDelta: -1,
      thornsPctBonus: 0.15,
      poisonPerHitBonus: 1,
    });
    const sword = applyFragmentEffectsToBuild(makeBuild('huashan', 5, 10, 3), effects);
    const shield = applyFragmentEffectsToBuild(makeBuild('shaolin', 5, 10, 3), effects);
    const poison = applyFragmentEffectsToBuild(makeBuild('tangmen', 5, 10, 3), effects);
    expect(sword.sqNeed).toBe(2);
    expect(shield.thorns).toBeCloseTo(makeBuild('shaolin', 5, 10, 3).thorns + 0.15);
    expect(poison.poison.perHit).toBe(2);
    expect(sword.hp).toBeCloseTo(makeBuild('huashan', 5, 10, 3).hp * 1.12);
  });

  it('prices normal and finale-tail named purchases and describes every missing source', () => {
    expect(shopPrice('legacy_intro_page_1')).toBe(80);
    expect(shopPrice('legacy_finale_page_3')).toBe(120);
    const missing = getMissingPages(['legacy_intro_page_1']);
    expect(missing).toHaveLength(17);
    expect(missing.find((page) => page.pageId === 'legacy_finale_page_3')?.nextSource).toBe('指名寻访');
  });
});

describe('manual fragments store integration', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('buys one named page per run, deducts reputation, and emits telemetry', () => {
    useGameStore.setState({ reputation: 200 });
    useGameStore.getState().buyShopPage('legacy_intro_page_1');
    expect(useGameStore.getState()).toMatchObject({
      reputation: 120,
      collectedPages: ['legacy_intro_page_1'],
      shopPurchasesThisRun: 1,
    });
    useGameStore.getState().buyShopPage('legacy_intro_page_2');
    expect(useGameStore.getState().collectedPages).toEqual(['legacy_intro_page_1']);
    expect(getEvents().find((event) => event.e === 'shop_page_exchanged')).toMatchObject({
      page_id: 'legacy_intro_page_1', price_paid: 80, shop_purchases_this_run: 1,
    });
  });

  it('records a trial loss without granting and first trial win only once', () => {
    useGameStore.setState({
      route: 'huashan', realm: 1, clearedStages: ['m2s10'], ownedMechNodes: [], completedBooks: [],
    });
    useGameStore.getState().challengeTrial('trial_jinglei');
    expect(getEvents().find((event) => event.e === 'trial_challenged')?.result).toBe('loss');
    expect(useGameStore.getState().collectedPages).toEqual([]);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    useGameStore.setState({ realm: 5, skillLevel: 10, ownedMechNodes: ['hs1', 'hs2', 'hs3'] });
    useGameStore.getState().challengeTrial('trial_jinglei');
    const pagesAfterWin = useGameStore.getState().collectedPages;
    useGameStore.getState().challengeTrial('trial_jinglei');
    expect(pagesAfterWin).toEqual(['true_jinglei_page_1']);
    expect(useGameStore.getState().collectedPages).toEqual(pagesAfterWin);
    expect(useGameStore.getState().trialWinsThisRun).toEqual({ trial_jinglei: 1 });
    vi.restoreAllMocks();
  });

  it('retains collection and resets per-run gates across retire with telemetry snapshots', () => {
    const allStages = [
      ...Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`),
      ...Array.from({ length: 10 }, (_, i) => `m2s${i + 1}`),
      ...Array.from({ length: 10 }, (_, i) => `m3s${i + 1}`),
    ];
    useGameStore.setState({
      realm: 5, route: 'huashan', clearedStages: allStages, runPlaySec: 1800,
      collectedPages: ['legacy_intro_page_1'], completedBooks: [],
      bossKillsThisRun: { boss_1: 1 }, trialWinsThisRun: { trial_jinglei: 1 }, shopPurchasesThisRun: 1,
    });
    useGameStore.getState().openManualShelf();
    useGameStore.getState().startSession('fragment-test');
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();
    expect(useGameStore.getState()).toMatchObject({
      collectedPages: ['legacy_intro_page_1'], bossKillsThisRun: {}, trialWinsThisRun: {}, shopPurchasesThisRun: 0,
    });
    expect(getEvents().find((event) => event.e === 'manual_shelf_opened')).toMatchObject({
      collected_count: 1, completed_count: 0, missing_count: 17,
    });
    expect(getEvents().find((event) => event.e === 'test_session_start')?.missing_pages_snapshot).toHaveLength(17);
    expect(getEvents().find((event) => event.e === 'retire_confirmed')?.pages_gained_run).toBe(0);
  });
});
