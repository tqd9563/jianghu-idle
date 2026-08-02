/** 秘籍残页规则层 —— docs/rules/manual-fragments.md v1.4。 */
import type { Build } from './combat';
import type { RouteId } from './content';
import {
  BOOK_TABLE,
  EFFECT_TABLE,
  PAGE_SOURCE_TABLE,
  SHOP_PRICE_TABLE,
  TRIAL_TABLE,
  type BookId,
  type FragmentCollection,
  type PageId,
  type TrialId,
} from './fragments';
import { track } from '../telemetry/telemetry';

export type CollectionChannel = 'A' | 'B' | 'C' | 'D';
export type BossFragmentSource = 'boss_1' | 'boss_2';

export interface FragmentEffects {
  readonly permPct: number;
  readonly swordIntentRequiredDelta: number;
  readonly thornsPctBonus: number;
  readonly poisonPerHitBonus: number;
}

export interface PageGrantResult extends FragmentCollection {
  readonly grantedPage: PageId | null;
  readonly completedBook: BookId | null;
}

export interface MissingPage {
  readonly pageId: PageId;
  readonly bookId: BookId;
  readonly nextSource: 'Boss 1' | 'Boss 2' | '真传试炼' | '指名寻访';
}

export interface FragmentTelemetryContext {
  readonly run: number;
  readonly realm: number;
  readonly route: RouteId | null;
}

const PAGE_IDS = new Set<PageId>(PAGE_SOURCE_TABLE.map((page) => page.page_id));

export function isPageId(value: string): value is PageId {
  return PAGE_IDS.has(value as PageId);
}

export function nextBossPage(
  boss: BossFragmentSource,
  collectedPages: readonly PageId[],
): PageId | null {
  const rule = boss === 'boss_1' ? 'boss_1_first_kill' : 'boss_2_first_kill';
  return PAGE_SOURCE_TABLE.find(
    (page) => page.channel === 'Boss_kill'
      && page.grant_rule === rule
      && !collectedPages.includes(page.page_id),
  )?.page_id ?? null;
}

export function nextTrialPage(trialId: TrialId, collectedPages: readonly PageId[]): PageId | null {
  const trial = TRIAL_TABLE.find((entry) => entry.trial_id === trialId);
  return trial?.pages_granted.find((pageId) => !collectedPages.includes(pageId)) ?? null;
}

/** 渠道 D 明确零产出。 */
export function offlinePages(): readonly PageId[] {
  return [];
}

export function grantPage(collection: FragmentCollection, pageId: PageId): PageGrantResult {
  if (collection.collectedPages.includes(pageId)) {
    return { ...collection, grantedPage: null, completedBook: null };
  }
  const source = PAGE_SOURCE_TABLE.find((page) => page.page_id === pageId);
  if (!source) return { ...collection, grantedPage: null, completedBook: null };

  const collectedPages = [...collection.collectedPages, pageId];
  const book = BOOK_TABLE.find((entry) => entry.book_id === source.book_id);
  const newlyCompleted = book !== undefined
    && !collection.completedBooks.includes(book.book_id)
    && book.pages.every((page) => collectedPages.includes(page));
  const completedBooks = newlyCompleted
    ? [...collection.completedBooks, book.book_id]
    : collection.completedBooks;
  return {
    collectedPages,
    completedBooks,
    grantedPage: pageId,
    completedBook: newlyCompleted ? book.book_id : null,
  };
}

export function shopPrice(pageId: PageId): number | null {
  const source = PAGE_SOURCE_TABLE.find((page) => page.page_id === pageId);
  if (!source) return null;
  return SHOP_PRICE_TABLE.find((price) => price.price_tier === source.price_tier)?.reputation ?? null;
}

export function computeFragmentEffects(completedBooks: readonly BookId[]): FragmentEffects {
  let permPct = 0;
  let swordIntentRequiredDelta = 0;
  let thornsPctBonus = 0;
  let poisonPerHitBonus = 0;
  for (const bookId of completedBooks) {
    const book = BOOK_TABLE.find((entry) => entry.book_id === bookId);
    const effect = book && EFFECT_TABLE.find((entry) => entry.effect_id === book.effect_pointer);
    if (!effect) continue;
    if (effect.kind === 'permPct') permPct += effect.value;
    else if (effect.parameter === 'sword_intent_required') swordIntentRequiredDelta += effect.value;
    else if (effect.parameter === 'thorns_pct') thornsPctBonus += effect.value;
    else poisonPerHitBonus += effect.value;
  }
  return {
    permPct: Math.round(permPct * 100) / 100,
    swordIntentRequiredDelta,
    thornsPctBonus,
    poisonPerHitBonus,
  };
}

export function applyFragmentEffectsToBuild(build: Build, effects: FragmentEffects): Build {
  const permanentMultiplier = 1 + effects.permPct;
  return {
    ...build,
    hp: build.hp * permanentMultiplier,
    atk: build.atk * permanentMultiplier,
    def: build.def * permanentMultiplier,
    hit: build.hit * permanentMultiplier,
    dodge: build.dodge * permanentMultiplier,
    crit: build.crit * permanentMultiplier,
    cd: build.cd * permanentMultiplier,
    sqNeed: build.route === 'huashan'
      ? Math.max(1, build.sqNeed + effects.swordIntentRequiredDelta)
      : build.sqNeed,
    thorns: build.route === 'shaolin' ? build.thorns + effects.thornsPctBonus : build.thorns,
    poison: build.route === 'tangmen'
      ? { ...build.poison, perHit: build.poison.perHit + effects.poisonPerHitBonus }
      : build.poison,
  };
}

export function getMissingPages(collectedPages: readonly PageId[]): MissingPage[] {
  return PAGE_SOURCE_TABLE
    .filter((page) => !collectedPages.includes(page.page_id))
    .map((page) => ({
      pageId: page.page_id,
      bookId: page.book_id,
      nextSource: page.grant_rule === 'boss_1_first_kill' ? 'Boss 1'
        : page.grant_rule === 'boss_2_first_kill' ? 'Boss 2'
          : page.grant_rule === 'trial_first_victory' ? '真传试炼'
            : '指名寻访',
    }));
}

export function emitPageGrant(
  ctx: FragmentTelemetryContext,
  result: PageGrantResult,
  channel: CollectionChannel,
): void {
  if (!result.grantedPage) return;
  const source = PAGE_SOURCE_TABLE.find((page) => page.page_id === result.grantedPage);
  if (!source) return;
  const telemetryChannel = channel === 'A' ? 'boss_kill'
    : channel === 'B' ? 'trial'
      : channel === 'C' ? 'shop_named'
        : 'offline';
  track('page_acquired', ctx, {
    page_id: source.page_id,
    book_id: source.book_id,
    channel: telemetryChannel,
    sequence: source.sequence,
  });
  if (!result.completedBook) return;
  const book = BOOK_TABLE.find((entry) => entry.book_id === result.completedBook);
  const effect = book && EFFECT_TABLE.find((entry) => entry.effect_id === book.effect_pointer);
  if (!book || !effect) return;
  track('book_completed', ctx, {
    book_id: book.book_id,
    type: book.type,
    effect_summary: effect.kind === 'permPct'
      ? `全属性永久 +${Math.round(effect.value * 100)}%`
      : `${effect.parameter} ${effect.value >= 0 ? '+' : ''}${effect.value}`,
  });
}
