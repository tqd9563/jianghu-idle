/**
 * 观察员/开发调试通道：URL hash 预置状态与页签。
 * 例：#seed=realm3&tab=battle&fight=1 —— 仅用于开发自检与陪同测试的观察员操作，
 * 正式测试会话请勿携带 seed（会覆盖存档；埋点 run_start 不触发，避免污染完成率分母）。
 * MVP-1 验收 A4：#offlinecap=10 压低离线上限（分钟，持久生效）；#offlinecap=0 清除。
 */
import { saveGame, setDebugOfflineCap } from './save/storage';

const m1all = Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`);
const m2upto = (n: number) => Array.from({ length: n }, (_, i) => `m2s${i + 1}`);
const m3upto = (n: number) => Array.from({ length: n }, (_, i) => `m3s${i + 1}`);

const PRESETS: Record<string, object> = {
  // 原型场景 3 对应态：境界 3 · 唐门 Lv5 · 丹田 6,900 · 图2 推进到第 7 关（精英铁臂僧）
  realm3: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 3,
    clearedStages: [...m1all, ...m2upto(6)], attempts: {}, autoAdvance: true,
  },
  // 突破就绪态：境界 4 · 丹田 21,000 · 图3 推进到第 8 关
  ready: {
    run: 1, realm: 4, route: 'tangmen', skillLevel: 7,
    dantian: 21000, silver: 830, xp: 250,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2'], mechXpInvested: 120, chargeHighWater: 5,
    clearedStages: [...m1all, ...m2upto(10), ...m3upto(7)], attempts: {}, autoAdvance: true,
  },
  // Boss 2 卡点态：境界 3 打推荐境界 4 的铁掌恶僧（复现失败诊断规则 1）
  boss2: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 6,
    dantian: 3210, silver: 490, xp: 96,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 1,
    clearedStages: [...m1all, ...m2upto(9)], attempts: {}, autoAdvance: false,
  },
  // 标准归隐就绪态：境界 5 + 三图全通（46 分钟轮长 → 130 声望）
  retire: {
    run: 1, realm: 5, route: 'tangmen', skillLevel: 10,
    dantian: 3400, silver: 830, xp: 59,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2', 'tm3'], mechXpInvested: 270, chargeHighWater: 0,
    clearedStages: [...m1all, ...m2upto(10), ...m3upto(10)],
    attempts: { boss3: 2 }, autoAdvance: true,
    runPlaySec: 2760, b3Fails: 0, lastProgressSec: 2700, fallbackUnlocked: false, standardNotified: false,
  },
  // 保底归隐触发态：境界 5、Boss 3 连败 4 次（低收益归隐 ×60%）
  fallback: {
    run: 1, realm: 5, route: 'shaolin', skillLevel: 10,
    dantian: 5200, silver: 610, xp: 12,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['sl1', 'sl2', 'sl3'], mechXpInvested: 270, chargeHighWater: 0,
    clearedStages: [...m1all, ...m2upto(10), ...m3upto(9)],
    attempts: { boss3: 4 }, autoAdvance: false,
    runPlaySec: 2940, b3Fails: 4, lastProgressSec: 2760, fallbackUnlocked: false, standardNotified: false,
  },
  // 第二轮开局态：首轮标准归隐结算后（130 声望未消费），验证声望阁与节点购买
  run2: {
    run: 2, realm: 1, route: null, skillLevel: 0,
    dantian: 0, silver: 0, xp: 0,
    reputation: 130, repTotal: 130,
    ownedMechNodes: [], ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, autoAdvance: true,
    runPlaySec: 0, b3Fails: 0, lastProgressSec: 0, fallbackUnlocked: false, standardNotified: false,
  },
};

export function applyDebugHash(): {
  tab: string | null; fight: boolean; retire: string | null; observer: boolean;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const seed = params.get('seed');
  if (seed && PRESETS[seed]) saveGame(PRESETS[seed]);
  // MVP-1 验收 A4：#offlinecap=10 压低离线上限（分钟），持久生效；#offlinecap=0 清除
  const offlineCap = params.get('offlinecap');
  if (offlineCap !== null) setDebugOfflineCap(Number(offlineCap) > 0 ? Number(offlineCap) : null);
  return {
    tab: params.get('tab'),
    fight: params.get('fight') === '1',
    retire: params.get('retire'),
    observer: params.get('observer') === '1',
  };
}
