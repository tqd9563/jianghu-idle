/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）+ 战斗推进（§6.2/§7）+ 归隐/声望（§8/声望经济表）
 * 丹田是内力唯一容器：挂机与战斗奖励同入丹田，武学随时支取，突破一次性扣全额。
 * 战斗：引擎瞬时结算（RNG 模式），回合按节奏回放（Boss/精英 15–30 秒不可跳过，§7.1）。
 * 归隐：标准 = 境界 5 + Boss 3；保底 = 境界 5 后连败/停滞触发低收益归隐（§6.6）。
 */
import { create } from 'zustand';
import { diagnose, fight, makeBuild, type Build, type FightResult } from '../engine/combat';
import { REALMS, skillUpgradeCost, type RouteId } from '../engine/content';
import { getStage, MAP_STAGE_COUNT, refarmReward, targetId, type EnemyDef } from '../engine/enemies';
import { idleNeiliPerSec, zhoutianProgress } from '../engine/formulas';
import {
  FALLBACK_FAIL_STREAK, FALLBACK_STALL_MIN, REP_NODE_MAP,
  battleNeiliMult, bossDmgBonus, breakthroughDiscount, carryXp, hasNode, idleMult,
  settleRetire, type RepNodeId, type RetireSettle,
} from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { loadGame, resetGame, saveGame } from '../save/storage';
import { resetTelemetry, track } from '../telemetry/telemetry';

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
}

export interface FailureInfo {
  map: MapNo;
  stage: number;
  enemyName: string;
  diagCodes: number[];
  rounds: number;
  enemyHpPct: number;
  hitRate: number;
}

export type RetireKind = 'standard' | 'fallback';

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
  init: () => void;
  tick: (now: number) => void;
  breakthrough: () => void;
  dismissCeremony: () => void;
  selectRoute: (r: RouteId) => void;
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
};

/** 页面关闭期间不结算任何收益：lastTick 不入存档，init 时重置为当下 */
let lastTick = 0;
let lastSave = 0;

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

export function playerBuild(s: Pick<PersistedState, 'realm' | 'route' | 'skillLevel' | 'ownedMechNodes'>): Build {
  if (s.route) return makeBuild(s.route, s.realm, s.skillLevel, s.ownedMechNodes.length);
  // 未择路（境界 1）：纯基础属性
  const b = REALMS[s.realm - 1];
  return {
    hp: b.hp, atk: b.atk, plainMult: 1, def: b.def, hit: b.accuracy, dodge: b.evasion,
    crit: 0.05, cd: 1.5, firstCrit: false, shieldPct: 0, thorns: 0,
    poison: { init: 0, perHit: 0, coef: 0, cap: 0, burst: 0 },
    sqNeed: 99, burstMult: 0, lowhpDr: 0, route: 'huashan',
  };
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

  init: () => {
    if (get().started) return;
    const saved = loadGame<PersistedState>();
    lastTick = Date.now();
    if (saved) {
      const merged = { ...FRESH, ...saved };
      let selectedMap: MapNo = 1;
      for (const m of [3, 2, 1] as MapNo[]) {
        if (mapUnlocked(m, merged.clearedStages)) { selectedMap = m; break; }
      }
      set({ ...merged, started: true, selectedMap });
    } else {
      set({ ...FRESH, started: true });
      track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], carry_xp: 0 });
      persist(get());
    }
  },

  tick: (now) => {
    const s = get();
    if (!s.started) return;
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
        const next = nextStageOf(b.map, get().clearedStages);
        set({ battle: null });
        if (next !== null && get().autoAdvance) get().challengeStage(b.map, next);
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
      lastProgressSec: s.runPlaySec,
    });
    track('mech_node_bought', { run: s.run, realm: s.realm, route: s.route }, {
      node_id: nodeId, cost_xp: node.cost,
    });
    persist(get());
  },

  selectMap: (m) => {
    if (mapUnlocked(m, get().clearedStages)) set({ selectedMap: m });
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
        resolved: false, chainAt: null,
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

  hardReset: () => {
    resetGame();
    resetTelemetry();
    lastTick = Date.now();
    set({
      ...FRESH, started: true, ceremony: null, battle: null, failure: null,
      selectedMap: 1, retireStep: null, retireCeremony: null, retireToast: null,
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

  let { dantian, silver, xp, b3Fails, lastProgressSec } = s;
  let clearedStages = s.clearedStages;
  let failure: FailureInfo | null = null;

  if (result.win) {
    const reward = firstClear ? enemy.reward : refarmReward(enemy);
    // 江湖熟路：战斗内力奖励 +20%（sim 口径：仅内力；银两/阅历不乘）
    dantian += reward.neili * battleNeiliMult(s.ownedRepNodes);
    silver += reward.silver;
    xp += reward.xp;
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
      enemyHpPct: result.enemyHpPct, hitRate: result.stats.pHitRate,
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

  const canChain = result.win && s.autoAdvance && nextStageOf(b.map, clearedStages) !== null;
  set({
    dantian, silver, xp, clearedStages, attempts, failure, b3Fails, lastProgressSec,
    battle: { ...b, resolved: true, chainAt: canChain ? now + 900 : null },
  });
  persist(get());
}
