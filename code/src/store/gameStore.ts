/**
 * 游戏状态 —— 单钱包/丹田模型（规格书 §6.1 v0.9）
 * 丹田是内力唯一容器：产出自动流入，武学随时支取，突破点击一次性扣全额。
 * 周天进度 = 派生显示；新高水位越段才发 charge_segment_full（回落再越不重复）。
 */
import { create } from 'zustand';
import { REALMS, skillUpgradeCost, type RouteId } from '../engine/content';
import { CHARGE_SEGMENTS, idleNeiliPerSec, zhoutianProgress } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import { loadGame, resetGame, saveGame } from '../save/storage';
import { resetTelemetry, track } from '../telemetry/telemetry';

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
}

interface GameState extends PersistedState {
  started: boolean;
  /** 突破演出（境界到达值），UI 关闭后置 null */
  ceremony: number | null;
  init: () => void;
  tick: (now: number) => void;
  breakthrough: () => void;
  dismissCeremony: () => void;
  selectRoute: (r: RouteId) => void;
  upgradeSkill: () => void;
  buyMechNode: (nodeId: string) => void;
  hardReset: () => void;
}

const FRESH: PersistedState = {
  run: 1,
  realm: 1,
  route: null,
  skillLevel: 0,
  dantian: 0,
  silver: 0,
  xp: 0,
  reputation: 0,
  repTotal: 0,
  ownedMechNodes: [],
  chargeHighWater: 0,
};

/** 页面关闭期间不结算任何收益：lastTick 不入存档，init 时重置为当下 */
let lastTick = 0;
let lastSave = 0;

const persist = (s: PersistedState) =>
  saveGame({
    run: s.run, realm: s.realm, route: s.route, skillLevel: s.skillLevel,
    dantian: s.dantian, silver: s.silver, xp: s.xp,
    reputation: s.reputation, repTotal: s.repTotal,
    ownedMechNodes: s.ownedMechNodes, chargeHighWater: s.chargeHighWater,
  });

export const useGameStore = create<GameState>((set, get) => ({
  ...FRESH,
  started: false,
  ceremony: null,

  init: () => {
    if (get().started) return;
    const saved = loadGame<PersistedState>();
    lastTick = Date.now();
    if (saved) {
      set({ ...saved, started: true });
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
    if (dt <= 0) return;

    const dantian = s.dantian + idleNeiliPerSec(s.realm) * dt;
    let chargeHighWater = s.chargeHighWater;

    if (s.realm < REALMS.length) {
      const cost = REALMS[s.realm].breakthroughCost!;
      const { segmentsFull } = zhoutianProgress(dantian, cost);
      while (chargeHighWater < segmentsFull) {
        chargeHighWater += 1;
        track('charge_segment_full', { run: s.run, realm: s.realm, route: s.route }, {
          realm_target: s.realm + 1,
          segment: chargeHighWater,
        });
      }
    }
    set({ dantian, chargeHighWater });

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
    if (s.route !== null) return; // 换路线（route_changed）在战斗步实现
    set({ route: r });
    track('route_selected', { run: s.run, realm: s.realm, route: r }, { route_to: r });
    persist(get());
  },

  upgradeSkill: () => {
    const s = get();
    if (!s.route) return;
    const next = s.skillLevel + 1;
    const cap = REALMS[s.realm - 1].skillCap;
    if (next > cap) return;
    const cost = skillUpgradeCost(next);
    if (s.dantian < cost) return;
    set({ dantian: s.dantian - cost, skillLevel: next });
    track('wugong_upgraded', { run: s.run, realm: s.realm, route: s.route }, {
      level_to: next,
      cost_neili: cost,
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
      node_id: nodeId,
      cost_xp: node.cost,
    });
    persist(get());
  },

  hardReset: () => {
    resetGame();
    resetTelemetry();
    lastTick = Date.now();
    set({ ...FRESH, started: true, ceremony: null });
    track('run_start', { run: 1, realm: 1, route: null }, { owned_nodes: [], carry_xp: 0 });
    persist(get());
  },
}));

export const CHARGE_SEGMENT_COUNT = CHARGE_SEGMENTS;
