/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）+ 战斗推进（§6.2/§7）+ 归隐/声望（§8/声望经济表）
 * 丹田是内力唯一容器：挂机与战斗奖励同入丹田，武学随时支取，突破一次性扣全额。
 * 战斗：引擎瞬时结算（RNG 模式），回合按节奏回放（Boss/精英 15–30 秒不可跳过，§7.1）。
 * 归隐：标准 = 境界 5 + Boss 3；保底 = 境界 5 后连败/停滞触发低收益归隐（§6.6）。
 */
import { create } from 'zustand';
import { diagnose, fight, makeBuild, type Build, type FightResult, type FightStats } from '../engine/combat';
import { REALMS, ROUTE_SWITCH_SILVER, skillUpgradeCost, type RouteId } from '../engine/content';
import { getStage, MAP_STAGE_COUNT, refarmReward, targetId, type EnemyDef } from '../engine/enemies';
import { idleNeiliPerSec, zhoutianProgress } from '../engine/formulas';
import {
  FALLBACK_FAIL_STREAK, FALLBACK_STALL_MIN, REP_NODE_MAP,
  battleNeiliMult, bossDmgBonus, breakthroughDiscount, carryXp, hasNode, idleMult,
  settleRetire, type RepNodeId, type RetireSettle,
} from '../engine/prestige';
import {
  calculateOfflineRewards, maxIdleStage, type OfflineSettleResult,
} from '../engine/offlineRewards';
import { ROUTES } from '../engine/routes';
import {
  applyFragmentEffectsToBuild, computeFragmentEffects, emitPageGrant, getMissingPages,
  grantPage as grantFragmentPage, isPageId, nextBossPage, nextTrialPage, offlinePages, shopPrice,
  type CollectionChannel, type FragmentEffects, type MissingPage,
} from '../engine/fragmentLogic';
import { PAGE_SOURCE_TABLE, TRIAL_TABLE, type BookId, type TrialId } from '../engine/fragments';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import {
  endLiveTestWindow, getDebugOfflineCap, loadGame, loadLiveTestWindow, loadSavedAt,
  resetGame, saveGame, startLiveTestWindow, type LiveTestWindowRecord,
} from '../save/storage';
import { getEvents, resetTelemetry, track } from '../telemetry/telemetry';

export type MapNo = 1 | 2 | 3;

interface PersistedState {
  run: number;
  realm: number;
  route: RouteId | null;
  skillLevel: number;
  dantian: number;
  silver: number;
  xp: number;
  reputation: number;
  repTotal: number;
  ownedMechNodes: string[];
  ownedRepNodes: string[];
  chargeHighWater: number;
  clearedStages: string[];
  attempts: Record<string, number>;
  autoAdvance: boolean;
  /** 本轮活跃游玩秒数（tick 累计；页面关闭期间不计 —— run_duration_s 权威口径，经济表 §6.4） */
  runPlaySec: number;
  /** Boss 3 累计失败计数（调整不重置；保底触发器一，经济表 §6.2） */
  b3Fails: number;
  /** 最近一次实质进展（首通/突破/武学/机制节点）时的 runPlaySec（保底停滞触发器二） */
  lastProgressSec: number;
  /** 保底归隐一经开放持续存在，不因后续调整收回（经济表 §6.2 触发后状态） */
  fallbackUnlocked: boolean;
  /** retire_unlocked(kind=standard) 是否已上报 */
  standardNotified: boolean;
  /** 本轮已购机制节点实际投入的阅历（换线 100% 返还的口径 =「已投入」，师门指引免费赠予不计入） */
  mechXpInvested: number;
  /** 本轮换线次数（轻装上路：每轮第一次免摩擦费） */
  switchCount: number;
  /** 连续回刷衰减（公式表 §6 防原地刷爆）：同一关连续第 n 次回刷 ×0.8^(n−1)，间隔 10 分钟重置 */
  refarmKey: string | null;
  refarmCount: number;
  /** 上次回刷时的 runPlaySec（活跃净时间口径） */
  refarmAt: number;
  /** 观察员会话进行中 —— 持久化：面板重开/页面刷新不得回到「未开始」假象 */
  sessionActive: boolean;
  /** 观察员暂停（test_paused/test_resumed）：暂停期间挂机产出、活跃时长、战斗回放全部冻结。
   *  持久化：刷新页面不得静默解冻——test_paused 无配对 test_resumed 时，离线口径会把后续游玩全算进暂停 */
  paused: boolean;
  /** 秘籍残页跨归隐保留；可选字段由 FRESH 为旧存档迁移补默认值。 */
  collectedPages?: string[];
  /** 已集齐秘籍跨归隐保留；效果应用由后续任务实现。 */
  completedBooks?: string[];
  /** 本轮试炼首胜计数，归隐重置。 */
  trialWinsThisRun?: Record<string, number>;
  /** 本轮 Boss 首杀计数，归隐重置。 */
  bossKillsThisRun?: Record<string, number>;
  /** 本轮指名寻访购买次数，归隐重置。 */
  shopPurchasesThisRun?: number;
}

export interface BattleState {
  map: MapNo;
  stage: number;
  enemy: EnemyDef;
  result: FightResult;
  revealed: number;
  nextRevealAt: number;
  intervalMs: number;
  resolved: boolean;
  chainAt: number | null;
  /** 自动连战目标：首通胜 → 下一关（推进）；回刷胜 → 原关（回退挂机，收益按公式表 §6 衰减） */
  chainStage: number | null;
  /** 胜利实际入账（含江湖熟路加成后的实发值，收益行同源同值） */
  reward: { neili: number; silver: number; xp: number; refarm: boolean; grantedPageId?: string } | null;
}

export interface FailureInfo {
  map: MapNo;
  stage: number;
  enemyName: string;
  diagCodes: number[];
  rounds: number;
  playerHpPct: number;
  enemyHpPct: number;
  hitRate: number;
  /** 战报（战斗文案冻结件）：引擎统计裸露 */
  stats: FightStats;
  route: RouteId | null;
  tags: readonly string[];
}

export type RetireKind = 'standard' | 'fallback';

export interface NaturalWindowNote {
  readonly natural_open: boolean;
  readonly open_reason: string;
  readonly settlement_understood: boolean | null;
  readonly decision: string;
  readonly next_goal: string;
  readonly feeling: string;
}

/** 归隐结算演出数据（§8.6-3）：确认后展示，关闭后落地声望阁 */
export interface RetireCeremonyData {
  runEnded: number;
  settle: RetireSettle;
  durationSec: number;
  clearedCount: number;
  maxMap: MapNo;
}

interface GameState extends PersistedState {
  started: boolean;
  ceremony: number | null;
  selectedMap: MapNo;
  battle: BattleState | null;
  failure: FailureInfo | null;
  retireStep: 'preview' | 'confirm' | null;
  retireCeremony: RetireCeremonyData | null;
  /** 保底开放一次性提示（retire-copy §6 toast；非持久化） */
  retireToast: 'fail_streak' | 'stall_timeout' | null;
  /** 出关结算待呈现数据（MVP-1 §6；资源已在 init 入账，此处只驱动结算屏；非持久化） */
  offlineSettlement: OfflineSettleResult | null;
  /** 独立持久化的自然测试窗口；不进入游戏存档。 */
  liveTestWindow: LiveTestWindowRecord | null;
  init: () => void;
  dismissOfflineSettlement: () => void;
  startLiveTestWindow: () => void;
  endLiveTestWindow: () => void;
  applyLiveTestSwitch: (command: 1 | 0 | null) => void;
  recordNaturalWindowNote: (note: NaturalWindowNote) => void;
  tick: (now: number) => void;
  breakthrough: () => void;
  dismissCeremony: () => void;
  selectRoute: (r: RouteId) => void;
  switchRoute: (to: RouteId) => void;
  upgradeSkill: () => void;
  buyMechNode: (nodeId: string) => void;
  selectMap: (m: MapNo) => void;
  challengeStage: (map: MapNo, stage: number) => void;
  setAutoAdvance: (v: boolean) => void;
  dismissFailure: () => void;
  openRetire: () => void;
  proceedRetire: () => void;
  cancelRetire: () => void;
  confirmRetire: () => void;
  closeRetireCeremony: () => void;
  dismissRetireToast: () => void;
  buyRepNode: (id: RepNodeId) => void;
  grantPage: (pageId: string, channel: CollectionChannel) => void;
  challengeTrial: (trialId: TrialId) => { win: boolean; grantedPage: string | null; };
  buyShopPage: (pageId: string) => void;
  getFragmentEffects: () => FragmentEffects;
  getMissingPages: () => MissingPage[];
  openManualShelf: () => void;
  startSession: (testerId: string) => void;
  endSession: (reason: 'completed' | 'external_dropout' | 'design_dropout') => void;
  pauseSession: () => void;
  resumeSession: () => void;
  hardReset: () => void;
}

const FRESH: PersistedState = {
  run: 1, realm: 1, route: null, skillLevel: 0,
  dantian: 0, silver: 0, xp: 0,
  reputation: 0, repTotal: 0,
  ownedMechNodes: [], ownedRepNodes: [], chargeHighWater: 0,
  clearedStages: [], attempts: {}, autoAdvance: true,
  runPlaySec: 0, b3Fails: 0, lastProgressSec: 0,
  fallbackUnlocked: false, standardNotified: false,
  mechXpInvested: 0, switchCount: 0,
  refarmKey: null, refarmCount: 0, refarmAt: 0,
  sessionActive: false, paused: false,
  collectedPages: [], completedBooks: [],
  trialWinsThisRun: {}, bossKillsThisRun: {}, shopPurchasesThisRun: 0,
};

/** 页面关闭期间不结算任何收益：lastTick 不入存档，init 时重置为当下 */
let lastTick = 0;
let lastSave = 0;
let visitedLiveTestWindowId: string | null = null;

const stageKey = (m: MapNo, s: number) => `m${m}s${s}`;
const BOSS3_KEY = stageKey(3, MAP_STAGE_COUNT[3]);

const persist = (s: PersistedState) =>
  saveGame({
    run: s.run, realm: s.realm, route: s.route, skillLevel: s.skillLevel,
    dantian: s.dantian, silver: s.silver, xp: s.xp,
    reputation: s.reputation, repTotal: s.repTotal,
    ownedMechNodes: s.ownedMechNodes, ownedRepNodes: s.ownedRepNodes,
    chargeHighWater: s.chargeHighWater,
    clearedStages: s.clearedStages, attempts: s.attempts, autoAdvance: s.autoAdvance,
    runPlaySec: s.runPlaySec, b3Fails: s.b3Fails,
    lastProgressSec: s.lastProgressSec,
    fallbackUnlocked: s.fallbackUnlocked, standardNotified: s.standardNotified,
    mechXpInvested: s.mechXpInvested, switchCount: s.switchCount,
    refarmKey: s.refarmKey, refarmCount: s.refarmCount, refarmAt: s.refarmAt,
    sessionActive: s.sessionActive, paused: s.paused,
    collectedPages: s.collectedPages ?? [], completedBooks: s.completedBooks ?? [],
    trialWinsThisRun: s.trialWinsThisRun ?? {}, bossKillsThisRun: s.bossKillsThisRun ?? {},
    shopPurchasesThisRun: s.shopPurchasesThisRun ?? 0,
  });

/** 地图解锁：图 2 需通关图 1 末关，图 3 需通关图 2 末关 */
export function mapUnlocked(map: MapNo, cleared: string[]): boolean {
  if (map === 1) return true;
  if (map === 2) return cleared.includes(stageKey(1, MAP_STAGE_COUNT[1]));
  return cleared.includes(stageKey(2, MAP_STAGE_COUNT[2]));
}

/** 本图下一待通关关卡；全通返回 null */
export function nextStageOf(map: MapNo, cleared: string[]): number | null {
  for (let i = 1; i <= MAP_STAGE_COUNT[map]; i++) {
    if (!cleared.includes(stageKey(map, i))) return i;
  }
  return null;
}

export function playerBuild(s: Pick<PersistedState, 'realm' | 'route' | 'skillLevel' | 'ownedMechNodes' | 'completedBooks'>): Build {
  const effects = computeFragmentEffects((s.completedBooks ?? []).filter(isBookId));
  if (s.route) return applyFragmentEffectsToBuild(
    makeBuild(s.route, s.realm, s.skillLevel, s.ownedMechNodes.length), effects,
  );
  // 未择路（境界 1）：纯基础属性
  const b = REALMS[s.realm - 1];
  return applyFragmentEffectsToBuild({
    hp: b.hp, atk: b.atk, plainMult: 1, def: b.def, hit: b.accuracy, dodge: b.evasion,
    crit: 0.05, cd: 1.5, firstCrit: false, shieldPct: 0, thorns: 0,
    poison: { init: 0, perHit: 0, coef: 0, cap: 0, burst: 0 },
    sqNeed: 99, burstMult: 0, lowhpDr: 0, route: 'huashan',
  }, effects);
}

function isBookId(value: string): value is BookId {
  return ['legacy_intro', 'legacy_advanced', 'legacy_finale', 'true_jinglei', 'true_zhenyue', 'true_shigu'].includes(value);
}

/** 下一境界的有效突破消耗（快速入门：境界 2/3 −30%）；已满境界返回 null */
export function effBreakCost(s: Pick<PersistedState, 'realm' | 'ownedRepNodes'>): number | null {
  if (s.realm >= REALMS.length) return null;
  const base = REALMS[s.realm].breakthroughCost!;
  return Math.round(base * breakthroughDiscount(s.realm + 1, s.ownedRepNodes));
}

/** 有效挂机产出（旧梦重温：+20%） */
export function effIdleRate(s: Pick<PersistedState, 'realm' | 'ownedRepNodes'>): number {
  return idleNeiliPerSec(s.realm) * idleMult(s.ownedRepNodes);
}

/**
 * 归隐当前可用形态：标准 / 保底 / 不可用。
 * 保底一经开放持续存在；后续击败 Boss 3 升格为标准（经济表 §6.2 触发后状态）。
 */
export function retireKind(
  s: Pick<PersistedState, 'realm' | 'clearedStages' | 'b3Fails' | 'runPlaySec' | 'lastProgressSec' | 'fallbackUnlocked'>,
): RetireKind | null {
  if (s.realm < REALMS.length) return null;
  if (s.clearedStages.includes(BOSS3_KEY)) return 'standard';
  if (s.fallbackUnlocked) return 'fallback';
  if (s.b3Fails >= FALLBACK_FAIL_STREAK) return 'fallback';
  if (s.runPlaySec - s.lastProgressSec >= FALLBACK_STALL_MIN * 60) return 'fallback';
  return null;
}

function liveTestFields(record: LiveTestWindowRecord) {
  return {
    window_id: record.windowId,
    started_at: record.startedAt,
    tables_version_started: record.tablesVersionStarted,
    tables_version_current: TABLES_VERSION,
    tables_version_changed: record.tablesVersionStarted !== TABLES_VERSION,
  };
}

function maxClearedStage(clearedStages: readonly string[]): string | null {
  let best: { key: string; order: number } | null = null;
  for (const key of clearedStages) {
    const match = /^m([1-3])s(\d+)$/.exec(key);
    if (!match) continue;
    const order = (Number(match[1]) - 1) * 10 + Number(match[2]);
    if (!best || order > best.order) best = { key, order };
  }
  return best?.key ?? null;
}

function visitSnapshot(s: GameState) {
  const breakCost = effBreakCost(s);
  const nextSkillLevel = s.skillLevel + 1;
  const decisionBattle = ([1, 2, 3] as const).some(
    (map) => mapUnlocked(map, s.clearedStages) && nextStageOf(map, s.clearedStages) !== null,
  );
  return {
    max_cleared_stage: maxClearedStage(s.clearedStages),
    cleared_stage_count: s.clearedStages.length,
    offline_settlement_present: s.offlineSettlement !== null,
    offline_settlement_capped: s.offlineSettlement?.capped ?? null,
    decision_breakthrough: breakCost !== null && s.dantian >= breakCost,
    decision_skill: s.route !== null
      && nextSkillLevel <= REALMS[s.realm - 1].skillCap
      && s.dantian >= skillUpgradeCost(nextSkillLevel),
    decision_battle: decisionBattle,
    decision_retire: retireKind(s) !== null,
  };
}

function emitNaturalWindowVisit(s: GameState, record: LiveTestWindowRecord): void {
  if (visitedLiveTestWindowId === record.windowId) return;
  track('natural_window_visit', { run: s.run, realm: s.realm, route: s.route }, {
    ...liveTestFields(record), ...visitSnapshot(s),
  });
  visitedLiveTestWindowId = record.windowId;
}

/** Simulates a new page for focused store tests; production page lifecycle resets module state naturally. */
export function resetLiveTestVisitForTests(): void {
  visitedLiveTestWindowId = null;
}

export const useGameStore = create<GameState>((set, get) => ({
  ...FRESH,
  started: false,
  ceremony: null,
  selectedMap: 1,
  battle: null,
  failure: null,
  retireStep: null,
  retireCeremony: null,
  retireToast: null,
  offlineSettlement: null,
  liveTestWindow: null,

  init: () => {
    if (get().started) return;
    const saved = loadGame<PersistedState>();
    const savedAt = loadSavedAt();
    const now = Date.now();
    lastTick = now;
    if (saved) {
      const merged = { ...FRESH, ...saved };
      let selectedMap: MapNo = 1;
      for (const m of [3, 2, 1] as MapNo[]) {
        if (mapUnlocked(m, merged.clearedStages)) { selectedMap = m; break; }
      }

      // 出关结算（MVP-1 §5：回归上线一次性结算；A5：存档恢复之后、玩家可操作之前）。
      // 观察员暂停中的存档不结算（暂停冻结一切结算，与 tick 口径一致），时间戳照常消费。
      // 离线只发三资源（A2 决策保留）：不触碰 runPlaySec / lastProgressSec / 战斗 / 归隐 / 关卡。
      let offlineSettlement: OfflineSettleResult | null = null;
      if (savedAt !== null && !merged.paused) {
        const r = calculateOfflineRewards({
          currentMaxIdleStage: maxIdleStage(merged.clearedStages),
          lastSeenAt: savedAt,
          now,
          capOverrideMin: getDebugOfflineCap(),
        });
        // <5 秒视为无离线时段（会话内热刷新），不入账不上报——A5 在线连续处理的实现下界
        if (r.rawSec >= 5) {
          merged.dantian += r.neili;
          merged.silver += r.silver;
          merged.xp += r.xp;
          track('offline_settled', { run: merged.run, realm: merged.realm, route: merged.route }, {
            raw_offline_s: Math.round(r.rawSec),
            effective_min: Math.round(r.effectiveMin * 100) / 100,
            cap_min: r.capMin,
            capped: r.capped,
            stage_basis: r.stageBasis,
            tier_id: r.tier.id,
            efficiency: r.efficiency,
            neili: r.neili, silver: r.silver, xp: r.xp,
            silent: r.silent,
            debug_cap: r.debugCap,
          });
          if (!r.silent) offlineSettlement = r;
        }
      }
      set({ ...merged, started: true, selectedMap, offlineSettlement });
      // consume_timestamp_once（表 C）：结算后立即持久化刷新 savedAt，关页→重开恰好一次结算
      persist(get());
    } else {
      set({ ...FRESH, started: true });
      track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], carry_xp: 0 });
      persist(get());
    }
    const activeWindow = loadLiveTestWindow();
    if (activeWindow) {
      set({ liveTestWindow: activeWindow });
      emitNaturalWindowVisit(get(), activeWindow);
    }
  },

  /** 关闭出关结算屏（§6-4 衔接决策的时延锚点：settlement_closed 与 offline_settled 的 ts 差） */
  dismissOfflineSettlement: () => {
    const s = get();
    if (s.offlineSettlement === null) return;
    track('offline_settlement_closed', { run: s.run, realm: s.realm, route: s.route });
    set({ offlineSettlement: null });
  },

  startLiveTestWindow: () => {
    const s = get();
    if (!s.started || s.liveTestWindow) return;
    const record = startLiveTestWindow(TABLES_VERSION);
    set({ liveTestWindow: record });
    track('natural_window_started', { run: s.run, realm: s.realm, route: s.route }, liveTestFields(record));
    emitNaturalWindowVisit(get(), record);
  },

  endLiveTestWindow: () => {
    const s = get();
    if (!s.liveTestWindow) return;
    track('natural_window_ended', { run: s.run, realm: s.realm, route: s.route }, liveTestFields(s.liveTestWindow));
    endLiveTestWindow();
    set({ liveTestWindow: null });
  },

  applyLiveTestSwitch: (command) => {
    if (command === 1) get().startLiveTestWindow();
    else if (command === 0) get().endLiveTestWindow();
  },

  recordNaturalWindowNote: (note) => {
    const s = get();
    if (!s.liveTestWindow) return;
    track('natural_window_note', { run: s.run, realm: s.realm, route: s.route }, {
      ...liveTestFields(s.liveTestWindow),
      natural_open: note.natural_open,
      open_reason: note.open_reason.trim(),
      settlement_understood: note.settlement_understood,
      decision: note.decision.trim(),
      next_goal: note.next_goal.trim(),
      feeling: note.feeling.trim(),
    });
  },

  tick: (now) => {
    const s = get();
    if (!s.started) return;
    // 观察员暂停：一切结算冻结（挂机/活跃时长/战斗回放），净时间口径由此天然扣除暂停区间
    if (s.paused) { lastTick = now; return; }
    const dt = Math.min(Math.max((now - lastTick) / 1000, 0), 300);
    lastTick = now;

    // 挂机产出入丹田；活跃时长累计（run_duration_s 口径：页面关闭不计）
    if (dt > 0) {
      const dantian = s.dantian + effIdleRate(s) * dt;
      const runPlaySec = s.runPlaySec + dt;
      let chargeHighWater = s.chargeHighWater;
      const cost = effBreakCost(s);
      if (cost !== null) {
        const { segmentsFull } = zhoutianProgress(dantian, cost);
        while (chargeHighWater < segmentsFull) {
          chargeHighWater += 1;
          track('charge_segment_full', { run: s.run, realm: s.realm, route: s.route }, {
            realm_target: s.realm + 1, segment: chargeHighWater,
          });
        }
      }
      set({ dantian, chargeHighWater, runPlaySec });
    }

    // 归隐可用上报（§6.6 + 埋点规格 §1.4）：保底先触发的，后续击败 Boss 3 补发 standard
    const s2 = get();
    const kind = retireKind(s2);
    if (kind === 'standard' && !s2.standardNotified) {
      track('retire_unlocked', { run: s2.run, realm: s2.realm, route: s2.route }, {
        kind: 'standard', trigger: 'boss3_kill',
      });
      set({ standardNotified: true, retireToast: null });
    } else if (kind === 'fallback' && !s2.fallbackUnlocked) {
      const trigger = s2.b3Fails >= FALLBACK_FAIL_STREAK ? 'fail_streak' : 'stall_timeout';
      track('retire_unlocked', { run: s2.run, realm: s2.realm, route: s2.route }, {
        kind: 'fallback', trigger,
        detail: trigger === 'fail_streak'
          ? s2.b3Fails
          : Math.floor((s2.runPlaySec - s2.lastProgressSec) / 60),
      });
      set({ fallbackUnlocked: true, retireToast: trigger });
    }

    // 战斗回放推进
    const b = get().battle;
    if (b) {
      if (!b.resolved && b.revealed < b.result.turns.length && now >= b.nextRevealAt) {
        set({ battle: { ...b, revealed: b.revealed + 1, nextRevealAt: now + b.intervalMs } });
        const nb = get().battle!;
        if (nb.revealed >= nb.result.turns.length) resolveBattle(set, get, now);
      } else if (b.resolved && b.chainAt !== null && now >= b.chainAt) {
        const target = b.chainStage;
        set({ battle: null });
        if (target !== null && get().autoAdvance) get().challengeStage(b.map, target);
      }
    }

    if (now - lastSave > 5000) {
      lastSave = now;
      persist(get());
    }
  },

  breakthrough: () => {
    const s = get();
    const cost = effBreakCost(s);
    if (cost === null || s.dantian < cost) return;
    const realmTo = s.realm + 1;
    set({
      dantian: s.dantian - cost, realm: realmTo, chargeHighWater: 0, ceremony: realmTo,
      lastProgressSec: s.runPlaySec,
    });
    track('realm_breakthrough', { run: s.run, realm: realmTo, route: s.route }, { realm_to: realmTo });
    persist(get());
  },

  dismissCeremony: () => set({ ceremony: null }),

  selectRoute: (r) => {
    const s = get();
    if (s.route !== null) return; // 换路线（route_changed）随换线弹窗交付
    // 师门指引：择路即免费获得该路线机制节点一（非玩家调整动作，不发 mech_node_bought）
    const granted = hasNode(s.ownedRepNodes, 'shimen_zhiyin')
      ? [ROUTES[r].mechNodes[0].id] : [];
    set({ route: r, ownedMechNodes: [...new Set([...s.ownedMechNodes, ...granted])] });
    track('route_selected', { run: s.run, realm: s.realm, route: r }, { route_to: r });
    persist(get());
  },

  /**
   * 换路线（规格书 §6.4 + 内容表 §4）：已投入阅历 100% 返还（等额交换，免费赠予节点不计入）、
   * 银两摩擦费 200（轻装上路：每轮第一次免费）、武学清零重练；师门指引跟随新路线重新赠予。
   */
  switchRoute: (to) => {
    const s = get();
    if (!s.route || s.route === to) return;
    const free = hasNode(s.ownedRepNodes, 'qingzhuang_shanglu') && s.switchCount === 0;
    const fee = free ? 0 : ROUTE_SWITCH_SILVER;
    if (s.silver < fee) return;
    const refund = s.mechXpInvested;
    const granted = hasNode(s.ownedRepNodes, 'shimen_zhiyin')
      ? [ROUTES[to].mechNodes[0].id] : [];
    set({
      route: to,
      skillLevel: 0,
      silver: s.silver - fee,
      xp: s.xp + refund,
      mechXpInvested: 0,
      ownedMechNodes: granted,
      switchCount: s.switchCount + 1,
      lastProgressSec: s.runPlaySec,
    });
    track('route_changed', { run: s.run, realm: s.realm, route: to }, {
      route_from: s.route, route_to: to, xp_refunded: refund, fee_paid: fee,
    });
    persist(get());
  },

  upgradeSkill: () => {
    const s = get();
    if (!s.route) return;
    const next = s.skillLevel + 1;
    if (next > REALMS[s.realm - 1].skillCap) return;
    const cost = skillUpgradeCost(next);
    if (s.dantian < cost) return;
    set({ dantian: s.dantian - cost, skillLevel: next, lastProgressSec: s.runPlaySec });
    track('wugong_upgraded', { run: s.run, realm: s.realm, route: s.route }, {
      level_to: next, cost_neili: cost,
    });
    persist(get());
  },

  buyMechNode: (nodeId) => {
    const s = get();
    if (!s.route || s.ownedMechNodes.includes(nodeId)) return;
    const node = ROUTES[s.route].mechNodes.find((n) => n.id === nodeId);
    if (!node || s.xp < node.cost) return;
    set({
      xp: s.xp - node.cost, ownedMechNodes: [...s.ownedMechNodes, nodeId],
      mechXpInvested: s.mechXpInvested + node.cost,
      lastProgressSec: s.runPlaySec,
    });
    track('mech_node_bought', { run: s.run, realm: s.realm, route: s.route }, {
      node_id: nodeId, cost_xp: node.cost,
    });
    persist(get());
  },

  selectMap: (m) => {
    const s = get();
    if (!mapUnlocked(m, s.clearedStages)) return;
    // 切图即面向该图下一关：已结算的旧图战斗残留一并清掉（含未触发的自动连战）
    const battle = s.battle && s.battle.resolved && s.battle.map !== m ? null : s.battle;
    set({ selectedMap: m, battle });
  },

  challengeStage: (map, stage) => {
    const s = get();
    if (s.battle && !s.battle.resolved) return;
    if (!mapUnlocked(map, s.clearedStages)) return;
    const next = nextStageOf(map, s.clearedStages);
    const isRefarm = s.clearedStages.includes(stageKey(map, stage));
    if (!isRefarm && stage !== next) return; // 只能打下一关或回刷已通关卡

    const enemy = getStage(map, stage);
    const build = playerBuild(s);
    const result = fight(build, enemy, { mode: 'rng', bossDmgBonus: bossDmgBonus(s.ownedRepNodes) });
    const key = enemy.kind !== 'normal';
    const turnCount = result.turns.length;
    // Boss/精英演出 15–30 秒不可跳过（§7.1）；普通关快节奏
    const intervalMs = key
      ? Math.min(Math.max(15000 / turnCount, 900), 30000 / turnCount)
      : 650;
    set({
      failure: null,
      selectedMap: map,
      battle: {
        map, stage, enemy, result,
        revealed: 0, nextRevealAt: Date.now() + intervalMs, intervalMs,
        resolved: false, chainAt: null, chainStage: null, reward: null,
      },
    });
  },

  setAutoAdvance: (v) => {
    set({ autoAdvance: v });
    persist(get());
  },

  dismissFailure: () => set({ failure: null }),

  // ---- 归隐流程（§8.6：预览 → 二次确认 → 结算演出 → 声望阁落地） ----

  openRetire: () => {
    const s = get();
    const kind = retireKind(s);
    if (kind === null || s.retireStep !== null) return;
    set({ retireStep: 'preview' });
    track('retire_preview_opened', { run: s.run, realm: s.realm, route: s.route }, { kind });
  },

  proceedRetire: () => {
    if (get().retireStep === 'preview') set({ retireStep: 'confirm' });
  },

  cancelRetire: () => {
    const s = get();
    if (s.retireStep === null) return;
    track('retire_cancelled', { run: s.run, realm: s.realm, route: s.route }, { step: s.retireStep });
    set({ retireStep: null });
  },

  confirmRetire: () => {
    const s = get();
    if (s.retireStep !== 'confirm') return;
    const kind = retireKind(s);
    if (kind === null) return;
    const settle = settleRetire(kind, s.clearedStages, s.runPlaySec);
    track('retire_confirmed', { run: s.run, realm: s.realm, route: s.route }, {
      kind,
      prestige_base: settle.base,
      perf_bonus_pct: Math.round(settle.perfPct * 100),
      time_penalty: Math.round(settle.timePenalty * 100) / 100,
      fallback_discount: settle.discount,
      prestige_total: settle.total,
      run_duration_s: Math.round(s.runPlaySec),
      pages_gained_run: getEvents().filter((event) => event.e === 'page_acquired' && event.run === s.run).length,
    });

    const maxMap: MapNo = mapUnlocked(3, s.clearedStages) ? 3 : mapUnlocked(2, s.clearedStages) ? 2 : 1;
    const ceremonyData: RetireCeremonyData = {
      runEnded: s.run, settle, durationSec: s.runPlaySec,
      clearedCount: s.clearedStages.length, maxMap,
    };

    // 重置与保留（§8.3 + 声望经济表继承审计）：资源全清空，仅武道笔记 +40 阅历随新轮生效
    const newRun = s.run + 1;
    const xp = carryXp(s.ownedRepNodes);
    set({
      ...FRESH,
      run: newRun,
      xp,
      reputation: s.reputation + settle.total,
      repTotal: s.repTotal + settle.total,
      ownedRepNodes: s.ownedRepNodes,
      collectedPages: s.collectedPages ?? [],
      completedBooks: s.completedBooks ?? [],
      autoAdvance: s.autoAdvance,
      retireStep: null,
      retireCeremony: ceremonyData,
      retireToast: null,
      battle: null, failure: null, ceremony: null, selectedMap: 1,
    });
    track('run_start', { run: newRun, realm: 1, route: null }, {
      owned_nodes: s.ownedRepNodes, carry_xp: xp,
    });
    persist(get());
  },

  closeRetireCeremony: () => set({ retireCeremony: null }),

  dismissRetireToast: () => set({ retireToast: null }),

  buyRepNode: (id) => {
    const s = get();
    const node = REP_NODE_MAP[id];
    if (!node || s.ownedRepNodes.includes(id) || s.reputation < node.price) return;
    const reputation = s.reputation - node.price;
    set({ reputation, ownedRepNodes: [...s.ownedRepNodes, id] });
    track('prestige_node_bought', { run: s.run, realm: s.realm, route: s.route }, {
      node_id: id, price: node.price, balance_after: reputation,
    });
    persist(get());
  },

  grantPage: (pageId, channel) => {
    const s = get();
    if (channel === 'D') {
      offlinePages();
      return;
    }
    if (!isPageId(pageId)) return;
    const source = PAGE_SOURCE_TABLE.find((page) => page.page_id === pageId);
    if (!source) return;
    if (channel === 'A' && source.channel !== 'Boss_kill') return;
    if (channel === 'B' && source.channel !== 'trial_victory') return;
    const collection = {
      collectedPages: (s.collectedPages ?? []).filter(isPageId),
      completedBooks: (s.completedBooks ?? []).filter(isBookId),
    };
    const result = grantFragmentPage(collection, pageId);
    if (!result.grantedPage) return;
    set({ collectedPages: [...result.collectedPages], completedBooks: [...result.completedBooks] });
    emitPageGrant({ run: s.run, realm: s.realm, route: s.route }, result, channel);
    persist(get());
  },

  challengeTrial: (trialId) => {
    const s = get();
    const trial = TRIAL_TABLE.find((entry) => entry.trial_id === trialId);
    if (!trial || s.route !== trial.route || !s.clearedStages.includes('m2s10')) return { win: false, grantedPage: null };
    const enemy: EnemyDef = {
      ...trial.enemy_ref,
      map: 3,
      stage: 0,
      tags: [...trial.enemy_ref.tags],
      kind: 'boss',
      reward: { neili: 0, silver: 0, xp: 0 },
    };
    const result = fight(playerBuild(s), enemy, { mode: 'rng' });
    track('trial_challenged', { run: s.run, realm: s.realm, route: s.route }, {
      trial_id: trialId,
      result: result.win ? 'win' : 'loss',
    });
    if (!result.win || (s.trialWinsThisRun?.[trialId] ?? 0) > 0) return { win: result.win, grantedPage: null };
    const pageId = nextTrialPage(trialId, (s.collectedPages ?? []).filter(isPageId));
    set({ trialWinsThisRun: { ...(s.trialWinsThisRun ?? {}), [trialId]: 1 } });
    if (pageId) get().grantPage(pageId, 'B');
    else persist(get());
    return { win: true, grantedPage: pageId };
  },

  buyShopPage: (pageId) => {
    const s = get();
    if (!isPageId(pageId) || (s.shopPurchasesThisRun ?? 0) >= 1) return;
    if ((s.collectedPages ?? []).includes(pageId)) return;
    const price = shopPrice(pageId);
    if (price === null || s.reputation < price) return;
    const source = PAGE_SOURCE_TABLE.find((page) => page.page_id === pageId);
    if (!source) return;
    const purchases = (s.shopPurchasesThisRun ?? 0) + 1;
    set({ reputation: s.reputation - price, shopPurchasesThisRun: purchases });
    get().grantPage(pageId, 'C');
    track('shop_page_exchanged', { run: s.run, realm: s.realm, route: s.route }, {
      page_id: pageId,
      price_paid: price,
      shop_purchases_this_run: purchases,
    });
    persist(get());
  },

  getFragmentEffects: () => computeFragmentEffects(
    (get().completedBooks ?? []).filter(isBookId),
  ),

  getMissingPages: () => getMissingPages((get().collectedPages ?? []).filter(isPageId)),

  openManualShelf: () => {
    const s = get();
    const collectedCount = (s.collectedPages ?? []).filter(isPageId).length;
    const completedCount = (s.completedBooks ?? []).filter(isBookId).length;
    track('manual_shelf_opened', { run: s.run, realm: s.realm, route: s.route }, {
      collected_count: collectedCount,
      completed_count: completedCount,
      missing_count: PAGE_SOURCE_TABLE.length - collectedCount,
    });
  },

  // ---- 观察员会话（埋点规格 §1.1；tick 活跃秒口径天然扣除暂停区间） ----

  startSession: (testerId) => {
    const s = get();
    if (s.sessionActive) return; // 防面板状态错乱导致重复 test_session_start
    track('test_session_start', { run: s.run, realm: s.realm, route: s.route }, {
      tester_id: testerId, build: BUILD, tables_version: TABLES_VERSION, telemetry_spec: TELEMETRY_SPEC,
      missing_pages_snapshot: getMissingPages((s.collectedPages ?? []).filter(isPageId)),
    });
    set({ sessionActive: true });
    persist(get());
  },

  endSession: (reason) => {
    // 暂停中直接结束：先补发 test_resumed 闭合暂停配对，并解冻游戏
    if (get().paused) get().resumeSession();
    const s = get();
    track('test_session_end', { run: s.run, realm: s.realm, route: s.route }, { reason });
    set({ sessionActive: false });
    persist(get());
  },

  pauseSession: () => {
    const s = get();
    if (s.paused) return;
    track('test_paused', { run: s.run, realm: s.realm, route: s.route });
    set({ paused: true });
    persist(get());
  },

  resumeSession: () => {
    const s = get();
    if (!s.paused) return;
    track('test_resumed', { run: s.run, realm: s.realm, route: s.route });
    // 战斗回放的绝对时间戳随暂停顺延，防止恢复后连环补揭
    const now = Date.now();
    const b = s.battle;
    set({
      paused: false,
      battle: b ? {
        ...b,
        nextRevealAt: Math.max(b.nextRevealAt, now + b.intervalMs),
        chainAt: b.chainAt !== null ? Math.max(b.chainAt, now + 900) : null,
      } : null,
    });
    persist(get());
  },

  hardReset: () => {
    resetGame();
    resetTelemetry();
    lastTick = Date.now();
    set({
      ...FRESH, started: true, ceremony: null, battle: null, failure: null,
      selectedMap: 1, retireStep: null, retireCeremony: null, retireToast: null,
      offlineSettlement: null,
    });
    track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], carry_xp: 0 });
    persist(get());
  },
}));

/** 战斗结束结算：奖励入账、首通标记、埋点、失败诊断、Boss3 连败计数、自动连战 */
function resolveBattle(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  now: number,
) {
  const s = get();
  const b = s.battle!;
  if (b.resolved) return;
  const { enemy, result } = b;
  const key = stageKey(b.map, b.stage);
  const firstClear = !s.clearedStages.includes(key);
  const tid = targetId(enemy);
  const attempt = (s.attempts[tid] ?? 0) + 1;
  const attempts = { ...s.attempts, [tid]: attempt };
  const isKeyBattle = enemy.kind !== 'normal';
  const isBoss3 = key === BOSS3_KEY;

  let { dantian, silver, xp, b3Fails, lastProgressSec, refarmKey, refarmCount, refarmAt } = s;
  let clearedStages = s.clearedStages;
  let failure: FailureInfo | null = null;
  let rewardApplied: BattleState['reward'] = null;

  if (result.win) {
    let reward = firstClear ? enemy.reward : refarmReward(enemy);
    if (!firstClear) {
      // 连续回刷衰减（公式表 §6）：同一关连续第 n 次 ×0.8^(n−1)，间隔 10 分钟重置
      refarmCount = refarmKey === key && s.runPlaySec - refarmAt < 600 ? refarmCount + 1 : 1;
      refarmKey = key;
      refarmAt = s.runPlaySec;
      const decay = Math.pow(0.8, refarmCount - 1);
      reward = {
        neili: Math.round(reward.neili * decay),
        silver: Math.round(reward.silver * decay),
        xp: 0,
      };
    }
    // 江湖熟路：战斗内力奖励 +20%（sim 口径：仅内力；银两/阅历不乘）
    const neili = reward.neili * battleNeiliMult(s.ownedRepNodes);
    dantian += neili;
    silver += reward.silver;
    xp += reward.xp;
    rewardApplied = { neili, silver: reward.silver, xp: reward.xp, refarm: !firstClear };
    if (isBoss3) b3Fails = 0;
    if (firstClear) {
      clearedStages = [...clearedStages, key];
      lastProgressSec = s.runPlaySec;
      track('stage_first_clear', { run: s.run, realm: s.realm, route: s.route }, {
        map: b.map, stage: b.stage, kind: enemy.kind,
      });
    }
  } else {
    if (isBoss3 && s.realm >= REALMS.length) b3Fails += 1;
    const build = playerBuild(s);
    const diagCodes = diagnose(build, enemy, result, s.realm);
    failure = {
      map: b.map, stage: b.stage, enemyName: enemy.name,
      diagCodes, rounds: result.rounds,
      playerHpPct: result.playerHpPct, enemyHpPct: result.enemyHpPct,
      hitRate: result.stats.pHitRate,
      stats: result.stats, route: s.route, tags: enemy.tags,
    };
  }

  // key_battle_end：Boss/精英每次挑战（胜负都记）+ 普通关失败（埋点规格 §1.3）
  if (isKeyBattle || !result.win) {
    track('key_battle_end', { run: s.run, realm: s.realm, route: s.route }, {
      target: tid,
      tags: enemy.tags,
      result: result.win ? 'win' : 'lose',
      attempt,
      rounds: result.rounds,
      player_hp_pct: Math.round(result.playerHpPct * 1000) / 1000,
      enemy_hp_pct: Math.round(result.enemyHpPct * 1000) / 1000,
      ...(result.win ? {} : { diag: failure!.diagCodes }),
    });
  }

  // 自动连战：首通胜利推进下一关；回刷胜利回到原关（回退挂机）
  const chainStage = result.win && s.autoAdvance
    ? (firstClear ? nextStageOf(b.map, clearedStages) : b.stage)
    : null;
  set({
    dantian, silver, xp, clearedStages, attempts, failure, b3Fails, lastProgressSec,
    refarmKey, refarmCount, refarmAt,
    battle: { ...b, resolved: true, chainAt: chainStage !== null ? now + 900 : null, chainStage, reward: rewardApplied },
  });
  if (result.win && enemy.kind === 'boss') {
    const boss = tid === 'boss1' ? 'boss_1' : tid === 'boss2' ? 'boss_2' : null;
    if (boss && (s.bossKillsThisRun?.[boss] ?? 0) === 0) {
      const pageId = nextBossPage(boss, (s.collectedPages ?? []).filter(isPageId));
      set({ bossKillsThisRun: { ...(s.bossKillsThisRun ?? {}), [boss]: 1 } });
      if (pageId) {
        get().grantPage(pageId, 'A');
        const bAfter = get().battle!;
        if (bAfter && bAfter.reward) {
          set({ battle: { ...bAfter, reward: { ...bAfter.reward, grantedPageId: pageId } } });
        }
      }
    }
  }
  persist(get());
}
