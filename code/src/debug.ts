/**
 * 观察员/开发调试通道：URL hash 预置状态与页签。
 * 例：#seed=realm3&tab=battle&fight=1 —— 仅用于开发自检与陪同测试的观察员操作，
 * 正式测试会话请勿携带 seed（会覆盖存档；埋点 run_start 不触发，避免污染完成率分母）。
 * MVP-1 验收 A4：#offlinecap=10 压低离线上限（分钟，持久生效）；#offlinecap=0 清除。
 */
import { backdateSavedAt, saveGame, setDebugOfflineCap } from './save/storage';

import { stageKey, trackLength, type MapId, type TierId } from './engine/enemies';

/** 某前沿的前 n 关（关卡键 m{图}t{难度}s{关}）；n 缺省为全通 */
const upto = (map: MapId, tier: TierId, n = trackLength(map, tier)) =>
  Array.from({ length: n }, (_, i) => stageKey(map, tier, i + 1));
const m1all = upto(1, 0);
const m2upto = (n: number) => upto(2, 0, n);
const m3upto = (n: number) => upto(3, 0, n);

const PRESETS: Record<string, object> = {
  // 原型场景 3 对应态：境界 3 · 唐门 Lv5 · 丹田 6,900 · 图2 推进到第 7 关（精英铁臂僧）
  realm3: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 3,
    clearedStages: [...m1all, ...m2upto(6)], attempts: {}, autoAdvance: true,
    tiersUnlocked: ['1-0', '2-0', '1-1'], 
  },
  // 突破就绪态：境界 4 · 六段周天缴清、任脉已贯通 · 图3 推进到第 8 关
  ready: {
    run: 1, realm: 4, route: 'tangmen', skillLevel: 7, peakRealm: 4,
    dantian: 17_900_000, silver: 830, xp: 250,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2'], mechXpInvested: 120, chargeHighWater: 6,
    acupointProgress: {
      guanyuan: { failCount: 0, opened: true }, qihai: { failCount: 0, opened: true },
      danzhong: { failCount: 1, opened: true },
    },
    clearedStages: [...m1all, ...upto(2, 0), ...m3upto(7)], attempts: {}, autoAdvance: true,
    tiersUnlocked: ['1-0', '2-0', '1-1', '3-0', '2-1'],
  },
  // Boss 2 卡点态：境界 3 打推荐境界 4 的铁掌恶僧（复现失败诊断规则 1）
  boss2: {
    run: 1, realm: 3, route: 'tangmen', skillLevel: 6,
    dantian: 3210, silver: 490, xp: 96,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 1,
    clearedStages: [...m1all, ...m2upto(trackLength(2, 0) - 1)], attempts: {}, autoAdvance: false,
    tiersUnlocked: ['1-0', '2-0', '1-1'], 
  },
  // 归隐就绪态：境界 5 + 三图全通
  retire: {
    run: 1, realm: 5, route: 'tangmen', skillLevel: 10, peakRealm: 5, lifeWeightedHours: 12,
    dantian: 3400, silver: 830, xp: 59,
    reputation: 0, repTotal: 0,
    ownedMechNodes: ['tm1', 'tm2', 'tm3'], mechXpInvested: 270, chargeHighWater: 0,
    clearedStages: [...m1all, ...upto(2, 0), ...upto(3, 0)],
    tiersUnlocked: ['1-0', '2-0', '1-1', '3-0', '2-1', '4-0', '3-1'], deepestBossEver: 3,
    attempts: { boss3: 2 }, autoAdvance: true,
    runPlaySec: 2760, lastProgressSec: 2700, standardNotified: false,
  },
  // 长线第 35 天早上（原型 longline-prototype.html 的 mock 玩家）：境界 4 峰值、推完前沿待归隐
  day35: {
    run: 35, realm: 4, route: 'tangmen', skillLevel: 64, peakRealm: 4,
    dantian: 12_863_420, silver: 2140, xp: 312,
    reputation: 150, repTotal: 180_000, ganwuLevel: 136,
    ownedRepNodes: ['zairu_jianghu', 'qingzhuang_shanglu', 'wudao_biji', 'shimen_zhiyin'],
    ownedMechNodes: ['tm1', 'tm2'], mechXpInvested: 120, chargeHighWater: 5,
    // 早上推完前沿：图 1 初入 / 历练、图 2 初入全通，图 1 绝境、图 2 历练、图 3 初入各推到第 8 关
    clearedStages: [...m1all, ...upto(1, 1), ...upto(1, 2, 8), ...upto(2, 0), ...upto(2, 1, 8), ...m3upto(8)],
    attempts: {}, autoAdvance: true,
    tiersUnlocked: ['1-0', '1-1', '1-2', '2-0', '2-1', '3-0'],
    lifeWeightedHours: 598.4, deepestBossEver: 11, fameThisLife: 243,
    fameClaimed: [
      `stage:${stageKey(1, 0, trackLength(1, 0))}`, `stage:${stageKey(1, 1, trackLength(1, 1))}`,
      `stage:${stageKey(2, 0, trackLength(2, 0))}`,
      'meridian:shoutaiyin', 'meridian:shouyangming', 'meridian:zuyangming',
    ],
    age: 63, eraStart: 1580,
  },
  // 第二轮开局态：首轮标准归隐结算后（130 声望未消费），验证声望阁与节点购买
  run2: {
    run: 2, realm: 1, route: null, skillLevel: 0,
    dantian: 0, silver: 0, xp: 0,
    reputation: 130, repTotal: 130,
    ownedMechNodes: [], ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, autoAdvance: true,
    runPlaySec: 0, lastProgressSec: 0, standardNotified: false,
  },
  // 转世系统（reincarnation-prototype.html）：垂暮态——108 岁，离寿元不足一次重伤
  dusk: {
    run: 3, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189, reputation: 260, repTotal: 260,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 3,
    clearedStages: [...m1all, ...m2upto(6)], attempts: {}, autoAdvance: true,
    tiersUnlocked: ['1-0', '2-0', '1-1'], age: 108, eraStart: 206,
  },
  // 将死态：119.9 岁，挂机数秒即老死，用于看强制转世演出
  dying: {
    run: 3, realm: 3, route: 'tangmen', skillLevel: 5,
    dantian: 6900, silver: 530, xp: 189, reputation: 260, repTotal: 260,
    ownedMechNodes: ['tm1'], mechXpInvested: 40, chargeHighWater: 3,
    clearedStages: [...m1all, ...m2upto(6)], attempts: {}, autoAdvance: true,
    tiersUnlocked: ['1-0', '2-0', '1-1'], age: 119.9, eraStart: 206,
  },
  // 魂魄未稳态：被迫转世后的新一世开局
  soul: {
    run: 4, realm: 1, route: null, skillLevel: 0,
    dantian: 0, silver: 0, xp: 0, reputation: 390, repTotal: 390,
    ownedMechNodes: [], ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, autoAdvance: true,
    age: 18, eraStart: 308, soulUnsettled: true,
  },
};

export function applyDebugHash(): {
  tab: string | null; fight: boolean; retire: string | null; observer: boolean;
  livetest: 1 | 0 | null;
} {
  const result = parseDebugHash(window.location.hash);
  const params = new URLSearchParams(window.location.hash.slice(1));
  const seed = params.get('seed');
  if (seed && PRESETS[seed]) saveGame(PRESETS[seed]);
  // MVP-1 验收 A4：#offlinecap=10 压低离线上限（分钟），持久生效；#offlinecap=0 清除
  const offlineCap = params.get('offlinecap');
  if (offlineCap !== null) setDebugOfflineCap(Number(offlineCap) > 0 ? Number(offlineCap) : null);
  // MVP-1 验收：#offlinesim=1800 把存档时间戳回拨 N 秒，载入即触发出关结算（与 seed 可组合）
  const offlineSim = Number(params.get('offlinesim'));
  if (offlineSim > 0) backdateSavedAt(offlineSim);
  return result;
}

export function parseDebugHash(hash: string): {
  tab: string | null; fight: boolean; retire: string | null; observer: boolean;
  livetest: 1 | 0 | null;
} {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    tab: params.get('tab'),
    fight: params.get('fight') === '1',
    retire: params.get('retire'),
    observer: params.get('observer') === '1',
    livetest: params.get('livetest') === '1' ? 1 : params.get('livetest') === '0' ? 0 : null,
  };
}
