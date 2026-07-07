/**
 * 存档最低规格（MVP-0 规格书 §12 实现路线图前置）：
 * 本地自动持久化 + 刷新/崩溃无损恢复 + 测试者一键重置 + 与埋点同级导出。
 * MVP-0「页面关闭期间不结算任何收益」条款已随 MVP-1 开工解除（docs/mvp1/spec.md §5 衔接注记）：
 * savedAt 时间戳即离线时长的权威来源，出关结算见 engine/offlineRewards.ts + store.init。
 */

const SAVE_KEY = 'jianghu-idle:save:v1';
const DEBUG_OFFLINE_CAP_KEY = 'jianghu-idle:debug:offline-cap-min';

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
  store.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
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
