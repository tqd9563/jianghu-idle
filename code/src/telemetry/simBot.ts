/**
 * 模拟玩家：在假时钟下驱动**真实 store** 玩游戏。供两处复用：
 *   - session.sim.test.ts：产出埋点样例文件（埋点规格 §4 验收）；
 *   - pace.sim.test.ts：多天一世的节奏守卫，直接验里程碑天数（pacing/design.md §5）。
 *
 * 画像 = pacing/design.md §2.3 的标准玩家（与 pacing_sim.play 同一套规则）：
 *   每天固定上线 ONLINE_H 小时，其余离线；丹田满了多出的散掉，冲穴与突破只能在线做；
 *   上线先把夜里攒满的突破掉；寿元撑不到下次上线，就推完前沿当场归隐，把声望尽数换成修行感悟。
 *   一世内力约两成花在门径武学（pacing_sim.SKILL_SHARE）；有伤先养再打。
 *   装备与市集（battle-loot/spec.md §7）：行囊里比身上强的穿上、其余卖掉；铺子只买比身上强的；黑市开了就买当天买得起的蒙面货。
 * 只供测试使用，依赖 vitest 的假时钟。
 */
import { vi } from 'vitest';
import { requiredMeridian } from '../engine/acupoints';
import type { RouteId } from '../engine/content';
import { NEIGONG, neigongOf, QUALITY_ORDER, zhongCost, type NeigongId } from '../engine/neigong';
import { GIFT_WUXUE_OPTIONS, WUXUE } from '../engine/wuxue';
import { SECTS, SECT_IDS, SECT_REALM, type SectTier } from '../engine/sect';
import { betterThanWorn } from '../engine/gear';
import { BLACK_PER_LIFE } from '../engine/market';
import type { SectShelfRow } from '../store/gameStore';
import { INIT_AGE, outlivesADay } from '../engine/reincarnation';
import { ACHV, setAchvOff, type AchvId } from '../engine/achievements';
import { DIYUN_IDS, REP_NODES, diyunPrice, freshDiyun, ganwuPrice } from '../engine/prestige';
import { saveGame } from '../save/storage';
import { mapDef } from '../engine/enemies';
import {
  volUnlocked, marketGoodsOf, nextStageOf, openFronts, retireKind, sectShelfOf, shopItemsOf, shopPriceOf, useGameStore, zhoutianN,
  giftPending, slotCountOf, type MapNo,
} from '../store/gameStore';

export const st = () => useGameStore.getState();

export const ONLINE_H = 4;
const OFFLINE_H = 24 - ONLINE_H;
/** 一世内力花在内功重数上的份额（pacing_sim.SKILL_SHARE） */
const SKILL_SHARE = 0.2;

/** 每次 tick 之后调用的钩子：样例用它拦截意外战死 */
let afterTick: () => void = () => {};
export function setAfterTick(fn: () => void): void { afterTick = fn; }

/** 内功预算：丹田实际进账的两成记入，升重从这里支取（与 pacing_sim 的「武学份额」同口径） */
let skillBudget = 0;
let lastDantian = 0;
/** 传承预算：前沿乘数与名号多出基础声望的部分 */
let qolBudget = 0;
let diyunBudget = 0;
function creditSkillBudget(): void {
  skillBudget += Math.max(0, st().dantian - lastDantian) * SKILL_SHARE;
  lastDantian = st().dantian;
}

/** 推进假时钟并驱动 tick（分块 ≤250s，避开单 tick 300s 上限）；丹田进账的两成记入武学预算 */
export function advance(seconds: number): void {
  let left = seconds;
  while (left > 0) {
    const step = Math.min(left, 250);
    lastDantian = st().dantian;
    vi.setSystemTime(Date.now() + step * 1000);
    st().tick(Date.now());
    afterTick();
    creditSkillBudget();
    left -= step;
  }
}

/** 播完当前战斗回放（每回合一次 tick） */
export function playBattle(): void {
  let guard = 200;
  while (st().battle && !st().battle!.resolved && guard-- > 0) {
    vi.setSystemTime(Math.max(Date.now() + 1, st().battle!.nextRevealAt));   // 揭示节拍按事件而定，直接跳到下一次揭示
    st().tick(Date.now());
    afterTick();
  }
  st().dismissFailure();
}

/** 挑战一关，返回胜负 */
export function challenge(map: MapNo, stage: number): boolean {
  st().challengeStage(map, stage);
  playBattle();
  return st().battle?.result.win ?? false;
}

const hurt = () => Object.values(st().injuries ?? {}).some((w) => w.severity >= 1);

/** 推各张可推的图，每张推到第一场败仗为止；打通一张图会开出新图，开了就接着推；带伤不打（伤势重度再败会战死） */
export function pushFronts(opts: { stopAfterFirstLoss?: boolean } = {}): void {
  const stuck = new Set<number>();
  for (let pass = 0; pass < 100; pass++) {
    // 排查开关：PACE_MAIN_ONLY=1 只推每卷主线（赶路图与第一章），并排的其余各章不打
    const front = openFronts(st()).find((f) => !stuck.has(f.map) && !(process.env.PACE_MAIN_ONLY && mapDef(f.map).chapter > 1));
    if (!front) return;
    let guard = 300;
    while (guard-- > 0 && !hurt()) {
      const next = nextStageOf(front.map, st().clearedStages);
      if (next === null) break;
      if (!challenge(front.map, next)) {
        if (opts.stopAfterFirstLoss) return;
        stuck.add(front.map);
        break;
      }
    }
    if (hurt()) return;
  }
}

/** 冲本境界必贯通经脉：松动了、真气够就冲，冲不动就算了（下一步挂机后再试） */
function tryAcupoints(): void {
  const req = requiredMeridian(st().realm);
  if (!req) return;
  for (let guard = 0; guard < 20; guard++) {
    const next = req.acupointIds.find((id) => !st().acupointProgress?.[id]?.opened);
    if (!next) return;
    const before = st().dantian;
    st().attemptAcupoint(next);
    if (st().dantian === before) return;
  }
}

/** 本境界的周天已缴到最后一段：窍穴要冲、突破在即，这时不拿内力去升重 */
function breakthroughPending(): boolean {
  const s = st();
  const N = zhoutianN(s.realm);
  return N !== null && s.chargeHighWater >= N - 1;
}

/** 在线时的一次「看一眼」：冲穴、突破、选内功（该路数的寻常内功）、升重；台阶顿悟由 tick 自动判 */
export function tend(route: RouteId): void {
  for (let guard = 0; guard < 10; guard++) {
    const realm = st().realm;
    tryAcupoints();
    st().breakthrough();
    st().dismissCeremony();
    if (st().neigong === null && (st().taught || st().run >= 2)) st().selectNeigong(bestNeigong(route));
    if (giftPending(st())) st().pickGiftWuxue(GIFT_WUXUE_OPTIONS[0]);   // 前辈所授武学：取伏狮拳法
    if (st().realm === realm) break;
  }
  if (st().neigong) {
    // 卡在台阶上时 upgradeZhong 不动，预算留着，顿悟后再花
    while (!breakthroughPending() && skillBudget >= zhongCost(st().zhong + 1) && st().dantian >= zhongCost(st().zhong + 1)) {
      const z = st().zhong;
      skillBudget -= zhongCost(z + 1);
      st().upgradeZhong();
      if (st().zhong === z) { skillBudget += zhongCost(z + 1); break; }
    }
    if (!process.env.PACE_NO_WUXUE) tendWuxue();
    if (!process.env.PACE_NO_MARKET) { tendGear(); tendMarket(); }
    if (!process.env.PACE_NO_SECT) tendSect(route);
  }
}

/** 每世开头选本路数已拥有的最高品质内功 */
/** 地位对应的最高档差事 */
const topTier = () => Math.max(1, Math.min(6, st().sectRank ?? 1)) as SectTier;

function bestNeigong(route: RouteId): NeigongId {
  const owned = st().ownedNeigong;
  return [...QUALITY_ORDER].reverse().map((q) => neigongOf(route, q)).find((id) => owned.includes(id))!;
}

/**
 * 门派（标准玩家）：先拜核心源流是本路的、能到的门派（有货的优先），本派货架买齐后改拜下一派；
 * 在线派地位最高档的 2 小时差事，下线前改派 8 小时（见 offline）；贡献按优先级依次换，换不起就攒着。
 */
function tendSect(route: RouteId): void {
  const s = st();
  if (s.realm < SECT_REALM) return;
  if (s.sect === null) {
    const reachable = SECT_IDS.filter((id) => volUnlocked(SECTS[id].vol, s.mapsUnlocked ?? [1]));
    const order = [...reachable.filter((id) => SECTS[id].route === route), ...reachable.filter((id) => SECTS[id].route !== route)];
    const pick = order.find((id) => sectShelfOf(s, id).some((it) => !it.owned)) ?? order[0];
    if (pick) st().joinSect(pick);
  }
  // 剩下的在线时间跑得完一件 2 小时差事才派，否则留给下线前的 8 小时
  if (st().sectTask === null && onlineLeftSec >= 2 * 3600) st().startSectTask(topTier(), 2);
  // 先凑绝学第一式残页（凑齐直接进装配），再内功（入门 → 进阶 → 镇派）、其余残页、寻常 / 上乘整门、装备、卷册
  const rank = (x: SectShelfRow) => x.kind === 'pages' && x.form === 1 && WUXUE[x.wuxue!].quality === '绝学' ? 0
    : x.kind === 'neigong' ? 1 : x.kind === 'pages' ? 2 : x.kind === 'wuxue' ? 3 : x.kind === 'gear' ? 4 : 5;
  for (let guard = 0; guard < 12; guard++) {
    const it = sectShelfOf(st(), st().sect!).filter((x) => !x.owned && x.lock === null && x.rank <= st().sectRank)
      .sort((a, b) => rank(a) - rank(b) || a.rank - b.rank)[0];
    if (!it || st().contrib < it.price) break;
    st().buySectItem(it.id);
  }
}

/** 武学（标准玩家）：银两全花在书肆（从便宜的买起），按品质、同路数优先装满槽 */
function tendWuxue(): void {
  for (let guard = 0; guard < 20; guard++) {
    const s = st();
    const item = shopItemsOf(s)
      .filter((it) => s.realm >= it.realm && shopPriceOf(s, it.price) <= s.silver)
      .filter((it) => it.kind === 'wuxue' ? !s.ownedWuxue.includes(it.wuxue!)
        : it.kind === 'scroll' ? !s.ownedScrolls.includes(`${it.wuxue}:${it.form}`) : true)
      .sort((a, b) => a.price - b.price)[0];
    if (!item) break;
    s.buyShopItem(item.id);
  }
  const s = st();
  const route = s.neigong ? NEIGONG[s.neigong].route : null;
  const want = [...s.ownedWuxue].sort((a, b) =>
    (QUALITY_ORDER.indexOf(WUXUE[b].quality) - QUALITY_ORDER.indexOf(WUXUE[a].quality))
    || (Number(WUXUE[b].route === route) - Number(WUXUE[a].route === route)))
    .slice(0, slotCountOf(s));
  for (const id of s.equipped) if (!want.includes(id)) st().unequipWuxue(id);
  for (const id of want) st().equipWuxue(id);
}

/** 装备（标准玩家）：行囊里比身上品阶高的穿上，其余一键卖掉（battle-loot/design.md §3.5 同一口径） */
function tendGear(): void {
  for (let guard = 0; guard < 8; guard++) {
    const s = st();
    const up = (s.bag ?? []).filter((g) => betterThanWorn(g, s.worn)).sort((a, b) => b.grade - a.grade)[0];
    if (!up) break;
    st().wearGear(up.id);
  }
  for (const g of [...(st().bag ?? [])]) if (!betterThanWorn(g, st().worn)) st().sellGear(g.id);
}

/**
 * 市集与黑市（标准玩家）：铺子货只买样品比身上强的，从便宜的买起；黑市开了就把当天的蒙面货买掉，
 * 买得起才买、每世额度用完为止。银两先花武馆（tendWuxue），再铺子，最后黑市。
 */
function tendMarket(): void {
  const s0 = st();
  if (!s0.marketOpen) return;
  for (let guard = 0; guard < 8; guard++) {
    const s = st();
    const { arms, wear } = marketGoodsOf(s);
    const good = [...arms, ...wear]
      .filter((g) => betterThanWorn(g.sample, s.worn) && shopPriceOf(s, g.price) <= s.silver)
      .sort((a, b) => a.price - b.price)[0];
    if (!good) break;
    const before = s.silver;
    st().buyMarketItem(good.id);
    if (st().silver === before) break;
    tendGear();
  }
  if (!st().blackOpen) return;
  st().refreshBlack();
  for (const g of st().blackGoods ?? []) {
    const s = st();
    if (g.revealed || (s.blackBuys ?? 0) >= BLACK_PER_LIFE || s.silver < g.price) continue;
    st().buyMasked(g.id);
  }
  tendGear();
}

/** 在线 hours 小时：每 5 分钟看一眼 */
/** 本次在线还剩几秒（门派任务派短差还是留给长差） */
let onlineLeftSec = 0;

export function online(route: RouteId, hours = ONLINE_H): void {
  const steps = Math.round((hours * 3600) / 300);
  // 一上线先派差：在线 4 小时正好跑两件短差
  onlineLeftSec = steps * 300;
  if (st().neigong && !process.env.PACE_NO_SECT) tendSect(route);
  for (let i = 0; i < steps; i++) {
    advance(300);
    onlineLeftSec = (steps - i - 1) * 300;
    tend(route);
  }
  onlineLeftSec = 0;
}

/**
 * 归隐并花声望（寿终正寝已自动归隐时只收尾）。买法同 pacing_sim（prestige-shop/design.md §3）：
 * 本世声望的 DIYUN_SHARE 平分八条底蕴；其余先按序买机缘（由前沿乘数与名号多出来的部分支付），买齐后并入修行感悟。
 */
export const DIYUN_SHARE = 0.15;
export function retireAndShop(): void {
  if (st().retireCeremony === null && retireKind(st()) !== null) {
    st().openRetire();
    st().proceedRetire();
    st().confirmRetire();
  }
  const c = st().retireCeremony;
  if (c) {
    qolBudget += c.settle.total - c.settle.base + c.settle.fameThisLife;
    diyunBudget += c.settle.total * DIYUN_SHARE;
  }
  st().closeRetireCeremony();
  // 底蕴：预算平分八条，各自从低到高买
  let guard = process.env.PACE_NO_DIYUN ? 0 : 4000;
  while (guard-- > 0) {
    const d = { ...freshDiyun(), ...(st().diyun ?? {}) };
    const id = DIYUN_IDS.reduce((a, b) => (d[b] < d[a] ? b : a));
    const price = diyunPrice(d[id] + 1);
    if (diyunBudget < price || st().reputation < price) break;
    st().buyDiyun(id);
    diyunBudget -= price;
  }
  // 排查开关：PACE_NO_JIYUAN=1 不买机缘、PACE_NO_DIYUN=1 不买底蕴（与 PACE_NO_WUXUE 同类）
  const onlyJy = process.env.PACE_JIYUAN ? new Set(process.env.PACE_JIYUAN.split(',')) : null;
  for (const node of process.env.PACE_NO_JIYUAN ? [] : REP_NODES.filter((n) => !onlyJy || onlyJy.has(n.id))) {
    if (st().ownedRepNodes.includes(node.id)) continue;
    if (qolBudget < node.price) break;
    st().buyRepNode(node.id);
    if (st().ownedRepNodes.includes(node.id)) qolBudget -= node.price;
  }
  // 机缘未买齐时，留着的余量不许修行感悟花掉
  const reserve = REP_NODES.every((n) => st().ownedRepNodes.includes(n.id)) ? 0 : qolBudget;
  if (reserve === 0) qolBudget = 0;
  guard = 2000;
  while (guard-- > 0 && st().reputation - ganwuPrice((st().ganwuLevel ?? 0) + 1) >= reserve) {
    const lv = st().ganwuLevel ?? 0;
    st().buyGanwu('one');
    if ((st().ganwuLevel ?? 0) === lv) break;
  }
  skillBudget = 0;
}

/** 离线 hours 小时：存档、拨快时钟、重新载入触发出关结算（闭关中寿终则直接进归隐演出） */
export function offline(hours = OFFLINE_H): void {
  // 下线前派长差（spec §5.2）
  if (!process.env.PACE_NO_SECT && st().sect !== null && st().sectTask === null) st().startSectTask(topTier(), 8);
  saveGame(st());
  vi.setSystemTime(Date.now() + hours * 3600 * 1000);
  useGameStore.setState({ started: false });
  lastDantian = st().dantian;
  st().init();
  st().dismissOfflineSettlement();
  if (st().retireCeremony) retireAndShop();
}

/** 上线：先突破；寿元撑不到下次上线，就先把眼前的突破办完、推完前沿，再归隐 */
export function login(route: RouteId): void {
  // 出关后第一次 tick 才会把丹田封顶、推高周天水位（窍穴随之松动），先挂一分钟再动手
  advance(60);
  tend(route);
  const s = st();
  if (retireKind(s) !== null && !outlivesADay(s.age ?? INIT_AGE, s.realm, s.lifespanLost ?? 0, s.peakRealm ?? 1)) {
    // 最后一段周天已满、窍穴冲过后丹田回落：在线补足再突破（寿元留有一个在线时段的余量）
    for (let i = 0; i < 48 && breakthroughPending() && st().run === s.run; i++) {
      advance(300);
      tend(route);
    }
    if (st().run === s.run) {
      pushFronts();
      retireAndShop();
    }
  }
}

/**
 * 标准玩家的一天（24 小时）：上线 → 在线 4 小时 → 推前沿 → 离线到满 24 小时。
 * 推关回放占用游戏时间（卷章图关后每世要重推几百关），多出的部分从离线里扣，一天不因推关变长。
 */
export function playDay(route: RouteId): void {
  login(route);
  online(route);
  const t0 = Date.now() / 3_600_000;
  pushFronts();
  offline(Math.max(1, OFFLINE_H - (Date.now() / 3_600_000 - t0)));
}

/** 新开局时清空武学预算（hardReset 之后调用） */
export function resetBot(): void {
  // 排查开关：ACHV_OFF=jian,dao,…（或 all）关掉侠名录指定线的效果，计量照记
  const off = process.env.ACHV_OFF;
  setAchvOff(!off ? [] : off === 'all' ? ACHV.map((a) => a.id) : (off.split(',') as AchvId[]));
  skillBudget = 0;
  lastDantian = 0;
  qolBudget = 0;
  diyunBudget = 0;
}
