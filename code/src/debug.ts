/**
 * 观察员/开发调试通道：URL hash 预置状态与页签。
 * 例：#seed=realm3&tab=battle&fight=1 —— 仅用于开发自检与陪同测试的观察员操作，
 * 正式测试会话请勿携带 seed（会覆盖存档；埋点 run_start 不触发，避免污染完成率分母）。
 */
import { saveGame } from './save/storage';

const m1all = Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`);
const m2upto = (n: number) => Array.from({ length: n }, (_, i) => `m2s${i + 1}`);
const m3upto = (n: number) => Array.from({ length: n }, (_, i) => `m3s${i + 1}`);

const PRESETS: Record<string, object> = {
  // 原型场景 3 对应态：境界 3 · 唐门 Lv5 · 丹田 6,900 · 图2 推进到第 7 关（精英铁臂僧）
  realm3: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], chargeHighWater: 3,
    clearedStages: [...m1all, ...m2upto(6)], attempts: {}, autoAdvance: true,
  },
  // 突破就绪态：境界 4 · 丹田 21,000 · 图3 推进到第 8 关
  ready: {
    run: 1, realm: 4, route: 'tangmen', skillLevel: 7,
    dantian: 21000, silver: 830, xp: 250,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2'], chargeHighWater: 5,
    clearedStages: [...m1all, ...m2upto(10), ...m3upto(7)], attempts: {}, autoAdvance: true,
  },
  // Boss 2 卡点态：境界 3 打推荐境界 4 的铁掌恶僧（复现失败诊断规则 1）
  boss2: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 6,
    dantian: 3210, silver: 490, xp: 96,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], chargeHighWater: 1,
    clearedStages: [...m1all, ...m2upto(9)], attempts: {}, autoAdvance: false,
  },
};

export function applyDebugHash(): { tab: string | null; fight: boolean } {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const seed = params.get('seed');
  if (seed && PRESETS[seed]) saveGame(PRESETS[seed]);
  return { tab: params.get('tab'), fight: params.get('fight') === '1' };
}
