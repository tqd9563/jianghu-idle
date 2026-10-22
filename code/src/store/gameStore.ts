/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）+ 战斗推进（§6.2/§7）+ 归隐/声望（§8/声望经济表）
 * 丹田是内力唯一容器：只由挂机（在线 + 离线）注入，关卡不掉内力（formulas.md §6.1 v1.6）。
 * 战斗：引擎瞬时结算（RNG 模式），回合按节奏回放（Boss/精英 15–30 秒不可跳过，§7.1）。
 * 归隐：本世至少突破过一次即可（economy.md §1.4）；声望 = 基础 × 行为乘数 + 成就（§1）。
 */
import { create } from 'zustand';
import { diagnose, fight, type Build, type CombatSkill, type FightResult, type FightStats } from '../engine/combat';
import { QI_SCALE, REALMS, type RouteId } from '../engine/content';
import {
  DUNWU_INTERVAL_SEC, HUOHOU_MULT, NEIGONG, STARTER_NEIGONG, dunwuChance, neigongBuild,
  neigongOf, qiMax, rollWuxing, switchFee, tierGate, zhongAfterSwitch, zhongCost, type NeigongId,
} from '../engine/neigong';
import {
  BOSS_DROPS, DUPLICATE_SILVER, GIFT_WUXUE_OPTIONS, DUP_DROP_SILVER, QINGZHUANG_DISCOUNT, SHOP_ITEMS, WUXUE, effectValue, formBaseCost, formCd, formCost, formKey, formMult, formName, rollWuxueDrop, shulianTier, slotCount, usableForms, type Hands, type ShopItem, type WuxueDrop, type WuxueId, usableWith,
} from '../engine/wuxue';
import {
  SECTS, SECT_REALM, SECT_TASKS, isBenmen, juanceKey, sectShelf,
  type SectId, type SectItem, type SectTask, type SectTaskKind,
} from '../engine/sect';
import {
  enemyStatsAt, getStage, isSealed, MAP_IDS, TEACH_X, parseStageKey, refarmReward, stageKey, targetId, TIERS, trackDepth, trackKey, trackLength,
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
  DIYUN_MAP, FAME_BOSS, FAME_ELITE, FAME_MERIDIAN, REP_NODE_MAP,
  bagExtraCells, deepestBoss, diyunBonus, diyunPrice, extraWuxueSlots, freshDiyun, ganwuAffordable, ganwuPrice,
  hasNode, isBossKey, isEliteKey, marketDiscount, outputMult, settleRetire, soulWeakYears, switchFeeMult,
  type DiyunId, type DiyunLevels, type RepNodeId, type RetireSettle,
} from '../engine/prestige';
import { achvVal, bumpAchv, catDmgBonus, winCounts, type AchvCounts, type AchvId } from '../engine/achievements';
import {
  IDLE_SEC_OVERHEAD, IDLE_SEC_PER_ROUND, OFFLINE_EFFICIENCY, calculateOfflineRewards, maxIdleStage,
  type IdleBasis, type OfflineSettleResult,
} from '../engine/offlineRewards';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import {
  endLiveTestWindow, getDebugOfflineCap, loadGameWithVersion, loadLiveTestWindow, loadSavedAt,
  migrate, MIN_COMPATIBLE_SAVE_VERSION, SAVE_VERSION,
  resetGame, saveGame, startLiveTestWindow, type LiveTestWindowRecord,
} from '../save/storage';
import { resetTelemetry, track } from '../telemetry/telemetry';
import {
  BLACK_PER_LIFE, BLACK_PER_ROUND, BLACK_UNLOCK_SPENT, MARKET_OPEN_STAGE, buyStallGood, revealMasked, roundKeyOf, roundMasked, stallGoods,
  type MarketGood, type MaskedGood,
} from '../engine/market';
import {
  BAG_CELLS, DROP_RATE, INTRO_STAGES, applyGearToBuild, bagFits, gearBonusOf, isIntroStage, rollGear, rollGrade,
  type GearGrade, type GearItem, type GearSlot, type Worn,
} from '../engine/gear';
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
  /** 挂机（battle-loot/design.md §2.1）：守着一关反复打；离线按它折算场次（§2.3）；每世清零 */
  idle: IdleState | null;
  /** 本轮活跃游玩秒数（tick 累计；页面关闭期间不计 —— run_duration_s 权威口径，经济表 §6.4） */
  runPlaySec: number;
  /** 最近一次实质进展（首通/突破/武学/机制节点）时的 runPlaySec（埋点口径） */
  lastProgressSec: number;
  /** 本世 retire_unlocked 是否已上报 */
  standardNotified: boolean;
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
  /** 底蕴八条的级数（跨世保留，prestige-shop/design.md §2） */
  diyun: DiyunLevels;
  /** 侠名录计数（跨世保留，prestige-shop/design.md §2c）；头目 / 精英 / 经脉 / 残页 / 阅历 / 转世由已有字段推导 */
  achv: AchvCounts;
  /** 退出购买的旧传承（存档 v12 迁移记下）：对应成就至少给一层 */
  retiredNodes?: string[];
  /** 本世已用掉的免伤次数（侠名录·战败线） */
  freeHurtUsed: number;
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
  /** 已拥有的秘籍（跨世保留）：现只存归真卷册 */
  ownedScrolls: string[];
  /** 上乘 / 绝学已得的残页 `武学:式`（跨世保留，battle-loot/design.md §4.1）：一式一页，有第一式那页即得这门武学 */
  pages: string[];
  /** 本世装配（每世清空） */
  equipped: WuxueId[];
  /** 每式累计出招数 `武学:式` → 次数（熟练度来源；前一式圆满才接得上下一式；转世清零） */
  formCasts: Record<string, number>;
  /** 已领过首杀掉落的前沿 `{图}-{难度}`（跨世保留，spec §4.3） */
  dropsClaimed: string[];
  /** 本世所拜门派（spec §5.1）：境界 3 起可拜，一世只拜一派，转世清空 */
  sect: SectId | null;
  /** 本世门派贡献（转世清零） */
  contrib: number;
  /** 正在跑的门派任务（同时只一件，到时自动结算） */
  sectTask: SectTask | null;
  /** 拜山传闻待说（sect.ts RUMORS 的键）：突破入境界 2 置 1，解锁图 2 / 图 3 初入置 2 / 3；下一场战斗的战斗记录说一次，0 = 无 */
  rumorPending: number;
  /** 行囊（battle-loot/design.md §3.5）：背包里的装备；每世清零（裁决 8） */
  bag: GearItem[];
  /** 身上穿着的装备，按部位各一件；每世清零 */
  worn: Worn;
  /** 前辈已传功（battle-loot/design.md §5）：第一世 1-7 战败后置上，此后可选内功；转世后恒为 true */
  taught: boolean;
  /** 市集已开张（跨世保留）：传功后在第 8 关起首次战败时 */
  marketOpen: boolean;
  /** 市集累计消费（跨世累计），满额那一笔解锁黑市（裁决 32） */
  marketSpent: number;
  /** 黑市已解锁（跨世保留） */
  blackOpen: boolean;
  /** 本世在黑市买过几件（每世 10 次，转世清零） */
  blackBuys: number;
  /** 连开凡品的次数（保底用，不公示） */
  blackLowStreak: number;
  /** 当天蒙面货的日期键与三件货（买下的带揭晓结果） */
  /** 当前这一轮蒙面货的轮次键（字段名沿用存档 v10） */
  blackDay: string;
  blackGoods: MaskedGood[];
}

/**
 * 战报揭示节拍（issue #26 原型）：你出手后停 1.3 秒、对方出手后停 1.4 秒，
 * 反伤 / 毒发这类附带事件 0.5 秒，胜负那一句前停 1 秒。按「刚揭示的那条事件」决定下一次间隔。
 */
const REVEAL_AFTER_PLAYER_MS = 1300;
const REVEAL_AFTER_ENEMY_MS = 1400;
const REVEAL_AFTER_MINOR_MS = 500;
const REVEAL_BEFORE_END_MS = 1000;
const REVEAL_FIRST_MS = 400;
const MAIN_KINDS = new Set(['attack', 'crit', 'miss', 'cast', 'burst']);
function revealDelay(turns: FightResult['turns'], i: number): number {
  const next = turns[i + 1];
  if (next && next.side === 'end') return REVEAL_BEFORE_END_MS;
  const t = turns[i];
  if (!t || !MAIN_KINDS.has(t.kind)) return REVEAL_AFTER_MINOR_MS;
  return t.side === 'enemy' ? REVEAL_AFTER_ENEMY_MS : REVEAL_AFTER_PLAYER_MS;
}

export type BattleMode = 'push' | 'idle' | 'single';

export interface IdleState {
  map: MapNo;
  tier: TierId;
  stage: number;
  /** 本世在此挂机已打的场次（在线 + 离线折算） */
  fights: number;
  /** 在此挂机拾得的装备件数（在线 + 离线折算） */
  loot?: number;
  /** 这一段挂机的累计（点「在此挂机」起算，退关不断；点停止时做小结，battle-loot/design.md 裁决 44） */
  sess?: IdleSession;
}

/** 一段挂机的累计：起始时刻、场次、胜场、银两进账、拾得装备件数与最好的一件、武学全本与残页 */
export interface IdleSession {
  since: number;
  fights: number;
  wins: number;
  silver: number;
  gear: number;
  best: GearItem | null;
  books: number;
  pages: number;
}

/** 挂机小结（点停止时弹出，不持久化） */
export interface IdleSummary extends IdleSession {
  map: MapNo;
  tier: TierId;
  stage: number;
  enemyName: string;
  until: number;
}

const freshSess = (now: number): IdleSession => ({ since: now, fights: 0, wins: 0, silver: 0, gear: 0, best: null, books: 0, pages: 0 });

export interface BattleState {
  map: MapNo;
  tier: TierId;
  stage: number;
  enemy: EnemyDef;
  result: FightResult;
  revealed: number;
  nextRevealAt: number;
  /** 平均每条事件的揭示间隔（暂停恢复时顺延用） */
  intervalMs: number;
  /** 揭示节拍的缩放：精英 / Boss 把整场压进 15–30 秒（§7.1），普通关为 1 */
  revealScale?: number;
  resolved: boolean;
  /** 这一场是推关（打下一关）、挂机（守着一关反复打）还是单打一次（重打一次） */
  mode: BattleMode;
  chainAt: number | null;
  /** 接着打的关：推关胜 → 下一关；推关败 / 挂机败 → 退回挂机关；挂机胜 → 原关 */
  chainStage: number | null;
  chainMode: BattleMode | null;
  /** 胜利实际入账（收益行同源同值）；fame = 本场首通精英 / Boss 的名号声望 */
  reward: {
    neili: number; silver: number; refarm: boolean; fame?: number; drop?: string;
    /** 本场拾得的装备；行囊满了放不下时直接卖掉，gearSold = 卖得银两 */
    gear?: GearItem; gearSold?: number;
    /** 本场拾得的武学（寻常整门 / 上乘残页）；dup = 已有，折成 silver 两银子 */
    wuxue?: WuxueDrop & { dup: boolean; silver?: number };
  } | null;
  /** 本场战斗记录开头说一句拜山传闻（RUMORS 的键） */
  rumor?: number;
  /** 战报变体种子（narration.ts pick），开战时掷定 */
  seed?: number;
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
  /** 出关时顺带结算的门派任务（只供出关演出展示，不持久化） */
  offlineSectDone: { kind: SectTaskKind; contrib: number } | null;
  /** 闭关期间挂机拾得（只供出关演出展示，不持久化）：装备件数、最好的一件、放不下卖掉的银两、武学全本与残页数 */
  offlineLoot: { count: number; best: GearItem | null; sold: number; books: number; pages: number } | null;
  /** 挂机小结待呈现（点停止时生成，非持久化） */
  idleSummary: IdleSummary | null;
  /** 刚解锁黑市：整屏话本演出待看（非持久化） */
  blackIntro: boolean;
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
  /** 市集武馆（spec §4.2，裁决 31）：交束脩学寻常武学 */
  buyShopItem: (itemId: string) => void;
  /** 市集兵器铺 / 衣饰铺：买一件凡品 / 精良装备进行囊 */
  buyMarketItem: (goodId: string) => void;
  /** 看过暗门演出 */
  dismissBlackIntro: () => void;
  /** 进黑市：按轮次换货（每 4 小时一轮） */
  refreshBlack: () => void;
  /** 买一件蒙面货：买下才揭晓 */
  buyMasked: (goodId: string) => void;
  /** 拜入门派（spec §5.1）：境界 3 起，免费，不受路数限制，一世一派 */
  joinSect: (id: SectId) => void;
  /** 派门派任务（spec §5.2）：同时只一件 */
  startSectTask: (kind: SectTaskKind) => void;
  /** 贡献商店兑换（spec §5.3） */
  buySectItem: (itemId: string) => void;
  selectMap: (m: MapNo) => void;
  selectTier: (t: TierId) => void;
  /** 推关或重打一次：下一关 → 推关（赢了接着往前，输了退回挂机）；已通关卡 → 只打这一场 */
  challengeStage: (map: MapNo, tier: TierId, stage: number) => void;
  /** 在此挂机：守着这一关反复打，输了退一关继续，不停机 */
  idleAt: (map: MapNo, tier: TierId, stage: number) => void;
  /** 收手：这一场打完就停，不再接着打 */
  stopIdle: () => void;
  dismissIdleSummary: () => void;
  /** 传功选完内功后，从三门里择一门武学（battle-loot/design.md §5.1） */
  pickGiftWuxue: (id: WuxueId) => void;
  /** 穿戴背包里的一件（同部位原来那件回背包） */
  wearGear: (id: string) => void;
  /** 卸下身上某部位的装备回背包（背包放不下则不卸） */
  unwearGear: (slot: GearSlot) => void;
  /** 卖掉背包里的一件换银两 */
  sellGear: (id: string) => void;
  /** 一键出售：卖掉背包里低于某品阶的装备 */
  sellGearBelow: (grade: GearGrade) => void;
  /** 离开行囊页：这一趟看过的都不再算「新得」 */
  markBagSeen: () => void;
  dismissFailure: () => void;
  /** 推关失败弹窗：再战一场（只打这一场，输了再问） */
  retryFailed: () => void;
  /** 推关失败弹窗：立刻退回挂机（不等倒计时） */
  retreatNow: () => void;
  openRetire: () => void;
  proceedRetire: () => void;
  cancelRetire: () => void;
  confirmRetire: () => void;
  closeRetireCeremony: () => void;
  buyRepNode: (id: RepNodeId) => void;
  /** 修行感悟：'one' 买一级，'all' 买到买不起为止（economy.md §3） */
  buyGanwu: (mode: 'one' | 'all') => void;
  /** 底蕴：买某一条一级（prestige-shop/design.md §2） */
  buyDiyun: (id: DiyunId) => void;
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
  clearedStages: [], attempts: {}, idle: null,
  runPlaySec: 0, lastProgressSec: 0, standardNotified: false,
  sessionActive: false, paused: false,
  acupointProgress: {}, acupointLog: [],
  injuries: freshInjuries(), lifespanLost: 0,
  age: INIT_AGE, eraStart: ERA_START, soulUnsettled: false, lifeMinutes: 0,
  peakRealm: 1, ganwuLevel: 0, diyun: freshDiyun(), achv: {}, freeHurtUsed: 0, lifeWeightedHours: 0,
  deepestBossEver: 0, fameClaimed: [], fameThisLife: 0,
  tiersUnlocked: ['1-0'],
  ownedWuxue: [], ownedScrolls: [], pages: [], equipped: [], formCasts: {}, dropsClaimed: [],
  sect: null, contrib: 0, sectTask: null, rumorPending: 0,
  bag: [], worn: {},
  taught: false, marketOpen: false, marketSpent: 0, blackOpen: false, blackBuys: 0, blackLowStreak: 0, blackDay: '', blackGoods: [],
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
  s: Pick<PersistedState, 'realm' | 'neigong' | 'zhong' | 'tiersPassed' | 'injuries'> & Partial<Pick<PersistedState, 'worn' | 'diyun'>>,
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
  // 底蕴（prestige-shop/design.md §2）：在火候之后、装备之前乘入；会心 / 会心伤害为加点
  const d = s.diyun;
  const withDiyun: Build = {
    ...base,
    hp: base.hp * (1 + diyunBonus(d, 'qixue')),
    atk: base.atk * (1 + diyunBonus(d, 'gongji')),
    def: base.def * (1 + diyunBonus(d, 'fangyu')),
    hit: base.hit * (1 + diyunBonus(d, 'mingzhong')),
    dodge: base.dodge * (1 + diyunBonus(d, 'shanbi')),
    crit: Math.min(0.8, base.crit + diyunBonus(d, 'huixin')),
    cd: base.cd + diyunBonus(d, 'huixin_shanghai'),
  };
  // 装备在开战前叠进构筑（battle-loot/spec.md §6），伤势在最后一层叠加
  // （injury/spec.md §0 红线：只改喂进 fight() 的 Build，不碰 fight()）
  return applyInjuriesToBuild(applyGearToBuild(withDiyun, gearBonusOf(s.worn)), s.injuries ?? freshInjuries());
}

/** 所修内功的火候品质倍率（未选内功为 1），供 computeAttributes 展示用 */
export function huohouMultOf(s: Pick<PersistedState, 'neigong'>): number {
  return s.neigong ? HUOHOU_MULT[NEIGONG[s.neigong].quality] : 1;
}

// ---------------------------------------------------------------- 武学（sect-neigong/spec.md §2）

type WuxueState = Pick<PersistedState, 'realm' | 'neigong' | 'zhong' | 'ownedWuxue' | 'equipped' | 'formCasts'>
  & Partial<Pick<PersistedState, 'sect' | 'worn' | 'pages' | 'achv' | 'retiredNodes'>>;

/** 手里的家伙（design.md §3.7）：兵器类别与暗器槽 */
export function handsOf(s: Partial<Pick<PersistedState, 'worn'>>): Hands {
  return { weapon: s.worn?.兵器?.cat ?? null, anqi: !!s.worn?.暗器 };
}

/** 当前真气上限（未选内功为 0） */
export function qiMaxOf(s: Pick<PersistedState, 'realm' | 'neigong' | 'zhong'> & Partial<Pick<PersistedState, 'worn' | 'diyun'>>): number {
  // 蕴气词条加真气上限（battle-loot/design.md §3.2）；底蕴「真气」按比例乘在内功真气上，按 sim 尺度取整再 × QI_SCALE
  if (!s.neigong) return 0;
  const base = qiMax(s.realm, s.zhong, NEIGONG[s.neigong].quality) / QI_SCALE;
  return Math.round(base * (1 + diyunBonus(s.diyun, 'zhenqi'))) * QI_SCALE + gearBonusOf(s.worn).qi;
}

/** 这一式到手没有：寻常得了这门就是整门，上乘 / 绝学看这一式的残页 */
export function hasFormOf(s: Pick<PersistedState, 'ownedWuxue'> & Partial<Pick<PersistedState, 'pages'>>, id: WuxueId, k: number): boolean {
  return WUXUE[id].quality === '寻常' ? (s.ownedWuxue ?? []).includes(id) : (s.pages ?? []).includes(formKey(id, k));
}

/** 这门武学能出的式（design.md §4.3）：第一式起逐式接续，前一式圆满才接得上下一式 */
export function learnedFormsOf(
  s: Pick<PersistedState, 'ownedWuxue'> & Partial<Pick<PersistedState, 'pages' | 'formCasts' | 'sect'>>, id: WuxueId,
): number[] {
  return usableForms(WUXUE[id], (k) => hasFormOf(s, id, k), (k) => (s.formCasts ?? {})[formKey(id, k)] ?? 0,
    isBenmen(s.sect ?? null, id));
}

/** 装配转成战斗用的武学表：只列已领悟的式，倍率含熟练与共鸣 */
export function buildLoadout(s: WuxueState): CombatSkill[] {
  const route = s.neigong ? NEIGONG[s.neigong].route : null;
  // 通玄词条只加招式伤害，不加普攻（battle-loot/design.md §3.2）
  const wxMult = 1 + gearBonusOf(s.worn).wxPct;
  return (s.equipped ?? []).map((id) => {
    const d = WUXUE[id];
    const res = d.route !== null && d.route === route;
    const benmen = isBenmen(s.sect ?? null, id);
    const forms = learnedFormsOf(s, id);
    // 熟练只减这一式的耗气（battle-loot/design.md 裁决 45）；触发几率与冷却不随熟练变
    const tiers = forms.map((k) => shulianTier(d.quality, (s.formCasts ?? {})[formKey(id, k)] ?? 0, benmen));
    return {
      id, name: d.name, p: d.p,
      forms: forms.map((k, i) => ({
        key: formKey(id, k), name: formName(k),
        // 侠名录九类器械线：该类武学伤害 +10 / 20 / 30%
        mult: formMult(d, k, res) * wxMult * (1 + catDmgBonus(s, d.cat)),
        effect: d.effect, fx: effectValue(d, k),
        cost: formCost(d, k, tiers[i]), baseCost: formBaseCost(d, k), cd: formCd(d),
      })),
    };
  });
}

/** 书肆实价：轻装上路八折（spec S9） */
export function shopPriceOf(s: Pick<PersistedState, 'ownedRepNodes'>, price: number, kind: 'book' | 'goods' = 'book'): number {
  // 轻装上路管书肆（武馆秘籍），讨价还价管市集商品（兵器铺 / 衣饰铺）
  const mult = kind === 'book'
    ? (hasNode(s.ownedRepNodes, 'qingzhuang_shanglu') ? QINGZHUANG_DISCOUNT : 1)
    : marketDiscount(s.ownedRepNodes);
  return Math.round(price * mult);
}

/** 尚未拥有的第一部上乘内功（归海、镇岳、蚀骨顺序；Boss 首杀「另一路」掉落用）；都有了为 null */
export function shopNeigongOf(s: Pick<PersistedState, 'ownedNeigong'>): NeigongId | null {
  return (['huashan', 'shaolin', 'tangmen'] as const).map((r) => neigongOf(r, '上乘'))
    .find((id) => !(s.ownedNeigong ?? []).includes(id)) ?? null;
}

/** 市集武馆货架：四门寻常武学全本 */
export function shopItemsOf(_s: Pick<PersistedState, 'ownedWuxue'>): ShopItem[] {
  return SHOP_ITEMS;
}

/**
 * 一场战斗后的武学结算：各式熟练累加；前一式练到圆满，下一式（已到手的）随即接上（design.md §4.3）。
 */
function settleWuxue(
  s: WuxueState, stats: FightStats,
): { formCasts: Record<string, number>; learned: string[]; yuanman: number } {
  const formCasts = { ...(s.formCasts ?? {}) };
  // 侠名录·招式线：熟练增速；某一式跨入「圆满」记一次
  const speed = 1 + achvVal(s, 'zhaoshi');
  let yuanman = 0;
  for (const [k, n] of Object.entries(stats.formCasts)) {
    const before = formCasts[k] ?? 0;
    formCasts[k] = before + n * speed;
    const wid = k.split(':')[0] as WuxueId;
    const def = WUXUE[wid];
    if (def) {
      const bm = isBenmen(s.sect ?? null, wid);
      if (shulianTier(def.quality, before, bm) < 3 && shulianTier(def.quality, formCasts[k], bm) >= 3) yuanman++;
    }
  }
  const learned: string[] = [];
  for (const id of Object.keys(stats.skillCasts) as WuxueId[]) {
    const was = learnedFormsOf(s, id).length;
    const now = learnedFormsOf({ ...s, formCasts }, id);
    for (const k of now.slice(was)) learned.push(`${WUXUE[id].name} · ${formName(k)}`);
  }
  return { formCasts, learned, yuanman };
}

/** 武学装配槽：按境界 + 海纳百川一槽 */
export function slotCountOf(s: Pick<PersistedState, 'realm' | 'ownedRepNodes'>): number {
  return slotCount(s.realm) + extraWuxueSlots(s.ownedRepNodes ?? []);
}

/** 行囊容量：80 格 + 包罗万象两行 */
export function bagCellsOf(s: Pick<PersistedState, 'ownedRepNodes'>): number {
  return BAG_CELLS + bagExtraCells(s.ownedRepNodes ?? []);
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

/** 本派货架逐件的状态：绝学一式一页，第一式即这门武学；后面各式要先得这门武学；归真卷册要先有本派绝学内功 */
export function sectShelfOf(
  s: Pick<PersistedState, 'ownedNeigong' | 'ownedWuxue' | 'ownedScrolls'> & Partial<Pick<PersistedState, 'pages'>>, id: SectId,
): SectShelfRow[] {
  const ng = SECTS[id].neigong;
  return sectShelf(id).map((it) => {
    const scrolls = s.ownedScrolls ?? [];
    if (it.kind === 'neigong') return { ...it, owned: (s.ownedNeigong ?? []).includes(ng!), lock: null };
    if (it.kind === 'juance') {
      return { ...it, owned: scrolls.includes(juanceKey(ng!)),
        lock: (s.ownedNeigong ?? []).includes(ng!) ? null : `先得${NEIGONG[ng!].name}` };
    }
    const w = it.wuxue!;
    const owned = (s.pages ?? []).includes(formKey(w, it.form!));
    const lock = it.form === 1 || (s.ownedWuxue ?? []).includes(w) ? null : `先得${WUXUE[w].name}`;
    return { ...it, owned, lock };
  });
}

/** 到点的门派任务结算入账；没到点或没任务返回 null */
function settleSectTask(
  s: Pick<PersistedState, 'sectTask' | 'contrib'> & Partial<Pick<PersistedState, 'achv' | 'retiredNodes'>>, now: number,
): { patch: Partial<PersistedState>; gain: number } | null {
  const t = s.sectTask;
  if (!t || now < t.endsAt) return null;
  // 侠名录·门派线：贡献 +10 / 20 / 30%
  const gain = Math.round(SECT_TASKS[t.kind].contrib * (1 + achvVal(s, 'menpai')));
  return { patch: { sectTask: null, contrib: (s.contrib ?? 0) + gain }, gain };
}

/** 全身伤势档位之和：自愈前后相减即「养好的伤」 */
const sevSum = (inj: ReturnType<typeof freshInjuries>) => Object.values(inj).reduce((a, x) => a + x.severity, 0);

/** 武学掉落倍率（侠名录·阅历线管整式、残页线管残页） */
const dropMults = (s: Partial<Pick<PersistedState, 'achv' | 'ownedWuxue' | 'pages' | 'retiredNodes'>>) =>
  ({ book: 1 + achvVal(s, 'yueli'), page: 1 + achvVal(s, 'canye') });

/** 黑市每世件数：20 + 侠名录·黑市线 */
export function blackCapOf(s: Partial<Pick<PersistedState, 'achv' | 'retiredNodes'>>): number {
  return BLACK_PER_LIFE + achvVal(s, 'heishi');
}

/** 侠名录跨层埋点 */
function trackUps(ctx: { run: number; realm: number; route: RouteId | null }, ups: { id: AchvId; tier: number }[]) {
  for (const u of ups) track('achv_tier', ctx, { line: u.id, tier: u.tier });
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
    const order = p.tier * 1_000_000 + p.map * 1000 + p.stage;
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
  offlineLoot: null,
  idleSummary: null,
  blackIntro: false,
  offlineSectDone: null,
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
      let offlineLoot: GameState['offlineLoot'] = null;
      let dunwuNotice: string | null = null;
      if (savedAt !== null && !merged.paused) {
        const r = calculateOfflineRewards({
          currentMaxIdleStage: maxIdleStage(merged.clearedStages),
          idle: idleBasisOf(merged),
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
          // 侠名录·银两线：银两掉落 +10 / 20 / 30%
          const offSilver = Math.round(r.silver * k * (1 + achvVal(merged, 'yinliang')));
          merged.silver += offSilver;
          const offAdd: AchvCounts = { yinliang: offSilver };
          // 挂机场次记进本世计数（battle-loot/design.md §2.3）；掉落接在胜场上，每胜一场掷一次
          if (r.idle && merged.idle) {
            const wins = Math.round(r.idle.wins * k);
            const offFights = Math.round(r.idle.fights * k);
            merged.idle = { ...merged.idle, fights: merged.idle.fights + offFights };
            // 这一段挂机的累计（裁决 44）：离线折算的场次、胜场、银两也算进去
            if (merged.idle.sess) {
              const ss = merged.idle.sess;
              merged.idle.sess = { ...ss, fights: ss.fights + offFights, wins: ss.wins + wins, silver: ss.silver + offSilver };
            }
            const sess0 = merged.idle.sess;
            if (merged.neigong) {
              const enemy = getStage(merged.idle.map, merged.idle.tier, merged.idle.stage);
              let bag = merged.bag ?? [];
              let count = 0, sold = 0, books = 0, pages = 0, dupSilver = 0;
              let best: GearItem | null = null;
              for (let i = 0; i < wins; i++) {
                const drop = rollDropFor(enemy, Math.random, true);
                if (drop) {
                  const put = putInBag(bag, merged.worn ?? {}, drop, bagCellsOf(merged));
                  bag = put.bag; sold += put.sold; count++;
                  if (!best || drop.grade > best.grade) best = drop;
                }
                const wd = rollWuxueDrop(merged.realm, 'normal', Math.random, dropMults(merged));
                if (wd) {
                  const got = applyWuxueDrop(merged, wd);
                  merged.ownedWuxue = got.ownedWuxue; merged.pages = got.pages; dupSilver += got.silver;
                  if (got.dup) { /* 重复折银两 */ } else if (wd.kind === 'book') books++; else pages++;
                }
              }
              Object.assign(offAdd, winCounts(merged.equipped, wins));
              if (count + books + pages + dupSilver > 0) {
                merged.bag = bag;
                merged.silver += sold + dupSilver;
                offAdd.yinliang = (offAdd.yinliang ?? 0) + sold + dupSilver;
                merged.idle = { ...merged.idle, loot: (merged.idle.loot ?? 0) + count + books + pages };
                if (sess0) merged.idle.sess = { ...sess0, silver: sess0.silver + sold + dupSilver, gear: sess0.gear + count, books: sess0.books + books, pages: sess0.pages + pages,
                  best: best && (!sess0.best || best.grade > sess0.best.grade) ? best : sess0.best };
                offlineLoot = { count, best, sold: sold + dupSilver, books, pages };
                track('gear_dropped', { run: merged.run, realm: merged.realm, route: merged.route }, {
                  stage: r.idle.stageKey, count, best_grade: best?.grade ?? 0, sold, offline: true,
                });
                if (books + pages > 0) {
                  track('wuxue_dropped', { run: merged.run, realm: merged.realm, route: merged.route }, {
                    stage: r.idle.stageKey, books, pages, offline: true,
                  });
                }
              }
            }
          }
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
          const offPrevInj = merged.injuries ?? freshInjuries();
          merged.injuries = healInjuries(offPrevInj, liveMin * (1 + achvVal(merged, 'yangshang')), merged.realm);
          offAdd.yangshang = sevSum(offPrevInj) - sevSum(merged.injuries);
          const offAch = bumpAchv(merged, offAdd);
          merged.achv = offAch.achv;
          trackUps({ run: merged.run, realm: merged.realm, route: merged.route }, offAch.ups);
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
            idle_stage: r.idle?.stageKey ?? null, idle_fights: r.idle?.fights ?? 0, idle_wins: r.idle?.wins ?? 0,
            silent: r.silent,
            debug_cap: r.debugCap,
          });
          if (!r.silent) offlineSettlement = r;
        }
      }
      // 门派任务离线照常计时（spec §5.2）：到点的在载入时入账
      const sectDone = savedAt !== null && !merged.paused ? settleSectTask(merged, now) : null;
      // sectDone.contrib 是入账后的总额；演出要的是这趟任务挣了多少
      const offlineSectDone = sectDone ? { kind: merged.sectTask!.kind, contrib: sectDone.gain } : null;
      if (sectDone) {
        track('sect_task_done', { run: merged.run, realm: merged.realm, route: merged.route }, {
          sect: merged.sect, task: merged.sectTask!.kind, contrib: sectDone.patch.contrib, offline: true,
        });
        const sectAch = bumpAchv(merged, { menpai: 1 });
        Object.assign(merged, sectDone.patch, { achv: sectAch.achv });
        trackUps({ run: merged.run, realm: merged.realm, route: merged.route }, sectAch.ups);
      }
      set({ ...merged, started: true, selectedMap, selectedTier, offlineSettlement, offlineSectDone, offlineLoot, dunwuNotice });
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
      // 侠名录·养伤线：恢复 +20 / 35 / 50%；养好一档记一次
      const injuries = isHurt(prevInj) ? healInjuries(prevInj, (dt / 60) * (1 + achvVal(s, 'yangshang')), s.realm) : prevInj;
      const healed = sevSum(prevInj) - sevSum(injuries);
      // 年岁同一时钟（reincarnation/spec.md §2）：角色老一岁，江湖历走一年
      const age = ageAfter(s.age ?? INIT_AGE, dt / 60, s.peakRealm ?? 1);
      const lifeMinutes = (s.lifeMinutes ?? 0) + dt / 60;
      // 魂魄未稳：转世后前 10 年（spec §4.1）
      const soulUnsettled = (s.soulUnsettled ?? false) && !soulSettles(age, soulWeakYears(s.ownedRepNodes));
      // 卡在台阶上：挂机累计判顿悟（spec §1.3）
      const dw = advanceDunwu(s, dt, Math.random);
      const sectDone = settleSectTask(s, now);
      const tickAch = healed > 0 || sectDone ? bumpAchv(s, { yangshang: healed, menpai: sectDone ? 1 : 0 }) : null;
      set({
        dantian, chargeHighWater, runPlaySec, injuries, age, lifeWeightedHours, lifeMinutes, soulUnsettled,
        tiersPassed: dw.tiersPassed, dunwuSec: dw.dunwuSec,
        ...(dw.tier ? { dunwuNotice: dw.tier, lastProgressSec: runPlaySec } : {}),
        ...sectDone?.patch,
        ...(tickAch ? { achv: tickAch.achv } : {}),
      });
      if (tickAch) trackUps({ run: s.run, realm: s.realm, route: s.route }, tickAch.ups);
      if (sectDone) {
        track('sect_task_done', { run: s.run, realm: s.realm, route: s.route }, {
          sect: s.sect, task: s.sectTask!.kind, contrib: sectDone.patch.contrib, offline: false,
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
        set({ battle: { ...b, revealed: b.revealed + 1, nextRevealAt: now + revealDelay(b.result.turns, b.revealed) * (b.revealScale ?? 1) } });
        const nb = get().battle!;
        if (nb.revealed >= nb.result.turns.length) resolveBattle(set, get, now);
      } else if (b.resolved && b.chainAt !== null && now >= b.chainAt) {
        const target = b.chainStage;
        set({ battle: null });
        if (target !== null) startBattle(set, get, b.map, b.tier, target, b.chainMode ?? 'push');
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
      ...(realmTo === 2 ? { rumorPending: 1 } : {}),
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

    // 侠名录·冲穴线：耗内力 −5 / 10 / 15%
    const neiliCost = neiliCostFor(realm, acupointId, segmentQuota) * (1 - achvVal(s, 'chongxue'));
    const cxAch = bumpAchv(s, { chongxue: 1 });
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
      ? claimFame(s, `meridian:${meridian.id}`, FAME_MERIDIAN * (1 + achvVal(s, 'jingmai'))) : { fame: 0 };
    const { fame: fameGained, ...fameState } = fame;
    set({
      // 真气成败同扣，液面如实回落；已沉入根基（chargeHighWater）的部分不受影响
      dantian: Math.max(0, s.dantian - neiliCost),
      acupointProgress: nextProgress,
      ...fameState,
      achv: cxAch.achv,
    });
    trackUps({ run: s.run, realm: s.realm, route: s.route }, cxAch.ups);
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
    // 第一世要先在 1-7 遇见前辈（taught），第二世起开局即选（battle-loot/design.md §5.2）
    if (s.neigong !== null || !(s.taught || s.run >= 2)) return;
    if (!(s.ownedNeigong ?? STARTER_NEIGONG).includes(id)) return;
    const route = NEIGONG[id].route;
    // 驾轻就熟：转世后首段台阶不必顿悟（第一世不算）
    set({ neigong: id, route, zhong: 0, tiersPassed: s.run > 1 && hasNode(s.ownedRepNodes, 'jiaqing_jiushu') ? 1 : 0, dunwuSec: 0 });
    track('neigong_selected', { run: s.run, realm: s.realm, route }, {
      neigong: id, quality: NEIGONG[id].quality,
    });
    persist(get());
  },

  switchNeigong: (to) => {
    const s = get();
    if (!s.neigong || s.neigong === to || !(s.ownedNeigong ?? []).includes(to)) return;
    const fee = Math.round(switchFee(s.realm) * switchFeeMult(s.ownedRepNodes));
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
    if (!(s.ownedWuxue ?? []).includes(id) || eq.includes(id) || eq.length >= slotCountOf(s)) return;
    if (!usableWith(WUXUE[id], handsOf(s))) return;   // 器械要拿同类兵器，暗器要备暗器（design.md §3.7）
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
    if (!item || s.realm < item.realm || !s.marketOpen) return;
    const price = shopPriceOf(s, item.price);
    if (s.silver < price) return;
    if ((s.ownedWuxue ?? []).includes(item.wuxue!)) return;
    set({ ownedWuxue: [...(s.ownedWuxue ?? []), item.wuxue!], ...spend(s, price), lastProgressSec: s.runPlaySec });
    track('shop_bought', { run: s.run, realm: s.realm, route: s.route }, { item: itemId, price });
    persist(get());
  },

  buyMarketItem: (goodId) => {
    const s = get();
    if (!s.marketOpen) return;
    const { arms, wear } = marketGoodsOf(s);
    const g = [...arms, ...wear].find((x) => x.id === goodId);
    if (!g) return;
    const price = shopPriceOf(s, g.price, 'goods');
    if (s.silver < price) return;
    const it = buyStallGood(g, Math.random);
    if (!bagFits(s.bag ?? [], it, bagCellsOf(s))) return;
    set({ bag: [...(s.bag ?? []), it], ...spend(s, price) });
    track('shop_bought', { run: s.run, realm: s.realm, route: s.route }, { item: goodId, price, slot: it.slot, grade: it.grade });
    persist(get());
  },

  dismissBlackIntro: () => set({ blackIntro: false }),

  refreshBlack: () => {
    const s = get();
    if (!s.blackOpen) return;
    const round = roundKeyOf(Date.now());
    if (s.blackDay === round && s.blackGoods.length === BLACK_PER_ROUND) return;
    set({ blackDay: round, blackGoods: roundMasked(round, s.realm, priceBasisOf(s), Math.random) });
    persist(get());
  },

  buyMasked: (goodId) => {
    const s = get();
    const i = (s.blackGoods ?? []).findIndex((g) => g.id === goodId);
    const g = s.blackGoods?.[i];
    if (!s.blackOpen || !g || g.revealed || s.blackBuys >= blackCapOf(s) || s.silver < g.price) return;
    const enemy = frontierStageOf(s);
    const r = revealMasked(g, enemy.x ?? 1, priceBasisOf(s), s.blackLowStreak ?? 0, Math.random);
    let patch: Partial<PersistedState> = {};
    if ('gear' in r.revealed) {
      const put = putInBag(s.bag ?? [], s.worn ?? {}, r.revealed.gear, bagCellsOf(s));
      patch = { bag: put.bag, silver: s.silver - g.price + put.sold };
    } else {
      const got = applyWuxueDrop(s, { id: r.revealed.pages.id, k: r.revealed.pages.k, kind: 'page' });
      patch = { pages: got.pages, ownedWuxue: got.ownedWuxue, silver: s.silver - g.price + got.silver };
    }
    const goods = s.blackGoods.map((x, j) => (j === i ? { ...x, revealed: r.revealed } : x));
    const bkAch = bumpAchv(s, { heishi: 1 });
    set({ ...patch, blackGoods: goods, blackBuys: (s.blackBuys ?? 0) + 1, blackLowStreak: r.lowStreak, marketSpent: (s.marketSpent ?? 0) + g.price, achv: bkAch.achv });
    trackUps({ run: s.run, realm: s.realm, route: s.route }, bkAch.ups);
    track('black_bought', { run: s.run, realm: s.realm, route: s.route }, {
      good: g.mask.kind === 'gear' ? g.mask.slot : 'pages', price: g.price,
      ...('gear' in r.revealed ? { grade: r.revealed.gear.grade } : { wuxue: r.revealed.pages.id, form: r.revealed.pages.k }),
      buys: (s.blackBuys ?? 0) + 1,
    });
    persist(get());
  },

  joinSect: (id) => {
    const s = get();
    if (!s.started || s.sect !== null || s.realm < SECT_REALM || !SECTS[id]) return;
    if (!mapUnlocked(SECTS[id].map, s.tiersUnlocked ?? ['1-0'])) return;   // 这一派要到了它行走的那张图才遇得上（W13）
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
    let patch: Partial<PersistedState>;
    if (it.kind === 'neigong') patch = { ownedNeigong: [...(s.ownedNeigong ?? []), SECTS[s.sect].neigong!] };
    else if (it.kind === 'juance') patch = { ownedScrolls: [...(s.ownedScrolls ?? []), juanceKey(SECTS[s.sect].neigong!)] };
    else {
      // 一式一页（W2）：与挂机掉落同一本账，第一式即得这门武学
      const got = applyWuxueDrop(s, { id: it.wuxue!, k: it.form!, kind: 'page' });
      patch = { pages: got.pages, ownedWuxue: got.ownedWuxue };
    }
    set({ ...patch, contrib: s.contrib - it.price, lastProgressSec: s.runPlaySec });
    track('sect_shop_bought', { run: s.run, realm: s.realm, route: s.route }, {
      sect: s.sect, item: itemId, price: it.price,
    });
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
    const isRefarm = s.clearedStages.includes(stageKey(map, tier, stage));
    startBattle(set, get, map, tier, stage, isRefarm ? 'single' : 'push');
  },

  idleAt: (map, tier, stage) => {
    const s = get();
    if (!s.clearedStages.includes(stageKey(map, tier, stage))) return; // 只能在已通关的关挂
    const same = s.idle && s.idle.map === map && s.idle.tier === tier && s.idle.stage === stage;
    set({ idle: same ? s.idle : { map, tier, stage, fights: 0, sess: freshSess(Date.now()) } });
    track('idle_start', { run: s.run, realm: s.realm, route: s.route }, { map, tier, stage });
    if (!s.battle || s.battle.resolved) startBattle(set, get, map, tier, stage, 'idle');
    persist(get());
  },

  stopIdle: () => {
    const s = get();
    if (!s.idle) return;
    const { map: im, tier: it, stage: is, fights: ifs } = s.idle;
    track('idle_stop', { run: s.run, realm: s.realm, route: s.route }, { map: im, tier: it, stage: is, fights: ifs });
    const b = s.battle;
    // 挂机小结（裁决 44）：一场都没打完就停，不弹
    const { sess } = s.idle;
    const idleSummary: IdleSummary | null = sess && sess.fights > 0
      ? { ...sess, map: s.idle.map, tier: s.idle.tier, stage: s.idle.stage, enemyName: getStage(s.idle.map, s.idle.tier, s.idle.stage).name, until: Date.now() }
      : null;
    set({ idle: null, idleSummary, battle: b && b.resolved ? { ...b, chainAt: null, chainStage: null, chainMode: null } : b });
    persist(get());
  },

  dismissIdleSummary: () => set({ idleSummary: null }),

  pickGiftWuxue: (id) => {
    const s = get();
    if (!giftPending(s) || !GIFT_WUXUE_OPTIONS.includes(id)) return;
    set({ ownedWuxue: [...(s.ownedWuxue ?? []), id], equipped: [...(s.equipped ?? []), id].slice(0, slotCountOf(s)) });
    track('gift_wuxue_picked', { run: s.run, realm: s.realm, route: s.route }, { wuxue: id });
    persist(get());
  },

  retryFailed: () => {
    const { failure: f, battle: b } = get();
    if (!f || !b || !b.resolved) return;
    set({ failure: null, battle: { ...b, chainAt: null, chainStage: null, chainMode: null } });
    get().challengeStage(f.map, f.tier, f.stage);
  },

  retreatNow: () => {
    const b = get().battle;
    set({ failure: null });
    if (b && b.resolved && b.chainAt !== null) set({ battle: { ...b, chainAt: Date.now() } });
  },

  dismissFailure: () => {
    const s = get();
    // 第一世 1-7 战败即遇见隐世前辈：起身行礼后可选内功（battle-loot/design.md §5.1）
    if (s.failure && isTeachFailure(s)) {
      set({ failure: null, taught: true });
      track('elder_met', { run: s.run, realm: s.realm, route: s.route }, {});
      persist(get());
      return;
    }
    set({ failure: null });
  },

  // ---- 行囊（battle-loot/design.md §3.5）----
  wearGear: (id) => {
    const s = get();
    const it = (s.bag ?? []).find((g) => g.id === id);
    if (!it) return;
    const prev = (s.worn ?? {})[it.slot];
    const bag = (s.bag ?? []).filter((g) => g.id !== id);
    if (prev) bag.push({ ...prev, fresh: false });
    const worn: Worn = { ...(s.worn ?? {}), [it.slot]: { ...it, fresh: false } };
    set({ bag, worn, equipped: (s.equipped ?? []).filter((w) => usableWith(WUXUE[w], handsOf({ worn }))) });
    track('gear_equipped', { run: s.run, realm: s.realm, route: s.route }, { slot: it.slot, grade: it.grade, level: it.level, afx: it.afx.length });
    persist(get());
  },
  unwearGear: (slot) => {
    const s = get();
    const it = (s.worn ?? {})[slot];
    if (!it || !bagFits(s.bag ?? [], it, bagCellsOf(s))) return;
    const worn = { ...(s.worn ?? {}) };
    delete worn[slot];
    // 卸下兵器 / 暗器：靠它才能装的武学一并卸下（design.md §3.7）
    set({ bag: [...(s.bag ?? []), it], worn, equipped: (s.equipped ?? []).filter((w) => usableWith(WUXUE[w], handsOf({ worn }))) });
    persist(get());
  },
  sellGear: (id) => {
    const s = get();
    const it = (s.bag ?? []).find((g) => g.id === id);
    if (!it) return;
    set({ bag: (s.bag ?? []).filter((g) => g.id !== id), silver: s.silver + it.sell });
    track('gear_sold', { run: s.run, realm: s.realm, route: s.route }, { count: 1, silver: it.sell, grade: it.grade });
    persist(get());
  },
  sellGearBelow: (grade) => {
    const s = get();
    const low = (s.bag ?? []).filter((g) => g.grade < grade);
    if (low.length === 0) return;
    const silver = low.reduce((n, g) => n + g.sell, 0);
    set({ bag: (s.bag ?? []).filter((g) => g.grade >= grade), silver: s.silver + silver });
    track('gear_sold', { run: s.run, realm: s.realm, route: s.route }, { count: low.length, silver, below: grade });
    persist(get());
  },
  markBagSeen: () => {
    const s = get();
    if (!(s.bag ?? []).some((g) => g.fresh)) return;
    set({ bag: (s.bag ?? []).map((g) => (g.fresh ? { ...g, fresh: false } : g)) });
    persist(get());
  },

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

  buyDiyun: (id) => {
    const s = get();
    if (!DIYUN_MAP[id]) return;
    const diyun = { ...freshDiyun(), ...(s.diyun ?? {}) };
    const lv = diyun[id];
    const price = diyunPrice(lv + 1);
    if (s.reputation < price) return;
    const reputation = s.reputation - price;
    set({ reputation, diyun: { ...diyun, [id]: lv + 1 } });
    track('diyun_bought', { run: s.run, realm: s.realm, route: s.route }, {
      line: id, level_to: lv + 1, price, balance_after: reputation,
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
    baseMult: 1 + achvVal(s, 'zhuanshi'),
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
  const wuxing = rollWuxing(Math.random(), 0);
  const owned = s.ownedRepNodes ?? [];
  // 敝帚自珍：带走身上品阶最高（同阶取等级高）的一件
  const keepGear = hasNode(owned, 'bizhou_zizhen')
    ? Object.values(s.worn ?? {}).sort((a, b) => b.grade - a.grade || b.level - a.level)[0] : undefined;
  // 刻骨铭心：主修（装配首位）那门武学的招式与熟练原样带走
  const keepWuxue = hasNode(owned, 'kegu_mingxin') ? (s.equipped ?? [])[0] : undefined;
  const keepPrefix = keepWuxue ? `${keepWuxue}:` : null;
  set({
    ...FRESH,
    run: newRun,
    // 阅历冻结：原值原样留着，不清零也不再增加（spec §4.4）
    xp: s.xp,
    // 武学（battle-loot/design.md §4.3）：武学、残页与首杀记录保留；装配清空；熟练清零，下一世从第一式重新练起
    ownedWuxue: s.ownedWuxue ?? [],
    ownedScrolls: s.ownedScrolls ?? [],
    pages: s.pages ?? [],
    dropsClaimed: s.dropsClaimed ?? [],
    // 前辈已传过功，转世后开局即选内功（design.md §5.2）；市集、黑市一经开张跨世保留，黑市每世次数清零
    taught: true,
    marketOpen: s.marketOpen ?? false, marketSpent: s.marketSpent ?? 0,
    blackOpen: s.blackOpen ?? false, blackLowStreak: s.blackLowStreak ?? 0, blackDay: s.blackDay ?? '', blackGoods: s.blackGoods ?? [],
    equipped: keepWuxue ? [keepWuxue] : [],
    formCasts: keepPrefix ? Object.fromEntries(Object.entries(s.formCasts ?? {}).filter(([k]) => k.startsWith(keepPrefix))) : {},
    worn: keepGear ? { [keepGear.slot]: keepGear } : {},
    // 认祖归宗：开局即拜回上一世的门派；驾轻就熟：首段台阶不必顿悟
    sect: hasNode(owned, 'renzu_guizong') ? s.sect : null,
    tiersPassed: hasNode(owned, 'jiaqing_jiushu') ? 1 : 0,
    ownedNeigong: s.ownedNeigong ?? [...STARTER_NEIGONG],
    wuxing,
    seenTabs: s.seenTabs ?? [],
    reputation: s.reputation + settle.total,
    repTotal: s.repTotal + settle.total,
    ownedRepNodes: s.ownedRepNodes,
    peakRealm: s.peakRealm ?? 1,
    ganwuLevel: s.ganwuLevel ?? 0,
    diyun: { ...freshDiyun(), ...(s.diyun ?? {}) },
    achv: s.achv ?? {},
    retiredNodes: s.retiredNodes ?? [],
    deepestBossEver: Math.max(s.deepestBossEver ?? 0, deepestBoss(s.clearedStages)),
    fameClaimed: s.fameClaimed ?? [],
    idle: null,
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

/** 离线挂机折算的依据（battle-loot/design.md §2.3）：按当下战力试打 20 场定胜率与平均耗时 */
const IDLE_TRIALS = 20;
export function idleBasisOf(s: PersistedState): IdleBasis | null {
  const idle = s.idle;
  if (!idle || !tierUnlocked(idle.map, idle.tier, s.tiersUnlocked ?? [])) return null;
  const key = stageKey(idle.map, idle.tier, idle.stage);
  if (!s.clearedStages.includes(key)) return null;
  const enemy = getStage(idle.map, idle.tier, idle.stage);
  const build = playerBuild(s);
  let x = 20261013;
  const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
  let wins = 0, rounds = 0;
  for (let i = 0; i < IDLE_TRIALS; i++) {
    const r = fight(build, enemy, {
      mode: 'rng', rng, bossDmgBonus: achvVal(s, 'boss'), hardDmgBonus: gearBonusOf(s.worn).hardPct,
      loadout: buildLoadout(s), qiMax: qiMaxOf(s),
    });
    if (r.win) wins++;
    rounds += r.rounds;
  }
  return {
    stageKey: key,
    winRate: wins / IDLE_TRIALS,
    fightSec: (rounds / IDLE_TRIALS) * IDLE_SEC_PER_ROUND + IDLE_SEC_OVERHEAD,
    silverPerWin: refarmReward(enemy).silver,
  };
}

/** 本段里比 stage 低的最后一个已通关（退一关挂机用）；没有返回 null */
export function lastClearedBelow(map: MapNo, tier: TierId, stage: number, cleared: readonly string[]): number | null {
  for (let st = stage - 1; st >= 1; st--) if (cleared.includes(stageKey(map, tier, st))) return st;
  return null;
}

/** 一场打完接着打哪关（纯函数，便于测试）：返回新的挂机状态与连战目标 */
export function nextAfterBattle(
  idle: IdleState | null, b: Pick<BattleState, 'map' | 'tier' | 'stage' | 'mode'>, win: boolean, cleared: readonly string[],
): { idle: IdleState | null; chainStage: number | null; chainMode: BattleMode | null } {
  const sameTrack = idle !== null && idle.map === b.map && idle.tier === b.tier;
  const idleHere = (stage: number, fights: number): IdleState => ({ map: b.map, tier: b.tier, stage, fights });
  if (b.mode === 'idle') {
    if (!idle) return { idle: null, chainStage: null, chainMode: null };   // 挂机中收手：这一场打完就停
    if (win) return { idle: { ...idle, fights: idle.fights + 1 }, chainStage: idle.stage, chainMode: 'idle' };
    const back = lastClearedBelow(b.map, b.tier, b.stage, cleared);
    return back === null
      ? { idle: null, chainStage: null, chainMode: null }
      : { idle: idleHere(back, idle.fights), chainStage: back, chainMode: 'idle' };
  }
  if (b.mode === 'push') {
    if (win) {
      const next = nextStageOf(b.map, b.tier, cleared);
      if (next !== null) return { idle, chainStage: next, chainMode: 'push' };
      // 本段打穿：在最后一关挂着
      const here = idleHere(b.stage, sameTrack ? idle!.fights : 0);
      return { idle: here, chainStage: here.stage, chainMode: 'idle' };
    }
    const back = sameTrack ? idle!.stage : lastClearedBelow(b.map, b.tier, b.stage, cleared);
    if (back === null) return { idle, chainStage: null, chainMode: null };
    return { idle: idleHere(back, sameTrack ? idle!.fights : 0), chainStage: back, chainMode: 'idle' };
  }
  return { idle, chainStage: null, chainMode: null };
}

function startBattle(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  map: MapNo, tier: TierId, stage: number, mode: BattleMode,
) {
  const s = get();
  if (s.battle && !s.battle.resolved) return;
  if (!tierUnlocked(map, tier, s.tiersUnlocked ?? [])) return;
  const next = nextStageOf(map, tier, s.clearedStages);
  const isRefarm = s.clearedStages.includes(stageKey(map, tier, stage));
  if (!isRefarm && stage !== next) return; // 只能打下一关或已通关卡

  const base = getStage(map, tier, stage);
  // 第一世 1-7 教学战：碰上真正的江湖人，按境界 2 段起点的强度打，裸属性必败（battle-loot/design.md §5.1）
  const teach = map === 1 && tier === 0 && stage === INTRO_STAGES + 1 && s.run === 1 && s.neigong === null && !s.taught;
  const enemy = teach ? { ...base, ...enemyStatsAt(TEACH_X) } : base;
  const build = playerBuild(s);
  const result = fight(build, enemy, {
    mode: 'rng', bossDmgBonus: achvVal(s, 'boss'), hardDmgBonus: gearBonusOf(s.worn).hardPct,
    loadout: buildLoadout(s), qiMax: qiMaxOf(s),
  });
  const key = enemy.kind !== 'normal';
  const turnCount = result.turns.length;
  // 普通关按原型节拍逐条揭示；Boss/精英演出 15–30 秒不可跳过（§7.1），节拍整体缩放进这个区间
  let totalMs = REVEAL_FIRST_MS;
  for (let i = 0; i < turnCount - 1; i++) totalMs += revealDelay(result.turns, i);
  const revealScale = key ? Math.min(Math.max(totalMs, 15000), 30000) / totalMs : 1;
  const intervalMs = (totalMs * revealScale) / Math.max(1, turnCount);
  set({
    failure: null,
    selectedMap: map,
    selectedTier: tier,
    battle: {
      map, tier, stage, enemy, result, mode,
      revealed: 0, nextRevealAt: Date.now() + REVEAL_FIRST_MS * revealScale, intervalMs, revealScale,
      resolved: false, chainAt: null, chainStage: null, chainMode: null, reward: null,
      seed: Math.floor(Math.random() * 2 ** 31),
      ...(s.rumorPending ? { rumor: s.rumorPending } : {}),
    },
    ...(s.rumorPending ? { rumorPending: 0 } : {}),
  });
}

/** 前辈还没授武学：第一世境界 1 选完内功、三门里一门都还没有（由状态推出，不另存字段） */
export function giftPending(s: Pick<PersistedState, 'run' | 'realm' | 'neigong' | 'taught' | 'ownedWuxue'>): boolean {
  return s.run === 1 && s.realm === 1 && s.taught && s.neigong !== null
    && !GIFT_WUXUE_OPTIONS.some((id) => (s.ownedWuxue ?? []).includes(id));
}

/** 推关失败后等玩家选择的时长：不选就退回挂机（battle-loot/design.md 裁决 44） */
export const RETREAT_WAIT_MS = 5000;

/** 第一世 1-7 的那场战败：隐世前辈出场（battle-loot/design.md §5.1） */
export function isTeachFailure(s: Pick<GameState, 'failure' | 'run' | 'neigong' | 'taught'>): boolean {
  const f = s.failure;
  return !!f && f.map === 1 && f.tier === 0 && f.stage === INTRO_STAGES + 1 && s.run === 1 && s.neigong === null && !s.taught;
}

/** 市集与黑市按「推关处」定货：最深一条可推前沿的下一关；全推完就取最深已解锁前沿的末关 */
export function frontierStageOf(s: Pick<PersistedState, 'tiersUnlocked' | 'clearedStages'>): EnemyDef {
  // 几条前沿并开时取推得最深的那条（当量最高的下一关）：新图刚开时它的第 1 关比旧图历练段浅得多，不能当定价基数
  const nexts = openFronts(s).map((f) => getStage(f.map, f.tier, nextStageOf(f.map, f.tier, s.clearedStages)!));
  const f = nexts.sort((a, b) => (b.x ?? 0) - (a.x ?? 0))[0];
  if (f) return f;
  const unlocked = (s.tiersUnlocked ?? ['1-0']).map((k) => k.split('-').map(Number) as [MapNo, TierId]).sort((a, b) => trackDepth(a[0], a[1]) - trackDepth(b[0], b[1]));
  const [map, tier] = unlocked[unlocked.length - 1] ?? [1, 0];
  return getStage(map, tier, trackLength(map, tier));
}

/**
 * 市集与黑市的定价基数：已通关卡里最高的首通银两（spec §7）。
 * 不用推关处的首通银两：各条前沿的头几关银两都很低，而玩家挂机的进账按已通关里最肥的那关算；也不随并开的新图回落。
 */
export function priceBasisOf(s: Pick<PersistedState, 'tiersUnlocked' | 'clearedStages'>): number {
  let best = 0;
  for (const key of s.clearedStages) {
    const p = parseStageKey(key);
    if (p) best = Math.max(best, getStage(p.map, p.tier, p.stage).reward.silver);
  }
  return best > 0 ? best : frontierStageOf(s).reward.silver;
}

/** 兵器铺与衣饰铺的货：当量按推关处，价格按定价基数 */
export function marketGoodsOf(s: Pick<PersistedState, 'tiersUnlocked' | 'clearedStages'>): { stage: EnemyDef; arms: MarketGood[]; wear: MarketGood[] } {
  const stage = frontierStageOf(s);
  return { stage, ...stallGoods(stage.x ?? 1, priceBasisOf(s)) };
}

/** 市集花一笔银两：累计消费满额那一笔解锁黑市并进话本演出（裁决 32） */
function spend(s: Pick<PersistedState, 'silver' | 'marketSpent' | 'blackOpen'>, price: number): Partial<GameState> {
  const spent = (s.marketSpent ?? 0) + price;
  const unlock = !s.blackOpen && spent >= BLACK_UNLOCK_SPENT;
  return { silver: s.silver - price, marketSpent: spent, ...(unlock ? { blackOpen: true, blackIntro: true } : {}) };
}

/**
 * 一场胜利掷一次装备掉落（battle-loot/spec.md §2.1）：品阶按关卡在本段里的位置取权重，入门关只出凡品 / 精良。
 * 重打（非首通）的精英 / Boss 掉落率按普通关算、品阶加成保留（design.md 裁决 38）：否则挂在 Boss 关每场必掉，经济全乱。
 */
export function rollDropFor(enemy: EnemyDef, rng: () => number, repeat = false): GearItem | null {
  if (rng() >= DROP_RATE[repeat ? 'normal' : enemy.kind]) return null;
  const n = trackLength(enemy.map, enemy.tier);
  const pos = n > 1 ? (enemy.stage - 1) / (n - 1) : 0;
  const grade = rollGrade(pos, enemy.kind, rng, isIntroStage(enemy.map, enemy.tier, enemy.stage));
  return rollGear({ grade, level: enemy.x ?? 1, clearSilver: enemy.reward.silver }, rng);
}

/** 放进背包；放不下时（design.md §3.5）：不比身上强的直接卖掉，比身上强的卖掉背包里最差的腾位 */
export function putInBag(bag: readonly GearItem[], worn: Worn, it: GearItem, cells = BAG_CELLS): { bag: GearItem[]; sold: number } {
  if (bagFits(bag, it, cells)) return { bag: [...bag, it], sold: 0 };
  const cur = worn[it.slot];
  if (cur && it.grade <= cur.grade) return { bag: [...bag], sold: it.sell };
  const rest = [...bag].sort((a, b) => a.grade - b.grade || a.sell - b.sell);
  let sold = 0;
  while (rest.length > 0 && !bagFits(rest, it)) {
    const worst = rest.shift()!;
    if (worst.grade > it.grade) { rest.unshift(worst); break; }
    sold += worst.sell;
  }
  if (!bagFits(rest, it)) return { bag: [...bag], sold: it.sell };
  return { bag: [...rest, it], sold };
}

/** 收下一次武学掉落（design.md §4.3 / §4.4）：寻常得整门，上乘 / 绝学收这一页、第一式那页即得这门武学；已有的折银两 */
export function applyWuxueDrop(
  s: Pick<PersistedState, 'ownedWuxue'> & Partial<Pick<PersistedState, 'pages'>>, d: WuxueDrop,
): { ownedWuxue: WuxueId[]; pages: string[]; dup: boolean; silver: number } {
  const owned = [...(s.ownedWuxue ?? [])];
  const pages = [...(s.pages ?? [])];
  const key = formKey(d.id, d.k);
  const dup = d.kind === 'book' ? owned.includes(d.id) : pages.includes(key);
  if (!dup) {
    if (d.kind === 'page') pages.push(key);
    if ((d.kind === 'book' || d.k === 1) && !owned.includes(d.id)) owned.push(d.id);
  }
  return { ownedWuxue: owned, pages, dup, silver: dup ? DUP_DROP_SILVER[d.kind] : 0 };
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

  let { silver, lastProgressSec } = s;
  let bag = s.bag ?? [];
  let wxPatch: Partial<PersistedState> = {};
  let marketPatch: Partial<PersistedState> = {};
  let fameState: Partial<PersistedState> = {};
  let fameGained = 0;
  let clearedStages = s.clearedStages;
  let failure: FailureInfo | null = null;
  let rewardApplied: BattleState['reward'] = null;

  if (result.win) {
    // 已通关卡给首通银两的五成，不再有连刷递减（battle-loot/design.md 裁决 14）：一场要演两三秒，产出已被时长卡住
    const reward = firstClear ? enemy.reward : refarmReward(enemy);
    // 关卡不掉内力（formulas.md §6.1 v1.6）：推完前沿即归隐，关卡内力落在一世末尾等于白拿
    // 侠名录·银两线：银两掉落 +10 / 20 / 30%
    const silverGot = Math.round(reward.silver * (1 + achvVal(s, 'yinliang')));
    silver += silverGot;   // 阅历冻结（spec §4.4）：关卡不再发阅历
    // 首次击败精英 / Boss：名号传开（economy.md §1.3），跨世只领一次
    if (isEliteKey(key) || isBossKey(key)) {
      // 侠名录·精英线：名号声望 +15 / 30 / 50%
      const { fame, ...rest } = claimFame(s, `stage:${key}`, (isBossKey(key) ? FAME_BOSS : FAME_ELITE) * (1 + achvVal(s, 'elite')));
      fameGained = fame;
      if (fame > 0) fameState = rest;
    }
    rewardApplied = { neili: 0, silver: silverGot, refarm: !firstClear, fame: fameGained };
    // 装备掉落（battle-loot/spec.md §2.1）：传功（选内功）之后才开始掉（裁决 13 / 19）
    const drop = s.neigong ? rollDropFor(enemy, Math.random, !firstClear) : null;
    if (drop) {
      const put = putInBag(s.bag ?? [], s.worn ?? {}, drop, bagCellsOf(s));
      bag = put.bag;
      silver += put.sold;
      rewardApplied = { ...rewardApplied, gear: drop, ...(put.sold > 0 ? { gearSold: put.sold } : {}) };
      track('gear_dropped', { run: s.run, realm: s.realm, route: s.route }, {
        stage: key, slot: drop.slot, grade: drop.grade, level: drop.level, sold: put.sold, offline: false,
      });
    }
    // 武学掉落（design.md §4）：寻常整门、上乘残页；传功后才掉
    const wd = s.neigong ? rollWuxueDrop(s.realm, firstClear ? enemy.kind : 'normal', Math.random, dropMults(s)) : null;
    if (wd) {
      const got = applyWuxueDrop(s, wd);
      wxPatch = { ownedWuxue: got.ownedWuxue, pages: got.pages };
      silver += got.silver;
      rewardApplied = { ...rewardApplied, wuxue: { ...wd, dup: got.dup, ...(got.dup ? { silver: got.silver } : {}) } };
      track('wuxue_dropped', { run: s.run, realm: s.realm, route: s.route }, {
        stage: key, wuxue: wd.id, form: wd.k, kind: wd.kind, dup: got.dup, offline: false,
      });
    }
    if (firstClear) {
      clearedStages = [...clearedStages, key];
      lastProgressSec = s.runPlaySec;
      track('stage_first_clear', { run: s.run, realm: s.realm, route: s.route }, {
        map: b.map, tier: b.tier, stage: b.stage, kind: enemy.kind,
      });
    }
  } else {
    // 市集开张（裁决 20 / 31，spec §4 X = 第 8 关）：传功后在第 8 关起首次战败
    if (s.neigong && !s.marketOpen && b.stage >= MARKET_OPEN_STAGE) {
      marketPatch = { marketOpen: true };
      track('market_opened', { run: s.run, realm: s.realm, route: s.route }, { stage: key });
    }
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
  const hurtRaw = injuryFromBattle(enemy, result.win, result.playerHpPct);
  // 侠名录·战败线：每世前几次战败不受伤
  const freeHurt = !!hurtRaw && !result.win && (s.freeHurtUsed ?? 0) < achvVal(s, 'zhanbai');
  const hurtBy = freeHurt ? null : hurtRaw;
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
  const wx = settleWuxue(s, result.stats);
  // 侠名录计数：胜场按装配武学的类目、银两按本场进账；败一场记一次
  const btAch = bumpAchv(s, {
    ...(result.win ? { ...winCounts(s.equipped, 1), yinliang: Math.max(0, silver - s.silver) } : { zhanbai: 1 }),
    zhaoshi: wx.yuanman,
  });
  trackUps({ run: s.run, realm: s.realm, route: s.route }, btAch.ups);
  for (const name of wx.learned) {
    track('form_learned', { run: s.run, realm: s.realm, route: s.route }, { form: name });
  }

  // 接着打哪一关（battle-loot/design.md §2.1）：
  //   推关：赢了接着往前，到头了就在这一关挂着；输了退回挂机关（没有就退回本段最后一个已通关）
  //   挂机：赢了原地再打；输了退一关继续挂，退无可退才停
  //   单打一次：打完就停
  let { idle: idle0, chainStage, chainMode } = nextAfterBattle(s.idle, b, result.win, clearedStages);
  // 第一世 1-7 的那场战败要停下来见前辈（design.md §5.1）：不退回挂机、不连战，免得演出被下一场冲掉
  if (failure && isTeachFailure({ failure, run: s.run, neigong: s.neigong, taught: s.taught })) {
    idle0 = null; chainStage = null; chainMode = null;
  }
  const got = (rewardApplied?.gear ? 1 : 0) + (rewardApplied?.wuxue ? 1 : 0);
  let idle = idle0 && b.mode === 'idle' && got > 0 ? { ...idle0, loot: (idle0.loot ?? 0) + got } : idle0;
  // 这一段挂机的累计（裁决 44）：挂机场次都记，推关输了退回挂机时从这一刻起算
  if (idle) {
    const sess = idle.sess ?? freshSess(now);
    if (b.mode === 'idle') {
      const g = rewardApplied?.gear;
      const wxGot = rewardApplied?.wuxue && !rewardApplied.wuxue.dup ? rewardApplied.wuxue.kind : null;
      idle = { ...idle, sess: {
        ...sess, fights: sess.fights + 1, wins: sess.wins + (result.win ? 1 : 0), silver: sess.silver + Math.max(0, silver - s.silver),
        gear: sess.gear + (g ? 1 : 0), best: g && (!sess.best || g.grade > sess.best.grade) ? g : sess.best,
        books: sess.books + (wxGot === 'book' ? 1 : 0), pages: sess.pages + (wxGot && wxGot !== 'book' ? 1 : 0),
      } };
    } else if (!idle.sess) idle = { ...idle, sess };
  }
  // 推关输了、有关可退：弹窗等玩家选「再战一场 / 退回挂机」，RETREAT_WAIT_MS 不选默认退回（裁决 44）
  const waitChoice = b.mode === 'push' && !result.win && chainMode === 'idle' && failure !== null;
  set({
    silver, bag, ...wxPatch, ...marketPatch, clearedStages, attempts, failure, lastProgressSec,
    injuries, lifespanLost, ...fameState, idle, achv: btAch.achv,
    ...(freeHurt ? { freeHurtUsed: (s.freeHurtUsed ?? 0) + 1 } : {}),
    formCasts: wx.formCasts,
    ...(wx.learned.length > 0 ? { dunwuNotice: wx.learned.join('、') } : {}),
    battle: { ...b, resolved: true, chainAt: chainStage !== null ? now + (waitChoice ? RETREAT_WAIT_MS : 900) : null, chainStage, chainMode, reward: rewardApplied },
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
      // 解锁图 2 / 图 3 初入：这张图上的三派行走江湖，下一场战斗说一句拜山传闻（名录 §5.3）
      const rumor = opened.includes('3-0') ? 3 : opened.includes('2-0') ? 2 : 0;
      set({ tiersUnlocked: [...have, ...opened], ...(rumor ? { rumorPending: rumor } : {}) });
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
          // 首杀给第一式那一页（design.md §4.1）
          const wd = applyWuxueDrop(cur, { id: drop.wuxue, k: 1, kind: 'page' });
          patch.ownedWuxue = wd.ownedWuxue; patch.pages = wd.pages;
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
