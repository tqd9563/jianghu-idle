/**
 * 存档最低规格（规格书 §12 实现路线图前置）：
 * 本地自动持久化 + 刷新/崩溃无损恢复 + 测试者一键重置 + 与埋点同级导出。
 * 页面关闭期间不结算任何收益（防离线收益污染 MVP-1 独立假设）。
 */

const SAVE_KEY = 'jianghu-idle:save:v1';

export function saveGame(state: unknown): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
}

export function loadGame<T>(): T | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { state: T }).state;
  } catch {
    return null;
  }
}

export function resetGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
