/**
 * 观察员/开发调试通道：URL hash 预置状态与页签。
 * 例：#seed=realm3&tab=battle&fight=1 —— 仅用于开发自检与陪同测试的观察员操作，
 * 正式测试会话请勿携带 seed（会覆盖存档；埋点 run_start 不触发，避免污染完成率分母）。
 * MVP-1 验收 A4：#offlinecap=10 压低离线上限（分钟，持久生效）；#offlinecap=0 清除。
 */
import { backdateSavedAt, saveGame, setDebugOfflineCap } from './save/storage';

import { parseStageKey, stageKey, trackLength, unlocksAfterMap, VOLUMES, type MapId } from './engine/enemies';
import { makeHao, newLife, placeOfVol, type LifeRec } from './engine/chronicle';
import { holderAt, postById, type RosterKill } from './engine/roster';

/** 某张图的前 n 关（关卡键 m{图}s{关}）；n 缺省为全通 */
const upto = (map: MapId, n = trackLength(map)) =>
  Array.from({ length: n }, (_, i) => stageKey(map, i + 1));
/** 前 v 卷的主线（赶路图 + 第一章外围、门户）全通 */
const mainThrough = (v: number) => VOLUMES.slice(0, v).flatMap((vol) => vol.maps.slice(0, 3));
const cleared = (maps: MapId[]) => maps.flatMap((m) => upto(m));
/** 全通这些图后开放的图（含卷一赶路图） */
const opened = (maps: MapId[]) => [...new Set([1, ...maps, ...maps.flatMap(unlocksAfterMap)])];
/** 第 v 卷的赶路图 */
const road = (v: number) => VOLUMES[v - 1].maps[0];
/** 第 v 卷第一章的门户 */
const gate1 = (v: number) => VOLUMES[v - 1].maps[2];
const upTo4 = mainThrough(4);

/**
 * 江湖编年验收（活江湖批四）：第四世开局后几年，前三世各打过几家、有寿终有战死，名册已按前世换人。
 * 前世的事按「这一世打了哪些岗位」现推：对手取那一世出生年的在任者，与真实游玩同一口径。
 */
function chroniclePreset(): object {
  const seed = 20261026;
  const kills: RosterKill[] = [];
  const lives: LifeRec[] = [];
  const plan: { years: number; age: number; cause: 'old' | 'battle' | 'retire'; posts: string[]; sect?: string; realm5?: boolean }[] = [
    { years: 46, age: 64, cause: 'old', posts: ['蒿里寨#0', '蒿里寨#1', '蒿里寨#3'] },
    { years: 24, age: 42, cause: 'battle', posts: ['苍崖派#0', '千蛇窟#0', '千蛇窟#1'] },
    { years: 45, age: 63, cause: 'old', posts: ['蒿里寨#1', '苍崖派#1', '千岩寺#0', '千岩寺#1', '千岩寺#3'], sect: '苍崖派', realm5: true },
  ];
  let born = 100;
  plan.forEach((p, i) => {
    const rec = newLife(seed, i + 1, born);
    let vol = 1;
    p.posts.forEach((id, j) => {
      const post = postById(id)!;
      const map = parseStageKey(post.stageKey!)!.map;
      vol = Math.max(vol, VOLUMES.findIndex((v) => v.maps.includes(map)) + 1);
      const y = born + ((j + 1) * p.years) / (p.posts.length + 2) + 0.3;
      const hao = post.slot === 3 && !rec.hao ? makeHao(seed, i + 1, '剑', rec.female, 'gate') : undefined;
      if (hao) rec.hao = hao;
      rec.events.push({ k: 'beat', y, post: id, map, who: holderAt(seed, kills, post, born).person.name, ...(hao ? { hao } : {}) });
      kills.push({ post: id, year: born, at: Math.floor(y), end: born + p.years });
    });
    if (p.sect) rec.events.splice(2, 0, { k: 'sect', y: born + 8.6, sect: p.sect });
    if (p.realm5) rec.events.push({ k: 'realm', y: born + p.years - 6.4, realm: 5 });
    rec.vols = Array.from({ length: vol + 1 }, (_, k) => k + 1).filter((v) => v <= 3);
    rec.end = { year: born + p.years, age: p.age, cause: p.cause, place: placeOfVol(vol) };
    lives.push(rec);
    born += p.years;
  });
  const cur = { ...newLife(seed, 4, born), vols: [1, 2] };
  return {
    run: 4, realm: 3, route: 'huashan', neigong: 'jingleijue', zhong: 5, peakRealm: 5, taught: true,
    dantian: 6900, silver: 530, reputation: 900, repTotal: 2400,
    worldSeed: seed, rosterKills: kills, lifeDefeats: [], lives: [...lives, cur],
    clearedStages: cleared(mainThrough(1)), mapsUnlocked: opened(mainThrough(2)), attempts: {}, idle: null,
    age: 23.4, eraStart: born,
  };
}

const PRESETS: Record<string, object> = {
  // 原型场景 3 对应态：境界 3 · 蚀骨心法第 5 重 · 丹田 6,900 · 图2 推进到第 7 关（精英铁臂僧）
  realm3: {
    run: 1, realm: 3, route: 'tangmen', neigong: 'shiguxinfa', zhong: 5,
    dantian: 6900, silver: 530, xp: 189,
    reputation: 0, repTotal: 0,
    tiersPassed: 2, chargeHighWater: 3,
    clearedStages: [...cleared(upTo4), ...upto(road(5), 6)], attempts: {}, idle: null,
    mapsUnlocked: opened(upTo4), selectedMap: road(5),
  },
  // 突破就绪态：境界 4 · 六段周天缴清、任脉已贯通 · 图3 推进到第 8 关
  ready: {
    run: 1, realm: 4, route: 'tangmen', neigong: 'shiguxinfa', zhong: 7, peakRealm: 4,
    dantian: 76_000_000, silver: 830, xp: 250,   // ≥ 境界 4 突破消耗 7520 万（content.ts）
    reputation: 0, repTotal: 0,
    tiersPassed: 3, chargeHighWater: 6,
    acupointProgress: {
      guanyuan: { failCount: 0, opened: true }, qihai: { failCount: 0, opened: true },
      danzhong: { failCount: 1, opened: true },
    },
    clearedStages: [...cleared(mainThrough(6)), ...upto(road(7), 7)], attempts: {}, idle: null,
    mapsUnlocked: opened(mainThrough(6)), selectedMap: road(7),
  },
  // 境界门槛卡点态：境界 3 打推荐境界 4 的卷六门户 Boss（复现失败诊断规则 1）
  boss2: {
    run: 1, realm: 3, route: 'tangmen', neigong: 'shiguxinfa', zhong: 6,
    dantian: 3210, silver: 490, xp: 96,
    reputation: 0, repTotal: 0,
    tiersPassed: 3, chargeHighWater: 1,
    clearedStages: [...cleared(mainThrough(6).slice(0, -1)), ...upto(gate1(6), trackLength(gate1(6)) - 1)], attempts: {}, idle: null,
    mapsUnlocked: opened(mainThrough(6).slice(0, -1)), selectedMap: gate1(6),
  },
  // 归隐就绪态：境界 5 + 前八卷主线全通
  retire: {
    run: 1, realm: 5, route: 'tangmen', neigong: 'shiguxinfa', zhong: 10, peakRealm: 5, lifeWeightedHours: 12,
    dantian: 3400, silver: 830, xp: 59,
    reputation: 0, repTotal: 0,
    tiersPassed: 3, chargeHighWater: 0,
    clearedStages: cleared(mainThrough(8)),
    mapsUnlocked: opened(mainThrough(8)), deepestBossEver: 8,
    attempts: { boss3: 2 }, idle: null,
    runPlaySec: 2760, lastProgressSec: 2700, standardNotified: false,
  },
  // 长线第 35 天早上（原型 longline-prototype.html 的 mock 玩家）：境界 4 峰值、推完前沿待归隐
  day35: {
    run: 35, realm: 4, route: 'tangmen', neigong: 'shiguxinfa', zhong: 64, peakRealm: 4,
    dantian: 12_863_420, silver: 2140, xp: 312,
    reputation: 150, repTotal: 180_000, ganwuLevel: 136,
    ownedRepNodes: ['chongchu_jianghu', 'qingzhuang_shanglu', 'gaixian_yizhe', 'baoluo_wanxiang'],
    tiersPassed: 3, chargeHighWater: 5,
    // 早上推完前沿：前六卷主线全通，卷七赶路推到第 8 关
    clearedStages: [...cleared(mainThrough(6)), ...upto(road(7), 8)],
    attempts: {}, idle: null,
    mapsUnlocked: opened(mainThrough(6)), selectedMap: road(7),
    lifeWeightedHours: 598.4, deepestBossEver: 6, fameThisLife: 243,
    fameClaimed: [
      `stage:${stageKey(gate1(4), trackLength(gate1(4)))}`, `stage:${stageKey(gate1(5), trackLength(gate1(5)))}`,
      `stage:${stageKey(gate1(6), trackLength(gate1(6)))}`,
      'meridian:shoutaiyin', 'meridian:shouyangming', 'meridian:zuyangming',
    ],
    age: 63, eraStart: 1580,
  },
  // 第二轮开局态：首轮标准归隐结算后（130 声望未消费），验证前尘页与底蕴 / 机缘购买
  run2: {
    run: 2, realm: 1, route: null, neigong: null, zhong: 0,
    dantian: 0, silver: 0, xp: 0,
    reputation: 130, repTotal: 130,
    tiersPassed: 0, ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, idle: null,
    runPlaySec: 0, lastProgressSec: 0, standardNotified: false,
  },
  // 选内功弹窗：刚突破入境界 2、尚未主修内功（issue #26 视觉验收用）
  pick: {
    run: 2, realm: 2, route: null, neigong: null, zhong: 0, peakRealm: 2,
    dantian: 0, silver: 0, xp: 0,
    reputation: 130, repTotal: 130,
    tiersPassed: 0, ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, idle: null,
    runPlaySec: 0, lastProgressSec: 0, standardNotified: false,
  },
  // 转世系统（reincarnation-prototype.html）：垂暮态——境界 3 寿元 90，80 岁时离寿元不足一次重伤
  dusk: {
    run: 3, realm: 3, route: 'tangmen', neigong: 'shiguxinfa', zhong: 5,
    dantian: 6900, silver: 530, xp: 189, reputation: 260, repTotal: 260,
    tiersPassed: 2, chargeHighWater: 3,
    clearedStages: [...cleared(upTo4), ...upto(road(5), 6)], attempts: {}, idle: null,
    mapsUnlocked: opened(upTo4), age: 80, eraStart: 206, peakRealm: 3,
  },
  // 将死态：境界 3、89.99 岁，挂机片刻即寿终正寝，用于看自动归隐演出
  dying: {
    run: 3, realm: 3, route: 'tangmen', neigong: 'shiguxinfa', zhong: 5,
    dantian: 6900, silver: 530, xp: 189, reputation: 260, repTotal: 260,
    tiersPassed: 2, chargeHighWater: 3,
    clearedStages: [...cleared(upTo4), ...upto(road(5), 6)], attempts: {}, idle: null,
    mapsUnlocked: opened(upTo4), age: 89.99, eraStart: 206, peakRealm: 3,
  },
  // 魂魄未稳态：被迫转世后的新一世开局
  jianghu: chroniclePreset(),
  soul: {
    run: 4, realm: 1, route: null, neigong: null, zhong: 0,
    dantian: 0, silver: 0, xp: 0, reputation: 390, repTotal: 390,
    tiersPassed: 0, ownedRepNodes: [], chargeHighWater: 0,
    clearedStages: [], attempts: {}, idle: null,
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
