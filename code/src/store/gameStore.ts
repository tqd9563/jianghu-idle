/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）+ 战斗推进（§6.2/§7）+ 归隐/声望（§8/声望经济表）
 * 丹田是内力唯一容器：只由挂机（在线 + 离线）注入，关卡不掉内力（formulas.md §6.1 v1.6）。
 * 战斗：引擎瞬时结算（RNG 模式），回合按节奏回放（Boss/精英 15–30 秒不可跳过，§7.1）。
 * 归隐：本世至少突破过一次即可（economy.md §1.4）；声望 = 基础 × 行为乘数 + 成就（§1）。
 */
import { create } from 'zustand';
import { diagnose, fight, type Build, type CombatSkill, type FightResult, type FightStats } from '../engine/combat';
import { REALMS, type RouteId } from '../engine/content';
import {
  DUNWU_INTERVAL_SEC, HUOHOU_MULT, NEIGONG, STARTER_NEIGONG, WUDAO_BIJI_WUXING, dunwuChance, neigongBuild,
  neigongOf, qiMax, rollWuxing, switchFee, tierGate, zhongAfterSwitch, zhongCost, type NeigongId,
} from '../engine/neigong';
import {
  BOSS_DROPS, DUPLICATE_SILVER, QINGZHUANG_DISCOUNT, QUALITY_PARAMS, SHOP_ITEMS, SHOP_NEIGONG_PRICE, SHOP_NEIGONG_REALM,
  SHULIAN_CARRY, WUXUE, checkFormGate, formDunwuChance, formHasEffect, formKey, formMult, formName, slotCount,
  type ShopItem, type WuxueId,
} from '../engine/wuxue';
import {
  SECTS, SECT_REALM, SECT_TASKS, isBenmen, juanceKey, sectShelf,
  type SectId, type SectItem, type SectTask, type SectTaskKind,
} from '../engine/sect';
import {
  getStage, isSealed, MAP_IDS, parseStageKey, refarmReward, stageKey, targetId, TIERS, trackKey, trackLength,
  type EnemyDef, type MapId, type TierId,
} from '../engine/enemies';
import { idleNeiliPerSec, zhoutianProgress, currentSegmentNeili, currentSegmentQuota } from '../engine/formulas';
import {
  freshInjuries, heal as healInjuries, inflict as inflictInjury, injuryFromBattle,
  idleOutputMultiplier, applyInjuriesToBuild, isHurt,
  type Injuries,
} from '../engine/injury';
import {
  REALM_ACUPOINTS, attemptAcupoint as attemptAcupointFn, breakthroughReady,
  acupointPos, chongxueGate, neiliCostFor, isMeridianComplete,
  type AcupointState,
} from '../engine/acupoints';
import {
  FAME_BOSS, FAME_ELITE, FAME_MERIDIAN, REP_NODE_MAP,
  bossDmgBonus, deepestBoss, ganwuAffordable, ganwuPrice, hasNode, isBossKey, isEliteKey,
  outputMult, settleRetire, type RepNodeId, type RetireSettle,
} from '../engine/prestige';
import {
  OFFLINE_EFFICIENCY, calculateOfflineRewards, maxIdleStage, type OfflineSettleResult,
} from '../engine/offlineRewards';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import {
  endLiveTestWindow, getDebugOfflineCap, loadGameWithVersion, loadLiveTestWindow, loadSavedAt,
  migrate, MIN_COMPATIBLE_SAVE_VERSION, SAVE_VERSION,
  resetGame, saveGame, startLiveTestWindow, type LiveTestWindowRecord,
} from '../save/storage';
import { resetTelemetry, track } from '../telemetry/telemetry';
import {
  INIT_AGE, ERA_START, ageAfter, isOldDeath, lifespanCap, minutesUntilAge, nextLife, soulMult, soulSettles,
  type DeathCause,
} from '../engine/reincarnation';

export type MapNo = MapId;

interface PersistedState {
  run: number;
  realm: number;
  /** 所修内功的路数（= NEIGONG[neigong].route）；境界 2 选内功前为 null */
  route: RouteId | null;
  /** 所修内功（sect-neigong/spec.md §1）；每世境界 2 重选 */
  neigong: NeigongId | null;
  /** 内功重数（spec §1.2，接替原门径武学等级）；每世清零 */
  zhong: number;
  /** 已跨过的台阶数（登堂 / 入室 / 大成 / 化境 / 归真，spec §1.3）；每世清零 */
  tiersPassed: number;
  /** 卡在台阶上累计的挂机秒数：每满 600 秒判一次顿悟 */
  dunwuSec: number;
  /** 已拥有的内功（跨世保留） */
  ownedNeigong: NeigongId[];
  /** 悟性（spec §3）：每世转世时随机，一世内不变 */
  wuxing: number;
  /** 已点开过的页签（跨世保留）：新出现且未点开过的页签带金点 */
  seenTabs: string[];
  dantian: number;
  silver: number;
  /** 阅历：冻结（spec §4.4），不再产出、界面隐藏，字段保留待「提升悟性」途径启用 */
  xp: number;
  reputation: number;
  repTotal: number;
  ownedRepNodes: string[];
  chargeHighWater: number;
  clearedStages: string[];
  attempts: Record<string, number>;
  autoAdvance: boolean;
  /** 本轮活跃游玩秒数（tick 累计；页面关闭期间不计 —— run_duration_s 权威口径，经济表 §6.4） */
  runPlaySec: number;
  /** 最近一次实质进展（首通/突破/武学/机制节点）时的 runPlaySec（埋点口径） */
  lastProgressSec: number;
  /** 本世 retire_unlocked 是否已上报 */
  standardNotified: boolean;
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
  /** 窍穴运行时状态（按穴 ID 索引）；突破时不清零（D1 保留到归隐），归隐时重置。可选字段兼容旧存档。 */
  acupointProgress?: Record<string, AcupointState>;
  /** 窍穴图鉴（已通窍穴 ID 列表，归隐保留为记录）。可选字段兼容旧存档。 */
  acupointLog?: string[];
  /** 伤势（injury/spec.md）：硬仗产生、随游戏内时间自愈；归隐时清零。可选字段兼容旧存档。 */
  injuries?: Injuries;
  /** 本轮因重伤累计折损的寿元年数（spec §6）；转世系统消费，归隐时清零。可选字段兼容旧存档。 */
  lifespanLost?: number;
  /** 角色年岁（reincarnation/spec.md §2）：随游戏内时间增长，每世重置为 INIT_AGE。可选字段兼容旧存档。 */
  age?: number;
  /** 本世出生时的江湖历年份（spec §6）：当前江湖历 = eraStart + (age − INIT_AGE)。跨世累进。 */
  eraStart?: number;
  /** 魂魄未稳（spec §4.1）：战死转世后挂上，年岁到 INIT_AGE + 10 时解除。 */
  soulUnsettled?: boolean;
  /** 本世时长（游戏内分钟，在线 + 有效闭关）：结算演出的「历时」；年岁速率分档后不能再由年岁反推 */
  lifeMinutes?: number;
  /** 历来到过的最高境界（跨世保留）：决定宿慧（economy.md §2） */
  peakRealm: number;
  /** 修行感悟等级（跨世保留，economy.md §3） */
  ganwuLevel: number;
  /** 本世乘区加权有效时长（小时）：基础声望 = 10 × 它（economy.md §1.1）；在线全额、离线 × 60% */
  lifeWeightedHours: number;
  /** 历来击败过的最深 Boss（跨世保留）：行为乘数「打到自己的前沿」的比较基准（economy.md §1.2） */
  deepestBossEver: number;
  /** 已领过的成就（跨世保留，一次性）：'stage:m1s8' / 'meridian:shoutaiyin' */
  fameClaimed: string[];
  /** 本世已入账的成就声望（只供归隐盘点展示） */
  fameThisLife: number;
  /** 已解锁的前沿（跨世保留）：`{图}-{难度}`；打通本图上一档 Boss 开下一档，打通初入 Boss 开下一图初入 */
  tiersUnlocked: string[];
  /** 已拥有的武学（跨世保留，sect-neigong/spec.md §6.1） */
  ownedWuxue: WuxueId[];
  /** 已拥有的招式秘籍 `武学:式`（跨世保留） */
  ownedScrolls: string[];
  /** 本世装配（每世清空） */
  equipped: WuxueId[];
  /** 每式累计出招数 `武学:式` → 次数（熟练度来源；转世 ×0.5 带入下一世） */
  formCasts: Record<string, number>;
  /** 本世顿悟领悟的招式（秘籍自带的式不记）；每世清空 */
  learnedForms: string[];
  /** 前世领悟过的招式（跨世保留）：重悟顿悟 ×3（spec S4） */
  pastLearned: string[];
  /** 已领过首杀掉落的前沿 `{图}-{难度}`（跨世保留，spec §4.3） */
  dropsClaimed: string[];
  /** 本世所拜门派（spec §5.1）：境界 3 起可拜，一世只拜一派，转世清空 */
  sect: SectId | null;
  /** 本世门派贡献（转世清零） */
  contrib: number;
  /** 正在跑的门派任务（同时只一件，到时自动结算） */
  sectTask: SectTask | null;
  /** 拜山传闻待说：突破入境界 2 时置上，下一场战斗的战斗记录说一次 */
  rumorPending: boolean;
}

export interface BattleState {
  map: MapNo;
  tier: TierId;
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
  /** 胜利实际入账（收益行同源同值）；fame = 本场首通精英 / Boss 的名号声望 */
  reward: { neili: number; silver: number; refarm: boolean; fame?: number; drop?: string } | null;
  /** 本场战斗记录开头说一句拜山传闻 */
  rumor?: boolean;
}

export interface FailureInfo {
  map: MapNo;
  tier: TierId;
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

export type RetireKind = 'standard';

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
  /** 谢幕方式：主动归隐为 null；'old' 寿终正寝（自动归隐，不罚）；'battle' 战死（来世魂魄未稳） */
  cause: DeathCause | null;
  /** 谢幕年岁（整岁取下），供卡顶行「{N} 岁 · 寿终正寝 / 重伤不治」 */
  deathAge: number;
  /** 本世时长（分钟，在线 + 有效闭关） */
  lifeMinutes: number;
  /** 本世通关的精英与 Boss 数 */
  strongFoes: number;
  /** 是否踏平黑风寨（华山古道 Boss） */
  boss3: boolean;
}

interface GameState extends PersistedState {
  started: boolean;
  ceremony: number | null;
  selectedMap: MapNo;
  selectedTier: TierId;
  battle: BattleState | null;
  pendingTab: string | null;
  failure: FailureInfo | null;
  retireStep: 'preview' | 'confirm' | null;
  retireCeremony: RetireCeremonyData | null;
  /** 出关结算待呈现数据（MVP-1 §6；资源已在 init 入账，此处只驱动结算屏；非持久化） */
  offlineSettlement: OfflineSettleResult | null;
  /** 独立持久化的自然测试窗口；不进入游戏存档。 */
  liveTestWindow: LiveTestWindowRecord | null;
  /** 刚发生的顿悟（台阶名），供一次性轻提示；非持久化 */
  dunwuNotice: string | null;
  init: () => void;
  dismissOfflineSettlement: () => void;
  startLiveTestWindow: () => void;
  endLiveTestWindow: () => void;
  applyLiveTestSwitch: (command: 1 | 0 | null) => void;
  recordNaturalWindowNote: (note: NaturalWindowNote) => void;
  tick: (now: number) => void;
  breakthrough: () => void;
  attemptAcupoint: (acupointId: string) => void;
  dismissCeremony: () => void;
  /** 境界 2 选定本世所修内功（每世开头，免费） */
  selectNeigong: (id: NeigongId) => void;
  /** 一世之内转修（spec §1.5）：同路数少 3 重，跨路数归零，台阶重新顿悟，收手续费 */
  switchNeigong: (to: NeigongId) => void;
  /** 灌注内力升一重（被台阶挡住时不可升） */
  upgradeZhong: () => void;
  dismissDunwu: () => void;
  /** 点开页签：记入已见，金点消失 */
  seeTab: (tab: string) => void;
  /** 装上 / 卸下武学（spec §2.4，装卸无成本） */
  equipWuxue: (id: WuxueId) => void;
  unequipWuxue: (id: WuxueId) => void;
  /** 书肆购买（spec §4.2） */
  buyShopItem: (itemId: string) => void;
  /** 拜入门派（spec §5.1）：境界 3 起，免费，不受路数限制，一世一派 */
  joinSect: (id: SectId) => void;
  /** 派门派任务（spec §5.2）：同时只一件 */
  startSectTask: (kind: SectTaskKind) => void;
  /** 贡献商店兑换（spec §5.3） */
  buySectItem: (itemId: string) => void;
  selectMap: (m: MapNo) => void;
  selectTier: (t: TierId) => void;
  challengeStage: (map: MapNo, tier: TierId, stage: number) => void;
  setAutoAdvance: (v: boolean) => void;
  dismissFailure: () => void;
  openRetire: () => void;
  proceedRetire: () => void;
  cancelRetire: () => void;
  confirmRetire: () => void;
  closeRetireCeremony: () => void;
  buyRepNode: (id: RepNodeId) => void;
  /** 修行感悟：'one' 买一级，'all' 买到买不起为止（economy.md §3） */
  buyGanwu: (mode: 'one' | 'all') => void;
  startSession: (testerId: string) => void;
  endSession: (reason: 'completed' | 'external_dropout' | 'design_dropout') => void;
  pauseSession: () => void;
  resumeSession: () => void;
  hardReset: () => void;
}

const FRESH: PersistedState = {
  run: 1, realm: 1, route: null, neigong: null, zhong: 0, tiersPassed: 0, dunwuSec: 0,
  ownedNeigong: [...STARTER_NEIGONG], wuxing: 1, seenTabs: [],
  dantian: 0, silver: 0, xp: 0,
  reputation: 0, repTotal: 0,
  ownedRepNodes: [], chargeHighWater: 0,
  clearedStages: [], attempts: {}, autoAdvance: true,
  runPlaySec: 0, lastProgressSec: 0, standardNotified: false,
  refarmKey: null, refarmCount: 0, refarmAt: 0,
  sessionActive: false, paused: false,
  acupointProgress: {}, acupointLog: [],
  injuries: freshInjuries(), lifespanLost: 0,
  age: INIT_AGE, eraStart: ERA_START, soulUnsettled: false, lifeMinutes: 0,
  peakRealm: 1, ganwuLevel: 0, lifeWeightedHours: 0,
  deepestBossEver: 0, fameClaimed: [], fameThisLife: 0,
  tiersUnlocked: ['1-0'],
  ownedWuxue: [], ownedScrolls: [], equipped: [], formCasts: {}, learnedForms: [], pastLearned: [], dropsClaimed: [],
  sect: null, contrib: 0, sectTask: null, rumorPending: false,
};

/** 页面关闭期间不结算任何收益：lastTick 不入存档，init 时重置为当下 */
let lastTick = 0;
let lastSave = 0;
let visitedLiveTestWindowId: string | null = null;


/**
 * 持久化键 = FRESH 的全部键。不再手写字段清单：旧清单漏了窍穴进度、窍穴图鉴、伤势、折寿
 * 四个字段（PR #15/#16 新增时没同步），刷新页面即丢。新增持久化字段只需在 FRESH 给默认值。
 */
const PERSIST_KEYS = Object.keys(FRESH) as (keyof PersistedState)[];
const persist = (s: PersistedState) =>
  saveGame(Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k] ?? FRESH[k]])));

/** 前沿是否已解锁（跨世保留，pacing/design.md §3.2）；封存的永远不开 */
export function tierUnlocked(map: MapNo, tier: TierId, tiersUnlocked: readonly string[]): boolean {
  return !isSealed(map, tier) && tiersUnlocked.includes(trackKey(map, tier));
}

/** 地图页签是否可进：初入已解锁 */
export function mapUnlocked(map: MapNo, tiersUnlocked: readonly string[]): boolean {
  return tierUnlocked(map, 0, tiersUnlocked);
}

/** 本前沿下一待通关关卡；全通返回 null */
export function nextStageOf(map: MapNo, tier: TierId, cleared: readonly string[]): number | null {
  const n = trackLength(map, tier);
  for (let i = 1; i <= n; i++) {
    if (!cleared.includes(stageKey(map, tier, i))) return i;
  }
  return null;
}

/** 打通段末 Boss 解锁的前沿：本图下一档；若是初入，另开下一图初入（封存的不开） */
function unlocksAfterBoss(map: MapNo, tier: TierId): string[] {
  const out: string[] = [];
  if (tier < 2 && !isSealed(map, (tier + 1) as TierId)) out.push(trackKey(map, (tier + 1) as TierId));
  const nextMap = (map + 1) as MapNo;
  if (tier === 0 && MAP_IDS.includes(nextMap) && !isSealed(nextMap, 0)) out.push(trackKey(nextMap, 0));
  return out;
}

/** 今天还有关可推的前沿（已解锁且未全通），供战斗页金点与默认选关 */
export function openFronts(s: Pick<PersistedState, 'tiersUnlocked' | 'clearedStages'>): { map: MapNo; tier: TierId }[] {
  const out: { map: MapNo; tier: TierId }[] = [];
  for (const map of MAP_IDS) {
    for (const tier of TIERS) {
      if (tierUnlocked(map, tier, s.tiersUnlocked ?? []) && nextStageOf(map, tier, s.clearedStages) !== null) {
        out.push({ map, tier });
      }
    }
  }
  return out;
}

export function playerBuild(
  s: Pick<PersistedState, 'realm' | 'neigong' | 'zhong' | 'tiersPassed' | 'injuries'>,
): Build {
  const base = s.neigong
    ? neigongBuild(s.neigong, s.realm, s.zhong, s.tiersPassed)
    // 未选内功（境界 1）：纯基础属性
    : {
        hp: REALMS[s.realm - 1].hp, atk: REALMS[s.realm - 1].atk, plainMult: 1,
        def: REALMS[s.realm - 1].def, hit: REALMS[s.realm - 1].accuracy,
        dodge: REALMS[s.realm - 1].evasion,
        crit: 0.05, cd: 1.5, firstCrit: false, shieldPct: 0, thorns: 0,
        poison: { init: 0, perHit: 0, coef: 0, cap: 0, burst: 0 },
        sqNeed: 99, burstMult: 0, lowhpDr: 0, route: 'huashan' as RouteId,
      };
  // 伤势在最后一层叠加（injury/spec.md §0 红线：只改喂进 fight() 的 Build，不碰 fight()）
  return applyInjuriesToBuild(base, s.injuries ?? freshInjuries());
}

/** 所修内功的火候品质倍率（未选内功为 1），供 computeAttributes 展示用 */
export function huohouMultOf(s: Pick<PersistedState, 'neigong'>): number {
  return s.neigong ? HUOHOU_MULT[NEIGONG[s.neigong].quality] : 1;
}

// ---------------------------------------------------------------- 武学（sect-neigong/spec.md §2）

type WuxueState = Pick<PersistedState, 'realm' | 'neigong' | 'zhong' | 'ownedWuxue' | 'ownedScrolls' | 'equipped'
  | 'formCasts' | 'learnedForms' | 'pastLearned'> & Partial<Pick<PersistedState, 'sect'>>;

/** 当前真气上限（未选内功为 0） */
export function qiMaxOf(s: Pick<PersistedState, 'realm' | 'neigong' | 'zhong'>): number {
  return s.neigong ? qiMax(s.realm, s.zhong, NEIGONG[s.neigong].quality) : 0;
}

/** 这门武学已领悟的式：秘籍自带前几式 + 本世顿悟的式 */
export function learnedFormsOf(s: Pick<PersistedState, 'learnedForms'>, id: WuxueId): number[] {
  const p = QUALITY_PARAMS[WUXUE[id].quality];
  return Array.from({ length: p.forms }, (_, i) => i + 1)
    .filter((k) => k <= p.given || (s.learnedForms ?? []).includes(formKey(id, k)));
}

/** 装配转成战斗用的武学表：只列已领悟的式，倍率含熟练与共鸣 */
export function buildLoadout(s: WuxueState): CombatSkill[] {
  const route = s.neigong ? NEIGONG[s.neigong].route : null;
  return (s.equipped ?? []).map((id) => {
    const d = WUXUE[id];
    const p = QUALITY_PARAMS[d.quality];
    const res = d.route !== null && d.route === route;
    return {
      id, name: d.name, cost: p.cost, cd: p.cd,
      forms: learnedFormsOf(s, id).map((k) => ({
        key: formKey(id, k), name: formName(k),
        mult: formMult(d.quality, k, (s.formCasts ?? {})[formKey(id, k)] ?? 0, res, isBenmen(s.sect ?? null, id)),
        effect: formHasEffect(d, k) ? d.effect : null,
      })),
    };
  });
}

/** 书肆实价：轻装上路八折（spec S9） */
export function shopPriceOf(s: Pick<PersistedState, 'ownedRepNodes'>, price: number): number {
  return Math.round(price * (hasNode(s.ownedRepNodes, 'qingzhuang_shanglu') ? QINGZHUANG_DISCOUNT : 1));
}

/** 书肆的上乘内功：尚未拥有的第一部（惊雷、镇岳、蚀骨顺序）；都有了为 null */
export function shopNeigongOf(s: Pick<PersistedState, 'ownedNeigong'>): NeigongId | null {
  return (['huashan', 'shaolin', 'tangmen'] as const).map((r) => neigongOf(r, '上乘'))
    .find((id) => !(s.ownedNeigong ?? []).includes(id)) ?? null;
}

/** 书肆货架（含动态的上乘内功一件）；招式秘籍只陈列已拥有武学的 */
export function shopItemsOf(s: Pick<PersistedState, 'ownedNeigong' | 'ownedWuxue'>): ShopItem[] {
  const ng = shopNeigongOf(s);
  const items = SHOP_ITEMS.filter((it) => it.kind !== 'scroll' || (s.ownedWuxue ?? []).includes(it.wuxue!));
  return ng ? [...items, {
    id: `neigong:${ng}`, label: NEIGONG[ng].name, price: SHOP_NEIGONG_PRICE, realm: SHOP_NEIGONG_REALM, kind: 'neigong',
  }] : items;
}

/**
 * 战后结算武学（spec §2.2 / §2.3 / §3）：累计每式出招数；每门武学按本场出招次数判顿悟，
 * 下一式条件都满足才判，一场最多悟一式。返回新状态与顿悟到的招式名。
 */
function settleWuxue(
  s: WuxueState & Pick<PersistedState, 'wuxing' | 'ownedRepNodes'>, stats: FightStats, rand: () => number,
): { formCasts: Record<string, number>; learnedForms: string[]; learned: string[] } {
  const formCasts = { ...(s.formCasts ?? {}) };
  for (const [k, n] of Object.entries(stats.formCasts)) formCasts[k] = (formCasts[k] ?? 0) + n;
  const learnedForms = [...(s.learnedForms ?? [])];
  const learned: string[] = [];
  const qi = qiMaxOf(s);
  const shimen = hasNode(s.ownedRepNodes, 'shimen_zhiyin');
  for (const [id, n] of Object.entries(stats.skillCasts) as [WuxueId, number][]) {
    const d = WUXUE[id];
    const have = learnedFormsOf({ learnedForms }, id);
    const k = have.length + 1;
    if (k > QUALITY_PARAMS[d.quality].forms) continue;
    const key = formKey(id, k);
    const gate = checkFormGate(d, k, s.realm, qi, (s.ownedScrolls ?? []).includes(key),
      formCasts[formKey(id, k - 1)] ?? 0, isBenmen(s.sect ?? null, id));
    if (!gate.ready) continue;
    const p = formDunwuChance(d.quality, s.wuxing ?? 1, (s.pastLearned ?? []).includes(key), shimen);
    for (let i = 0; i < n; i++) {
      if (rand() < p) { learnedForms.push(key); learned.push(`${d.name} · ${formName(k)}`); break; }
    }
  }
  return { formCasts, learnedForms, learned };
}

/** 升重是否被台阶挡住；归真要先有本内功的归真卷册（门派贡献商店） */
export function zhongGate(s: Pick<PersistedState, 'neigong' | 'zhong' | 'tiersPassed'> & Partial<Pick<PersistedState, 'ownedScrolls'>>) {
  return s.neigong ? tierGate(NEIGONG[s.neigong].quality, s.zhong, s.tiersPassed,
    (s.ownedScrolls ?? []).includes(juanceKey(s.neigong))) : null;
}

// ---------------------------------------------------------------- 门派（sect-neigong/spec.md §5）

export type SectShelfRow = SectItem & {
  owned: boolean;
  /** 陈列但还不能换的原因（先得前一件）；null = 可换 */
  lock: string | null;
};

/** 本派货架逐件的状态：招式秘籍要先有该武学与前一式秘籍，归真卷册要先有本派绝学内功 */
export function sectShelfOf(s: Pick<PersistedState, 'ownedNeigong' | 'ownedWuxue' | 'ownedScrolls'>, id: SectId): SectShelfRow[] {
  const ng = SECTS[id].neigong;
  return sectShelf(id).map((it) => {
    const scrolls = s.ownedScrolls ?? [];
    if (it.kind === 'neigong') return { ...it, owned: (s.ownedNeigong ?? []).includes(ng), lock: null };
    if (it.kind === 'wuxue') return { ...it, owned: (s.ownedWuxue ?? []).includes(it.wuxue!), lock: null };
    if (it.kind === 'juance') {
      return { ...it, owned: scrolls.includes(juanceKey(ng)),
        lock: (s.ownedNeigong ?? []).includes(ng) ? null : `先得${NEIGONG[ng].name}` };
    }
    const w = it.wuxue!;
    const lock = !(s.ownedWuxue ?? []).includes(w) ? `先得${WUXUE[w].name}`
      : it.form! > 5 && !scrolls.includes(formKey(w, it.form! - 1)) ? `先得${formName(it.form! - 1)}` : null;
    return { ...it, owned: scrolls.includes(formKey(w, it.form!)), lock };
  });
}

/** 到点的门派任务结算入账；没到点或没任务返回 null */
function settleSectTask(s: Pick<PersistedState, 'sectTask' | 'contrib'>, now: number): Partial<PersistedState> | null {
  const t = s.sectTask;
  if (!t || now < t.endsAt) return null;
  return { sectTask: null, contrib: (s.contrib ?? 0) + SECT_TASKS[t.kind].contrib };
}

/**
 * 卡在台阶上时推进顿悟（spec §1.3）：累计挂机秒数，每满 600 秒按「概率 × 悟性」判一次。
 * 一次最多跨一阶——跨过后要先升重才会撞上下一阶。返回新状态与是否顿悟。
 */
function advanceDunwu(
  s: Pick<PersistedState, 'neigong' | 'zhong' | 'tiersPassed' | 'dunwuSec' | 'wuxing' | 'ownedScrolls'>, dtSec: number, rand: () => number,
): { tiersPassed: number; dunwuSec: number; tier: string | null } {
  const gate = zhongGate(s);
  if (!gate || gate.needScroll) return { tiersPassed: s.tiersPassed, dunwuSec: 0, tier: null };
  let acc = (s.dunwuSec ?? 0) + dtSec;
  while (acc >= DUNWU_INTERVAL_SEC) {
    acc -= DUNWU_INTERVAL_SEC;
    if (rand() < dunwuChance(gate.tier, s.wuxing ?? 1)) {
      return { tiersPassed: s.tiersPassed + 1, dunwuSec: 0, tier: gate.tier.name };
    }
  }
  return { tiersPassed: s.tiersPassed, dunwuSec: acc, tier: null };
}

/** 离开本境界要缴清的内力总额（content.md §1「离开本境界」行口径）；本版不可再突破返回 null */
export function effBreakCost(s: Pick<PersistedState, 'realm'>): number | null {
  return REALMS[s.realm - 1]?.leaveCost ?? null;
}

/** 离开本境界的周天段数 N（与 effBreakCost 同一行） */
export function zhoutianN(realm: number): number {
  return REALMS[realm - 1]?.zhoutianCount ?? 1;
}

/** 产出乘区 M = 1 + 宿慧 + 修行感悟（formulas.md §3.2）；声望按它加权 */
export function currentMult(s: Pick<PersistedState, 'peakRealm' | 'ganwuLevel'>): number {
  return outputMult(s.peakRealm ?? 1, s.ganwuLevel ?? 0);
}

/** 有效挂机产出 = 境界基础 × 乘区 M × 伤势压制（injury/spec.md §3）× 魂魄未稳（reincarnation/spec.md §4.1） */
export function effIdleRate(
  s: Pick<PersistedState, 'realm' | 'peakRealm' | 'ganwuLevel' | 'injuries' | 'soulUnsettled'>,
): number {
  return idleNeiliPerSec(s.realm) * currentMult(s)
    * idleOutputMultiplier(s.injuries ?? freshInjuries())
    * soulMult(s.soulUnsettled ?? false);
}

/**
 * 归隐门槛（economy.md §1.4 v2.1）：本世至少突破过一次。每世从境界 1 起步，故等价于「境界 ≥ 2」。
 * 武侠说法：未有所成，何以言归隐。保底归隐整套废止。
 */
export function retireKind(s: Pick<PersistedState, 'realm'>): RetireKind | null {
  return s.realm >= 2 ? 'standard' : null;
}

/** 成就入账：未领过的 key 发放 k × 当前乘区声望（economy.md §1.3，即时入账） */
function claimFame(s: PersistedState, key: string, k: number): Partial<PersistedState> & { fame: number } {
  if ((s.fameClaimed ?? []).includes(key)) return { fame: 0 };
  const fame = Math.floor(k * currentMult(s));
  return {
    fame,
    fameClaimed: [...(s.fameClaimed ?? []), key],
    fameThisLife: (s.fameThisLife ?? 0) + fame,
    reputation: s.reputation + fame,
    repTotal: s.repTotal + fame,
  };
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
    const p = parseStageKey(key);
    if (!p) continue;
    const order = p.tier * 10000 + p.map * 100 + p.stage;
    if (!best || order > best.order) best = { key, order };
  }
  return best?.key ?? null;
}

function visitSnapshot(s: GameState) {
  const breakCost = effBreakCost(s);
  const decisionBattle = openFronts(s).length > 0;
  return {
    max_cleared_stage: maxClearedStage(s.clearedStages),
    cleared_stage_count: s.clearedStages.length,
    offline_settlement_present: s.offlineSettlement !== null,
    offline_settlement_capped: s.offlineSettlement?.capped ?? null,
    decision_breakthrough: breakCost !== null && s.dantian >= breakCost,
    decision_skill: s.neigong !== null && zhongGate(s) === null && s.dantian >= zhongCost(s.zhong + 1),
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
  dunwuNotice: null,
  started: false,
  ceremony: null,
  selectedMap: 1,
  selectedTier: 0,
  battle: null,
  pendingTab: null,
  failure: null,
  retireStep: null,
  retireCeremony: null,
  offlineSettlement: null,
  liveTestWindow: null,

  init: () => {
    if (get().started) return;
    // 按存档版本迁移后再 merge（v2→v3 窍穴 id 重写）。此前直接 loadGame()，
    // migrate() 是从未被调用的死代码。
    const loaded = loadGameWithVersion<PersistedState>();
    // 长线前的旧存档强制重开（storage.ts MIN_COMPATIBLE_SAVE_VERSION）：数值量级不兼容，不迁移
    const obsolete = loaded !== null && loaded.version < MIN_COMPATIBLE_SAVE_VERSION;
    if (obsolete) resetGame();
    const saved = loaded && !obsolete ? migrate(loaded.state, loaded.version, SAVE_VERSION) : null;
    const savedAt = loadSavedAt();
    const now = Date.now();
    lastTick = now;
    if (saved) {
      const merged = { ...FRESH, ...saved };
      // 默认面向最深的一条可推前沿
      const fronts = openFronts(merged);
      const front = fronts[fronts.length - 1] ?? { map: 1 as MapNo, tier: 0 as TierId };
      const selectedMap = front.map;
      const selectedTier = front.tier;

      // 出关结算（MVP-1 §5：回归上线一次性结算；A5：存档恢复之后、玩家可操作之前）。
      // 观察员暂停中的存档不结算（暂停冻结一切结算，与 tick 口径一致），时间戳照常消费。
      // 离线只发三资源（A2 决策保留）：不触碰 runPlaySec / lastProgressSec / 战斗 / 归隐 / 关卡。
      let offlineSettlement: OfflineSettleResult | null = null;
      let dunwuNotice: string | null = null;
      if (savedAt !== null && !merged.paused) {
        const r = calculateOfflineRewards({
          currentMaxIdleStage: maxIdleStage(merged.clearedStages),
          lastSeenAt: savedAt,
          now,
          capOverrideMin: getDebugOfflineCap(),
          // 离线内力 = 在线速率（含全部乘区）× 60%（offline-rewards.md §1.1 v2.0）
          neiliPerSec: effIdleRate(merged),
        });
        // <5 秒视为无离线时段（会话内热刷新），不入账不上报——A5 在线连续处理的实现下界
        if (r.rawSec >= 5) {
          // 闭关中寿终（reincarnation/spec.md §2.3）：结算到寿终那一刻为止，之后的离线时间不计
          const peak = merged.peakRealm ?? 1;
          const deathMin = minutesUntilAge(
            merged.age ?? INIT_AGE, lifespanCap(merged.realm, merged.lifespanLost ?? 0), peak,
          );
          const k = r.effectiveMin > deathMin ? deathMin / r.effectiveMin : 1;
          const liveMin = r.effectiveMin * k;
          merged.dantian += r.neili * k;
          merged.silver += Math.round(r.silver * k);
          // 阅历冻结（sect-neigong/spec.md §4.4）：离线不再产出
          // 卡在台阶上时，闭关同样判顿悟（spec §1.3「在线离线都算」）
          const dw = advanceDunwu(merged, liveMin * 60, Math.random);
          merged.tiersPassed = dw.tiersPassed;
          merged.dunwuSec = dw.dunwuSec;
          if (dw.tier) dunwuNotice = dw.tier;
          // 基础声望的离线部分：乘区加权时长按 60% 折算（economy.md §1.1）
          merged.lifeWeightedHours = (merged.lifeWeightedHours ?? 0)
            + (liveMin / 60) * OFFLINE_EFFICIENCY * currentMult(merged);
          // 离线同样养伤（injury/spec.md §5）：按封顶后的结算时长恢复，
          // 且离线不打仗、不会新受伤——下线休息即安全静养。
          merged.injuries = healInjuries(
            merged.injuries ?? freshInjuries(), liveMin, merged.realm,
          );
          // 离线同样变老（reincarnation/spec.md §2.3）：与在线同速率，只受离线封顶截断
          merged.age = ageAfter(merged.age ?? INIT_AGE, liveMin, peak);
          merged.lifeMinutes = (merged.lifeMinutes ?? 0) + liveMin;
          if (merged.soulUnsettled && soulSettles(merged.age)) merged.soulUnsettled = false;
          track('offline_settled', { run: merged.run, realm: merged.realm, route: merged.route }, {
            raw_offline_s: Math.round(r.rawSec),
            effective_min: Math.round(r.effectiveMin * 100) / 100,
            cap_min: r.capMin,
            capped: r.capped,
            stage_basis: r.stageBasis,
            tier_id: r.tier.id,
            efficiency: r.efficiency,
            neili: r.neili, silver: r.silver,
            silent: r.silent,
            debug_cap: r.debugCap,
          });
          if (!r.silent) offlineSettlement = r;
        }
      }
      // 门派任务离线照常计时（spec §5.2）：到点的在载入时入账
      const sectDone = savedAt !== null && !merged.paused ? settleSectTask(merged, now) : null;
      if (sectDone) {
        track('sect_task_done', { run: merged.run, realm: merged.realm, route: merged.route }, {
          sect: merged.sect, task: merged.sectTask!.kind, contrib: sectDone.contrib, offline: true,
        });
        Object.assign(merged, sectDone);
      }
      set({ ...merged, started: true, selectedMap, selectedTier, offlineSettlement, dunwuNotice });
      if (isOldDeath(merged.age ?? INIT_AGE, merged.realm, merged.lifespanLost ?? 0)) {
        // 闭关期间寿终正寝：自动归隐，出关结算屏不再有意义，直接进归隐演出
        set({ offlineSettlement: null });
        rebirth(set, get, 'old');   // rebirth 自带持久化
      } else {
        // consume_timestamp_once（表 C）：结算后立即持久化刷新 savedAt，关页→重开恰好一次结算
        persist(get());
      }
    } else {
      set({ ...FRESH, wuxing: rollWuxing(Math.random()), started: true });
      track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], wuxing: get().wuxing });
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
      const cost = effBreakCost(s);
      let dantian = s.dantian + effIdleRate(s) * dt;
      const runPlaySec = s.runPlaySec + dt;
      const lifeWeightedHours = (s.lifeWeightedHours ?? 0) + (dt / 3600) * currentMult(s);
      let chargeHighWater = s.chargeHighWater;
      if (cost !== null) {
        // 丹田上限 = 突破消耗。v4.0 起满额后产出无处可去（旧「溢出转气势」已随 D5/v4.0 废止）。
        if (dantian > cost) dantian = cost;
        // N 段动态（zhoutian/design.md §3.1：境界 1–5 = 4/3/4/6/8，段间公比 2）
        const N = zhoutianN(s.realm);
        const { segmentsFull } = zhoutianProgress(dantian, cost, N);
        while (chargeHighWater < segmentsFull) {
          chargeHighWater += 1;
          // 周天圆满给三样：缴清一期账、丹田扩容、内力行至下一穴（design.md §2）。
          // 前两样由 chargeHighWater 本身承载，第三样由 isLoosened 按高水位导出，无需另存字段。
          track('charge_segment_full', { run: s.run, realm: s.realm, route: s.route }, {
            realm_target: s.realm + 1, segment: chargeHighWater,
          });
        }
      }
      // 伤势自愈：与挂机共用同一游戏内时钟（injury/spec.md §5）
      const prevInj = s.injuries ?? freshInjuries();
      const injuries = isHurt(prevInj) ? healInjuries(prevInj, dt / 60, s.realm) : prevInj;
      // 年岁同一时钟（reincarnation/spec.md §2）：角色老一岁，江湖历走一年
      const age = ageAfter(s.age ?? INIT_AGE, dt / 60, s.peakRealm ?? 1);
      const lifeMinutes = (s.lifeMinutes ?? 0) + dt / 60;
      // 魂魄未稳：转世后前 10 年（spec §4.1）
      const soulUnsettled = (s.soulUnsettled ?? false) && !soulSettles(age);
      // 卡在台阶上：挂机累计判顿悟（spec §1.3）
      const dw = advanceDunwu(s, dt, Math.random);
      const sectDone = settleSectTask(s, now);
      set({
        dantian, chargeHighWater, runPlaySec, injuries, age, lifeWeightedHours, lifeMinutes, soulUnsettled,
        tiersPassed: dw.tiersPassed, dunwuSec: dw.dunwuSec,
        ...(dw.tier ? { dunwuNotice: dw.tier, lastProgressSec: runPlaySec } : {}),
        ...sectDone,
      });
      if (sectDone) {
        track('sect_task_done', { run: s.run, realm: s.realm, route: s.route }, {
          sect: s.sect, task: s.sectTask!.kind, contrib: sectDone.contrib, offline: false,
        });
      }
      if (dw.tier) {
        track('dunwu', { run: s.run, realm: s.realm, route: s.route }, {
          neigong: s.neigong, tier: dw.tier, zhong: s.zhong, wuxing: s.wuxing,
        });
      }
      if (isOldDeath(age, s.realm, s.lifespanLost ?? 0)) {
        rebirth(set, get, 'old');
        return;
      }
    }

    // 归隐可用上报（埋点规格 §1.4）：本世首次突破后可归隐
    const s2 = get();
    if (retireKind(s2) && !s2.standardNotified) {
      track('retire_unlocked', { run: s2.run, realm: s2.realm, route: s2.route }, {
        kind: 'standard', trigger: 'first_breakthrough',
      });
      set({ standardNotified: true });
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
        if (target !== null && get().autoAdvance) get().challengeStage(b.map, b.tier, target);
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
    // 双条件校验（design.md §4）：N 段缴清 且 本境界首条经脉贯通。
    // 门槛按境界计，不跨境界累计——每境界重建窍穴池。
    if (!breakthroughReady(s.dantian, cost, s.realm, s.acupointProgress ?? {})) return;
    const realmTo = s.realm + 1;
    const firstReach = realmTo > (s.peakRealm ?? 1);
    // 窍穴图鉴更新（归隐保留，spec §8）
    const newAcupointLog = [...new Set([
      ...(s.acupointLog ?? []),
      ...Object.entries(s.acupointProgress ?? {})
        .filter(([, a]) => a.opened)
        .map(([id]) => id),
    ])];
    set({
      dantian: s.dantian - cost, realm: realmTo, chargeHighWater: 0, ceremony: realmTo,
      lastProgressSec: s.runPlaySec,
      // 窍穴进度保留（D1 保留到归隐）；窍穴松动随 chargeHighWater 归零而重置
      acupointLog: newAcupointLog,
      // 首达新境界即得宿慧（economy.md §2），当场生效
      peakRealm: Math.max(s.peakRealm ?? 1, realmTo),
      // 拜山传闻（spec §5.1）：入境界 2 时突破仪式说一次，下一场战斗记录再说一次
      ...(realmTo === 2 ? { rumorPending: true } : {}),
    });
    track('realm_breakthrough', { run: s.run, realm: realmTo, route: s.route }, {
      realm_to: realmTo, first_reach: firstReach,
    });
    persist(get());
  },

  /**
   * 冲穴（design.md §2/§3.3）：从当前段扣所需真气，**成败同扣**——失败即真气耗散，
   * 这就是惩罚；下次同穴 +10pp。门槛（松动 / 循序 / 真气够）由 chongxueGate 判定。
   */
  attemptAcupoint: (acupointId: string) => {
    const s = get();
    const realm = s.realm;
    const cost = effBreakCost(s);
    if (cost === null) return;
    const acupointData = REALM_ACUPOINTS[realm];
    if (!acupointData) return;  // 境界 6/7 无窍穴
    if (!acupointData.acupoints.some(a => a.id === acupointId)) return;

    const N = zhoutianN(realm);
    const segmentQuota = currentSegmentQuota(cost, N, s.chargeHighWater);
    const segmentNeili = currentSegmentNeili(s.dantian, cost, N, s.chargeHighWater);
    const progress = s.acupointProgress ?? {};
    const gate = chongxueGate({
      realm, acupointId, progress,
      chargeHighWater: s.chargeHighWater, zhoutianCount: N,
      segmentNeili, segmentQuota,
    });
    if (gate !== 'ok') return;

    const neiliCost = neiliCostFor(realm, acupointId, segmentQuota);
    const current = progress[acupointId] ?? { failCount: 0, opened: false };
    const pos = acupointPos(realm, acupointId);
    const result = attemptAcupointFn(current, pos, Math.random());

    const nextProgress = {
      ...progress,
      [acupointId]: { failCount: result.newFailCount, opened: result.opened },
    };
    // 首次贯通一条经脉：成就声望（economy.md §1.3）
    const meridian = acupointData.meridians.find(m => m.acupointIds.includes(acupointId))!;
    const openedIds = new Set(Object.entries(nextProgress).filter(([, a]) => a.opened).map(([id]) => id));
    const fame = result.success && isMeridianComplete(meridian, openedIds)
      ? claimFame(s, `meridian:${meridian.id}`, FAME_MERIDIAN) : { fame: 0 };
    const { fame: fameGained, ...fameState } = fame;
    set({
      // 真气成败同扣，液面如实回落；已沉入根基（chargeHighWater）的部分不受影响
      dantian: Math.max(0, s.dantian - neiliCost),
      acupointProgress: nextProgress,
      ...fameState,
    });
    if (fameGained > 0) {
      track('fame_gained', { run: s.run, realm, route: s.route }, {
        source: 'meridian', key: meridian.id, reputation: fameGained,
      });
    }
    track('acupoint_attempt', { run: s.run, realm, route: s.route }, {
      acupoint_id: acupointId,
      success: result.success,
      pos,
      neili_cost: Math.round(neiliCost),
    });
    persist(get());
  },

  dismissCeremony: () => set({ ceremony: null }),

  selectNeigong: (id) => {
    const s = get();
    if (s.neigong !== null || s.realm < 2) return;
    if (!(s.ownedNeigong ?? STARTER_NEIGONG).includes(id)) return;
    const route = NEIGONG[id].route;
    set({ neigong: id, route, zhong: 0, tiersPassed: 0, dunwuSec: 0 });
    track('neigong_selected', { run: s.run, realm: s.realm, route }, {
      neigong: id, quality: NEIGONG[id].quality,
    });
    persist(get());
  },

  switchNeigong: (to) => {
    const s = get();
    if (!s.neigong || s.neigong === to || !(s.ownedNeigong ?? []).includes(to)) return;
    const fee = switchFee(s.realm);
    if (s.silver < fee) return;
    const zhong = zhongAfterSwitch(s.neigong, to, s.zhong);
    const route = NEIGONG[to].route;
    set({
      neigong: to, route, zhong, tiersPassed: 0, dunwuSec: 0,
      silver: s.silver - fee, lastProgressSec: s.runPlaySec,
    });
    track('neigong_switched', { run: s.run, realm: s.realm, route }, {
      from: s.neigong, to, same_route: NEIGONG[s.neigong].route === route,
      zhong_from: s.zhong, zhong_to: zhong, fee_paid: fee,
    });
    persist(get());
  },

  upgradeZhong: () => {
    const s = get();
    if (!s.neigong || zhongGate(s)) return;
    // 重数不设上限（spec §1.2），只受内力约束；被台阶挡住时须先顿悟
    const next = s.zhong + 1;
    const cost = zhongCost(next);
    if (s.dantian < cost) return;
    set({ dantian: s.dantian - cost, zhong: next, lastProgressSec: s.runPlaySec });
    track('zhong_upgraded', { run: s.run, realm: s.realm, route: s.route }, {
      neigong: s.neigong, zhong_to: next, cost_neili: cost,
    });
    persist(get());
  },

  dismissDunwu: () => set({ dunwuNotice: null }),

  seeTab: (tab) => {
    const s = get();
    // 未启动时存档里还是空状态：此时持久化会盖掉刚载入的存档（调试预设带 tab= 时踩过）
    if (!s.started || (s.seenTabs ?? []).includes(tab)) return;
    set({ seenTabs: [...(s.seenTabs ?? []), tab] });
    persist(get());
  },

  equipWuxue: (id) => {
    const s = get();
    const eq = s.equipped ?? [];
    if (!(s.ownedWuxue ?? []).includes(id) || eq.includes(id) || eq.length >= slotCount(s.realm)) return;
    set({ equipped: [...eq, id] });
    track('wuxue_equipped', { run: s.run, realm: s.realm, route: s.route }, { wuxue: id, slots: eq.length + 1 });
    persist(get());
  },

  unequipWuxue: (id) => {
    const s = get();
    if (!(s.equipped ?? []).includes(id)) return;
    set({ equipped: s.equipped.filter((x) => x !== id) });
    persist(get());
  },

  buyShopItem: (itemId) => {
    const s = get();
    const item = shopItemsOf(s).find((i) => i.id === itemId);
    if (!item || s.realm < item.realm) return;
    const price = shopPriceOf(s, item.price);
    if (s.silver < price) return;
    let patch: Partial<PersistedState>;
    if (item.kind === 'wuxue') {
      if ((s.ownedWuxue ?? []).includes(item.wuxue!)) return;
      patch = { ownedWuxue: [...(s.ownedWuxue ?? []), item.wuxue!] };
    } else if (item.kind === 'scroll') {
      const key = formKey(item.wuxue!, item.form!);
      if ((s.ownedScrolls ?? []).includes(key)) return;
      patch = { ownedScrolls: [...(s.ownedScrolls ?? []), key] };
    } else {
      const ng = shopNeigongOf(s)!;
      patch = { ownedNeigong: [...(s.ownedNeigong ?? []), ng] };
    }
    set({ ...patch, silver: s.silver - price, lastProgressSec: s.runPlaySec });
    track('shop_bought', { run: s.run, realm: s.realm, route: s.route }, { item: itemId, price });
    persist(get());
  },

  joinSect: (id) => {
    const s = get();
    if (!s.started || s.sect !== null || s.realm < SECT_REALM || !SECTS[id]) return;
    set({ sect: id, lastProgressSec: s.runPlaySec });
    track('sect_joined', { run: s.run, realm: s.realm, route: s.route }, { sect: id, neigong: s.neigong });
    persist(get());
  },

  startSectTask: (kind) => {
    const s = get();
    if (!s.started || s.sect === null || s.sectTask !== null || !SECT_TASKS[kind]) return;
    set({ sectTask: { kind, endsAt: Date.now() + SECT_TASKS[kind].hours * 3600 * 1000 } });
    persist(get());
  },

  buySectItem: (itemId) => {
    const s = get();
    if (s.sect === null) return;
    const it = sectShelfOf(s, s.sect).find((x) => x.id === itemId);
    if (!it || it.owned || it.lock !== null || (s.contrib ?? 0) < it.price) return;
    const patch: Partial<PersistedState> =
      it.kind === 'neigong' ? { ownedNeigong: [...(s.ownedNeigong ?? []), SECTS[s.sect].neigong] }
      : it.kind === 'wuxue' ? { ownedWuxue: [...(s.ownedWuxue ?? []), it.wuxue!] }
      : it.kind === 'juance' ? { ownedScrolls: [...(s.ownedScrolls ?? []), juanceKey(SECTS[s.sect].neigong)] }
      : { ownedScrolls: [...(s.ownedScrolls ?? []), formKey(it.wuxue!, it.form!)] };
    set({ ...patch, contrib: s.contrib - it.price, lastProgressSec: s.runPlaySec });
    track('sect_shop_bought', { run: s.run, realm: s.realm, route: s.route }, { sect: s.sect, item: itemId, price: it.price });
    persist(get());
  },

  // 未解锁 / 封存的图与难度也可点开查看（显示解锁条件或「大周天未开」），只是打不了（长线原型 §1）
  selectMap: (m) => {
    const s = get();
    // 切图默认面向该图最深的可推难度；已结算的旧图战斗残留一并清掉（含未触发的自动连战）
    const fronts = openFronts(s).filter((f) => f.map === m);
    const tier = fronts[fronts.length - 1]?.tier ?? 0;
    const battle = s.battle && s.battle.resolved && s.battle.map !== m ? null : s.battle;
    set({ selectedMap: m, selectedTier: tier, battle });
  },

  selectTier: (t) => {
    const s = get();
    const battle = s.battle && s.battle.resolved && s.battle.tier !== t ? null : s.battle;
    set({ selectedTier: t, battle });
  },

  challengeStage: (map, tier, stage) => {
    const s = get();
    if (s.battle && !s.battle.resolved) return;
    if (!tierUnlocked(map, tier, s.tiersUnlocked ?? [])) return;
    const next = nextStageOf(map, tier, s.clearedStages);
    const isRefarm = s.clearedStages.includes(stageKey(map, tier, stage));
    if (!isRefarm && stage !== next) return; // 只能打下一关或回刷已通关卡

    const enemy = getStage(map, tier, stage);
    const build = playerBuild(s);
    const result = fight(build, enemy, {
      mode: 'rng', bossDmgBonus: bossDmgBonus(s.ownedRepNodes), loadout: buildLoadout(s), qiMax: qiMaxOf(s),
    });
    const key = enemy.kind !== 'normal';
    const turnCount = result.turns.length;
    // Boss/精英演出 15–30 秒不可跳过（§7.1）；普通关快节奏
    const intervalMs = key
      ? Math.min(Math.max(15000 / turnCount, 900), 30000 / turnCount)
      : 650;
    set({
      failure: null,
      selectedMap: map,
      selectedTier: tier,
      battle: {
        map, tier, stage, enemy, result,
        revealed: 0, nextRevealAt: Date.now() + intervalMs, intervalMs,
        resolved: false, chainAt: null, chainStage: null, reward: null,
        ...(s.rumorPending ? { rumor: true } : {}),
      },
      ...(s.rumorPending ? { rumorPending: false } : {}),
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
    if (retireKind(s) === null) return;
    rebirth(set, get, null);
  },

  closeRetireCeremony: () => set({ retireCeremony: null }),

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

  buyGanwu: (mode) => {
    const s = get();
    const lv = s.ganwuLevel ?? 0;
    const { levels, cost } = mode === 'all'
      ? ganwuAffordable(lv, s.reputation)
      : s.reputation >= ganwuPrice(lv + 1) ? { levels: 1, cost: ganwuPrice(lv + 1) } : { levels: 0, cost: 0 };
    if (levels === 0) return;
    const reputation = s.reputation - cost;
    set({ reputation, ganwuLevel: lv + levels });
    track('ganwu_bought', { run: s.run, realm: s.realm, route: s.route }, {
      level_from: lv, level_to: lv + levels, price: cost, balance_after: reputation,
    });
    persist(get());
  },

  // ---- 观察员会话（埋点规格 §1.1；tick 活跃秒口径天然扣除暂停区间） ----

  startSession: (testerId) => {
    const s = get();
    if (s.sessionActive) return; // 防面板状态错乱导致重复 test_session_start
    track('test_session_start', { run: s.run, realm: s.realm, route: s.route }, {
      tester_id: testerId, build: BUILD, tables_version: TABLES_VERSION, telemetry_spec: TELEMETRY_SPEC,
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
      selectedMap: 1, selectedTier: 0, retireStep: null, retireCeremony: null,
      offlineSettlement: null, pendingTab: null,
    });
    track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], wuxing: get().wuxing });
    persist(get());
  },
}));

/** 战斗结束结算：奖励入账、首通标记、埋点、失败诊断、Boss3 连败计数、自动连战 */
/**
 * 转世：主动归隐与强制转世共用（reincarnation/spec.md §4 / §6）。
 *
 * - cause = null：主动归隐。调用方已确认归隐可用。
 * - cause = 'old'：寿终正寝，等于自动归隐（spec §4，pacing/design.md 裁决 19）：声望全额、不挂魂魄未稳。
 * - cause = 'battle'：战死，被迫转世。声望同样**全额**结算（design.md §3.1 裁决），
 *   代价落在来世：挂上「魂魄未稳」，前 10 年产出 ×0.6。没有预览与二次确认——人已经没了。
 *
 * 三条路的重置、继承、江湖历接续完全一致，只在埋点、死因与魂魄标记上分岔。
 */
function rebirth(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  cause: DeathCause | null,
) {
  const s = get();
  // 寿终与战死可能发生在归隐门槛之前；声望同源同算法，全额结算
  const settle = settleRetire({
    weightedHours: s.lifeWeightedHours ?? 0,
    clearedStages: s.clearedStages,
    deepestBossEver: s.deepestBossEver ?? 0,
    fameThisLife: s.fameThisLife ?? 0,
  });
  // 寿终按寿元封顶：tick 一次最多推进 300 秒，不封顶会显示超出寿元的年岁、江湖历也多走一截
  const rawAge = s.age ?? INIT_AGE;
  const age = cause === 'old' ? Math.min(rawAge, lifespanCap(s.realm, s.lifespanLost ?? 0)) : rawAge;
  const next = nextLife(s.eraStart ?? ERA_START, age);
  const ctx = { run: s.run, realm: s.realm, route: s.route };

  // 主动归隐与寿终正寝都报 retire_confirmed（telemetry.md v2.4）；只有战死报 forced_reincarnation
  if (cause !== 'battle') {
    track('retire_confirmed', ctx, {
      kind: cause === 'old' ? 'natural' : 'standard',
      age_at_end: Math.round(age * 10) / 10,
      weighted_hours: Math.round(settle.weightedHours * 100) / 100,
      prestige_base: settle.base,
      front_mult: settle.frontMult,
      fame_this_life: settle.fameThisLife,
      prestige_total: settle.total,
      run_duration_s: Math.round(s.runPlaySec),
    });
  } else {
    track('forced_reincarnation', ctx, {
      cause,
      age_at_death: Math.round(age * 10) / 10,
      lifespan_lost: s.lifespanLost ?? 0,
      prestige_total: settle.total,
      run_duration_s: Math.round(s.runPlaySec),
      era_end: Math.floor(next.eraStart),
    });
  }

  // 最远足迹：本世到过的最深初入地图
  const maxMap: MapNo = s.clearedStages.reduce<MapNo>((m, k) => {
    const p = parseStageKey(k);
    return p && p.tier === 0 && p.map > m ? p.map : m;
  }, 1);
  const ceremonyData: RetireCeremonyData = {
    runEnded: s.run, settle, durationSec: s.runPlaySec,
    clearedCount: s.clearedStages.length, maxMap,
    cause, deathAge: Math.floor(age),
    lifeMinutes: s.lifeMinutes ?? 0,
    strongFoes: s.clearedStages.filter((k) => isEliteKey(k) || isBossKey(k)).length,
    boss3: deepestBoss(s.clearedStages) >= 3,
  };

  // 重置与保留（§8.3 + sect-neigong/spec.md §6.1）：资源全清空；已拥有的内功、宿慧（peakRealm）、
  // 修行感悟、历来最深 Boss、已领成就跨世保留；内功重数与台阶清零、下一世境界 2 重选；悟性重掷
  const newRun = s.run + 1;
  const wuxing = rollWuxing(Math.random(), hasNode(s.ownedRepNodes, 'wudao_biji') ? WUDAO_BIJI_WUXING : 0);
  set({
    ...FRESH,
    run: newRun,
    // 阅历冻结：原值原样留着，不清零也不再增加（spec §4.4）
    xp: s.xp,
    // 武学（spec §6.1）：秘籍与首杀记录保留；装配、本世领悟清空；每式熟练带一半
    ownedWuxue: s.ownedWuxue ?? [],
    ownedScrolls: s.ownedScrolls ?? [],
    dropsClaimed: s.dropsClaimed ?? [],
    pastLearned: [...new Set([...(s.pastLearned ?? []), ...(s.learnedForms ?? [])])],
    formCasts: Object.fromEntries(Object.entries(s.formCasts ?? {})
      .map(([k, n]) => [k, Math.floor(n * SHULIAN_CARRY)] as const).filter(([, n]) => n > 0)),
    ownedNeigong: s.ownedNeigong ?? [...STARTER_NEIGONG],
    wuxing,
    seenTabs: s.seenTabs ?? [],
    reputation: s.reputation + settle.total,
    repTotal: s.repTotal + settle.total,
    ownedRepNodes: s.ownedRepNodes,
    peakRealm: s.peakRealm ?? 1,
    ganwuLevel: s.ganwuLevel ?? 0,
    deepestBossEver: Math.max(s.deepestBossEver ?? 0, deepestBoss(s.clearedStages)),
    fameClaimed: s.fameClaimed ?? [],
    autoAdvance: s.autoAdvance,
    // 窍穴图鉴归隐保留（spec §8）；窍穴进度、伤势、折寿由 ...FRESH 重置
    acupointLog: s.acupointLog ?? [],
    // 两个时钟（reincarnation/spec.md §6）：年岁重置，江湖历从谢幕年份接着算
    age: next.age,
    eraStart: next.eraStart,
    soulUnsettled: cause === 'battle',
    retireStep: null,
    retireCeremony: ceremonyData,
    tiersUnlocked: s.tiersUnlocked ?? ['1-0'],
    battle: null, failure: null, ceremony: null, selectedMap: 1, selectedTier: 0, pendingTab: null,
  });
  track('run_start', { run: newRun, realm: 1, route: null }, {
    owned_nodes: s.ownedRepNodes, wuxing,
  });
  persist(get());
}

function resolveBattle(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  now: number,
) {
  const s = get();
  const b = s.battle!;
  if (b.resolved) return;
  const { enemy, result } = b;
  const key = stageKey(b.map, b.tier, b.stage);
  const firstClear = !s.clearedStages.includes(key);
  const tid = targetId(enemy);
  const attempt = (s.attempts[tid] ?? 0) + 1;
  const attempts = { ...s.attempts, [tid]: attempt };
  const isKeyBattle = enemy.kind !== 'normal';

  let { silver, lastProgressSec, refarmKey, refarmCount, refarmAt } = s;
  let fameState: Partial<PersistedState> = {};
  let fameGained = 0;
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
      reward = { ...reward, silver: Math.round(reward.silver * decay) };
    }
    // 关卡不掉内力（formulas.md §6.1 v1.6）：推完前沿即归隐，关卡内力落在一世末尾等于白拿
    silver += reward.silver;   // 阅历冻结（spec §4.4）：关卡不再发阅历
    // 首次击败精英 / Boss：名号传开（economy.md §1.3），跨世只领一次
    if (isEliteKey(key) || isBossKey(key)) {
      const { fame, ...rest } = claimFame(s, `stage:${key}`, isBossKey(key) ? FAME_BOSS : FAME_ELITE);
      fameGained = fame;
      if (fame > 0) fameState = rest;
    }
    rewardApplied = { neili: 0, silver: reward.silver, refarm: !firstClear, fame: fameGained };
    if (firstClear) {
      clearedStages = [...clearedStages, key];
      lastProgressSec = s.runPlaySec;
      track('stage_first_clear', { run: s.run, realm: s.realm, route: s.route }, {
        map: b.map, tier: b.tier, stage: b.stage, kind: enemy.kind,
      });
    }
  } else {
    const build = playerBuild(s);
    const diagCodes = diagnose(build, enemy, result, s.realm);
    failure = {
      map: b.map, tier: b.tier, stage: b.stage, enemyName: enemy.name,
      diagCodes, rounds: result.rounds,
      playerHpPct: result.playerHpPct, enemyHpPct: result.enemyHpPct,
      hitRate: result.stats.pHitRate,
      stats: result.stats, route: s.route, tags: enemy.tags,
    };
  }

  // 伤势判定（injury/spec.md §4）：硬仗失败，或硬仗惨胜（余血 < 25%）留伤。
  // 普通关不产伤；伤势升入重度折寿，越致死线交由转世系统处理（§6）。
  let injuries = s.injuries ?? freshInjuries();
  let lifespanLost = s.lifespanLost ?? 0;
  let lethal = false;
  const hurtBy = injuryFromBattle(enemy, result.win, result.playerHpPct);
  if (hurtBy) {
    const r = inflictInjury(injuries, hurtBy);
    injuries = r.injuries;
    lifespanLost += r.lifespanLost;
    lethal = r.lethal;
    track('injury_inflicted', { run: s.run, realm: s.realm, route: s.route }, {
      target: tid, injury: hurtBy, severity: r.injuries[hurtBy].severity,
      win: result.win, player_hp_pct: result.playerHpPct,
      became_heavy: r.becameHeavy, lethal: r.lethal, lifespan_lost: r.lifespanLost,
    });
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

  // 武学：累计熟练、判新招顿悟（胜负都算，出过招就算练过）
  const wx = settleWuxue(s, result.stats, Math.random);
  for (const name of wx.learned) {
    track('form_learned', { run: s.run, realm: s.realm, route: s.route }, { form: name });
  }

  // 自动连战：首通胜利推进下一关；回刷胜利回到原关（回退挂机）
  const chainStage = result.win && s.autoAdvance
    ? (firstClear ? nextStageOf(b.map, b.tier, clearedStages) : b.stage)
    : null;
  set({
    silver, clearedStages, attempts, failure, lastProgressSec,
    refarmKey, refarmCount, refarmAt, injuries, lifespanLost, ...fameState,
    formCasts: wx.formCasts, learnedForms: wx.learnedForms,
    ...(wx.learned.length > 0 ? { dunwuNotice: wx.learned.join('、') } : {}),
    battle: { ...b, resolved: true, chainAt: chainStage !== null ? now + 900 : null, chainStage, reward: rewardApplied },
  });
  if (fameGained > 0) {
    track('fame_gained', { run: s.run, realm: s.realm, route: s.route }, {
      source: enemy.kind, key, reputation: fameGained,
    });
  }
  // 打通段末 Boss：解锁本图下一档与下一图初入，跨世保留
  if (result.win && enemy.kind === 'boss' && b.stage === trackLength(b.map, b.tier)) {
    const have = s.tiersUnlocked ?? ['1-0'];
    const opened = unlocksAfterBoss(b.map, b.tier).filter((k) => !have.includes(k));
    if (opened.length > 0) {
      set({ tiersUnlocked: [...have, ...opened] });
      track('tier_unlocked', { run: s.run, realm: s.realm, route: s.route }, {
        by: key, opened,
      });
    }
  }
  // Boss 首次击杀（跨世只算第一次）必掉秘籍（spec §4.3）；已拥有改给银两
  if (result.win && enemy.kind === 'boss' && b.stage === trackLength(b.map, b.tier)) {
    const tk = trackKey(b.map, b.tier);
    const drop = BOSS_DROPS[tk];
    const cur = get();
    if (drop && !(cur.dropsClaimed ?? []).includes(tk)) {
      const patch: Partial<GameState> = { dropsClaimed: [...(cur.dropsClaimed ?? []), tk] };
      let got: string;
      if (drop.kind === 'wuxue') {
        if ((cur.ownedWuxue ?? []).includes(drop.wuxue)) {
          patch.silver = cur.silver + DUPLICATE_SILVER.wuxue;
          got = `银两 +${DUPLICATE_SILVER.wuxue}（${WUXUE[drop.wuxue].name}已有）`;
        } else {
          patch.ownedWuxue = [...(cur.ownedWuxue ?? []), drop.wuxue];
          got = `《${WUXUE[drop.wuxue].name}》`;
        }
      } else {
        const own = cur.route ? neigongOf(cur.route, '上乘') : null;
        const ng = drop.which === 'own' && own && !(cur.ownedNeigong ?? []).includes(own) ? own : shopNeigongOf(cur);
        if (ng) {
          patch.ownedNeigong = [...(cur.ownedNeigong ?? []), ng];
          got = `《${NEIGONG[ng].name}》`;
        } else {
          patch.silver = cur.silver + DUPLICATE_SILVER.neigong;
          got = `银两 +${DUPLICATE_SILVER.neigong}（上乘内功已齐）`;
        }
      }
      const bt = get().battle!;
      set({ ...patch, battle: { ...bt, reward: bt.reward ? { ...bt.reward, drop: got } : bt.reward } });
      track('boss_drop', { run: s.run, realm: s.realm, route: s.route }, { track: tk, got });
    }
  }
  // 战死（reincarnation/spec.md §3.2）：伤势越过致死线，或重伤折寿后年岁已超剩余寿元。
  // 放在奖励发放之后——惨胜也是胜，该拿的先拿到手，再走。
  if (lethal || isOldDeath(get().age ?? INIT_AGE, get().realm, lifespanLost)) {
    rebirth(set, get, 'battle');   // rebirth 自带持久化
    return;
  }
  persist(get());
}
