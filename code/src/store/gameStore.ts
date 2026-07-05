/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）+ 战斗推进（§6.2/§7）
 * 丹田是内力唯一容器：挂机与战斗奖励同入丹田，武学随时支取，突破一次性扣全额。
 * 战斗：引擎瞬时结算（RNG 模式），回合按节奏回放（Boss/精英 15–30 秒不可跳过，§7.1）。
 */
import { create } from 'zustand';
import { diagnose, fight, makeBuild, type Build, type FightResult } from '../engine/combat';
import { REALMS, skillUpgradeCost, type RouteId } from '../engine/content';
import { getStage, MAP_STAGE_COUNT, refarmReward, targetId, type EnemyDef } from '../engine/enemies';
import { idleNeiliPerSec, zhoutianProgress } from '../engine/formulas';
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
  chargeHighWater: number;
  clearedStages: string[];
  attempts: Record<string, number>;
  autoAdvance: boolean;
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

interface GameState extends PersistedState {
  started: boolean;
  ceremony: number | null;
  selectedMap: MapNo;
  battle: BattleState | null;
  failure: FailureInfo | null;
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
  hardReset: () => void;
}

const FRESH: PersistedState = {
  run: 1, realm: 1, route: null, skillLevel: 0,
  dantian: 0, silver: 0, xp: 0,
  reputation: 0, repTotal: 0,
  ownedMechNodes: [], chargeHighWater: 0,
  clearedStages: [], attempts: {}, autoAdvance: true,
};

/** 页面关闭期间不结算任何收益：lastTick 不入存档，init 时重置为当下 */
let lastTick = 0;
let lastSave = 0;

const stageKey = (m: MapNo, s: number) => `m${m}s${s}`;

const persist = (s: PersistedState) =>
  saveGame({
    run: s.run, realm: s.realm, route: s.route, skillLevel: s.skillLevel,
    dantian: s.dantian, silver: s.silver, xp: s.xp,
    reputation: s.reputation, repTotal: s.repTotal,
    ownedMechNodes: s.ownedMechNodes, chargeHighWater: s.chargeHighWater,
    clearedStages: s.clearedStages, attempts: s.attempts, autoAdvance: s.autoAdvance,
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

export const useGameStore = create<GameState>((set, get) => ({
  ...FRESH,
  started: false,
  ceremony: null,
  selectedMap: 1,
  battle: null,
  failure: null,

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

    // 挂机产出入丹田
    if (dt > 0) {
      const dantian = s.dantian + idleNeiliPerSec(s.realm) * dt;
      let chargeHighWater = s.chargeHighWater;
      if (s.realm < REALMS.length) {
        const cost = REALMS[s.realm].breakthroughCost!;
        const { segmentsFull } = zhoutianProgress(dantian, cost);
        while (chargeHighWater < segmentsFull) {
          chargeHighWater += 1;
          track('charge_segment_full', { run: s.run, realm: s.realm, route: s.route }, {
            realm_target: s.realm + 1, segment: chargeHighWater,
          });
        }
      }
      set({ dantian, chargeHighWater });
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
    if (s.realm >= REALMS.length) return;
    const cost = REALMS[s.realm].breakthroughCost!;
    if (s.dantian < cost) return;
    const realmTo = s.realm + 1;
    set({ dantian: s.dantian - cost, realm: realmTo, chargeHighWater: 0, ceremony: realmTo });
    track('realm_breakthrough', { run: s.run, realm: realmTo, route: s.route }, { realm_to: realmTo });
    persist(get());
  },

  dismissCeremony: () => set({ ceremony: null }),

  selectRoute: (r) => {
    const s = get();
    if (s.route !== null) return; // 换路线（route_changed）随换线弹窗交付
    set({ route: r });
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
    set({ dantian: s.dantian - cost, skillLevel: next });
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
    set({ xp: s.xp - node.cost, ownedMechNodes: [...s.ownedMechNodes, nodeId] });
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
    const result = fight(build, enemy, { mode: 'rng' });
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

  hardReset: () => {
    resetGame();
    resetTelemetry();
    lastTick = Date.now();
    set({ ...FRESH, started: true, ceremony: null, battle: null, failure: null, selectedMap: 1 });
    track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], carry_xp: 0 });
    persist(get());
  },
}));

/** 战斗结束结算：奖励入账、首通标记、埋点、失败诊断、自动连战 */
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

  let { dantian, silver, xp } = s;
  let clearedStages = s.clearedStages;
  let failure: FailureInfo | null = null;

  if (result.win) {
    const reward = firstClear ? enemy.reward : refarmReward(enemy);
    dantian += reward.neili;
    silver += reward.silver;
    xp += reward.xp;
    if (firstClear) {
      clearedStages = [...clearedStages, key];
      track('stage_first_clear', { run: s.run, realm: s.realm, route: s.route }, {
        map: b.map, stage: b.stage, kind: enemy.kind,
      });
    }
  } else {
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
    dantian, silver, xp, clearedStages, attempts, failure,
    battle: { ...b, resolved: true, chainAt: canChain ? now + 900 : null },
  });
  persist(get());
}
