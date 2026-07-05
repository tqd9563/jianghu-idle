/**
 * 观察员/开发调试通道：URL hash 预置状态与页签。
 * 例：#seed=realm3&tab=skill —— 仅用于开发自检与陪同测试的观察员操作，
 * 正式测试会话请勿携带 seed（会覆盖存档；埋点 run_start 不触发，避免污染完成率分母）。
 */
import { saveGame } from './save/storage';

const PRESETS: Record<string, object> = {
  // 原型场景 3 对应态：境界 3 · 唐门 Lv5 · 丹田 6,900（周天 3/5 段 45%）· 机制节点 1 已购
  realm3: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], chargeHighWater: 3,
  },
  // 突破就绪态：境界 4 · 丹田 21,000（五周天圆满）
  ready: {
    run: 1, realm: 4, route: 'tangmen', skillLevel: 7,
    dantian: 21000, silver: 830, xp: 250,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2'], chargeHighWater: 5,
  },
};

export function applyDebugHash(): { tab: string | null } {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const seed = params.get('seed');
  if (seed && PRESETS[seed]) saveGame(PRESETS[seed]);
  return { tab: params.get('tab') };
}
