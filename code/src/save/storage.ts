/**
 * 存档最低规格（MVP-0 规格书 §12 实现路线图前置）：
 * 本地自动持久化 + 刷新/崩溃无损恢复 + 测试者一键重置 + 与埋点同级导出。
 * MVP-0「页面关闭期间不结算任何收益」条款已随 MVP-1 开工解除（docs/rules/offline-rewards.md §1.2）：
 * savedAt 时间戳即离线时长的权威来源，出关结算见 engine/offlineRewards.ts + store.init。
 */

const SAVE_KEY = 'jianghu-idle:save:v1';
const DEBUG_OFFLINE_CAP_KEY = 'jianghu-idle:debug:offline-cap-min';
const LIVE_TEST_WINDOW_KEY = 'jianghu-idle:live-test-window:v1';

/** 存档版本号（v1 = MVP-0/1/2 无周天系统；v2 = 主题版本加窍穴/经脉/气势字段） */
export const SAVE_VERSION = 2;

export interface LiveTestWindowRecord {
  readonly windowId: string;
  readonly startedAt: number;
  readonly tablesVersionStarted: string;
}

/** node 测试环境无 localStorage 时退化为内存实现（行为一致，不持久） */
const mem = new Map<string, string>();
const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
  typeof localStorage !== 'undefined'
    ? localStorage
    : {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      };

export function saveGame(state: unknown): void {
  store.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), version: SAVE_VERSION, state }));
}

export function loadGame<T>(): T | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { state: T }).state;
  } catch {
    return null;
  }
}

/** 加载存档并返回版本号（旧存档无 version 字段则视为 v1）；gameStore 用此决定迁移策略 */
export function loadGameWithVersion<T>(): { state: T; version: number } | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state: T; version?: number };
    return { state: parsed.state, version: parsed.version ?? 1 };
  } catch {
    return null;
  }
}

/**
 * 存档迁移框架：从 fromVer 迁移到 toVer。
 * 本版 v1→v2 只新增字段（由 gameStore 的 {...FRESH, ...saved} merge 处理），
 * storage.ts 不做具体迁移逻辑，只提供版本号供 gameStore 决策。
 * 未来若需字段重命名或删除，在此扩展。
 */
export function migrate<T>(state: T, _fromVer: number, _toVer: number): T {
  return state;
}

export function resetGame(): void {
  store.removeItem(SAVE_KEY);
}

/** 上次持久化时间戳（离线时长权威来源）；无存档或旧格式损坏返回 null */
export function loadSavedAt(): number | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const at = (JSON.parse(raw) as { savedAt?: unknown }).savedAt;
    return typeof at === 'number' && Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

/** 验收调试：把当前存档时间戳回拨 N 秒（#offlinesim），模拟离线时段；无存档时不动 */
export function backdateSavedAt(seconds: number): void {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: number };
    if (typeof parsed.savedAt !== 'number') return;
    parsed.savedAt -= seconds * 1000;
    store.setItem(SAVE_KEY, JSON.stringify(parsed));
  } catch { /* 存档损坏时保持原样，交给 loadGame 的兜底 */ }
}

/**
 * A4 验收调试通道：临时压低离线上限（分钟），跨关页/重开持久生效；null 清除。
 * 非正式配置——正式验收记录中 debug_cap 位必须裸露（offline_settled 事件同名字段）。
 */
export function setDebugOfflineCap(min: number | null): void {
  if (min === null || !Number.isFinite(min) || min <= 0) store.removeItem(DEBUG_OFFLINE_CAP_KEY);
  else store.setItem(DEBUG_OFFLINE_CAP_KEY, String(min));
}

export function getDebugOfflineCap(): number | null {
  const raw = store.getItem(DEBUG_OFFLINE_CAP_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function loadLiveTestWindow(): LiveTestWindowRecord | null {
  const raw = store.getItem(LIVE_TEST_WINDOW_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LiveTestWindowRecord>;
    if (typeof value.windowId !== 'string' || value.windowId.length === 0) return null;
    if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt)) return null;
    if (typeof value.tablesVersionStarted !== 'string' || value.tablesVersionStarted.length === 0) return null;
    return { windowId: value.windowId, startedAt: value.startedAt, tablesVersionStarted: value.tablesVersionStarted };
  } catch {
    return null;
  }
}

export function startLiveTestWindow(tablesVersion: string, now = Date.now()): LiveTestWindowRecord {
  const active = loadLiveTestWindow();
  if (active) return active;
  const record: LiveTestWindowRecord = {
    windowId: `nw-${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    tablesVersionStarted: tablesVersion,
  };
  store.setItem(LIVE_TEST_WINDOW_KEY, JSON.stringify(record));
  return record;
}

export function endLiveTestWindow(): LiveTestWindowRecord | null {
  const active = loadLiveTestWindow();
  if (active) store.removeItem(LIVE_TEST_WINDOW_KEY);
  return active;
}

/** Focused test seam; live-test state is intentionally independent from game reset. */
export function resetLiveTestWindowForTests(): void {
  store.removeItem(LIVE_TEST_WINDOW_KEY);
}
