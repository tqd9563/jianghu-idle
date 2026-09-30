/**
 * 模拟玩家：在假时钟下驱动**真实 store** 玩游戏。供两处复用：
 *   - session.sim.test.ts：产出埋点样例文件（埋点规格 §4 验收）；
 *   - pace.sim.test.ts：多天一世的节奏守卫，直接验里程碑天数（pacing/design.md §5）。
 *
 * 画像 = pacing/design.md §2.3 的标准玩家（与 pacing_sim.play 同一套规则）：
 *   每天固定上线 ONLINE_H 小时，其余离线；丹田满了多出的散掉，冲穴与突破只能在线做；
 *   上线先把夜里攒满的突破掉；寿元撑不到下次上线，就推完前沿当场归隐，把声望尽数换成修行感悟。
 *   一世内力约两成花在门径武学（pacing_sim.SKILL_SHARE）；有伤先养再打。
 * 只供测试使用，依赖 vitest 的假时钟。
 */
import { vi } from 'vitest';
import { requiredMeridian } from '../engine/acupoints';
import type { RouteId } from '../engine/content';
import { NEIGONG, neigongOf, QUALITY_ORDER, zhongCost, type NeigongId } from '../engine/neigong';
import { WUXUE, slotCount } from '../engine/wuxue';
import { SECT_IDS, SECT_REALM, SECT_TASKS } from '../engine/sect';
import { INIT_AGE, outlivesADay } from '../engine/reincarnation';
import { REP_NODES, ganwuPrice } from '../engine/prestige';
import { saveGame } from '../save/storage';
import {
  nextStageOf, openFronts, retireKind, sectShelfOf, shopItemsOf, shopPriceOf, useGameStore, zhoutianN, type MapNo,
} from '../store/gameStore';
import type { TierId } from '../engine/enemies';

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
export function challenge(map: MapNo, tier: TierId, stage: number): boolean {
  st().challengeStage(map, tier, stage);
  playBattle();
  return st().battle?.result.win ?? false;
}

const hurt = () => Object.values(st().injuries ?? {}).some((w) => w.severity >= 1);

/** 推各条可推前沿，每条推到第一场败仗为止；带伤不打（伤势重度再败会战死） */
export function pushFronts(opts: { stopAfterFirstLoss?: boolean } = {}): void {
  for (const { map, tier } of openFronts(st())) {
    let guard = 300;
    while (guard-- > 0 && !hurt()) {
      const next = nextStageOf(map, tier, st().clearedStages);
      if (next === null) break;
      if (!challenge(map, tier, next)) {
        if (opts.stopAfterFirstLoss) return;
        break;
      }
    }
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
    if (st().realm >= 2 && st().neigong === null) st().selectNeigong(bestNeigong(route));
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
    if (!process.env.PACE_NO_SECT) tendSect(route);
  }
}

/** 每世开头选本路数已拥有的最高品质内功 */
function bestNeigong(route: RouteId): NeigongId {
  const owned = st().ownedNeigong;
  return [...QUALITY_ORDER].reverse().map((q) => neigongOf(route, q)).find((id) => owned.includes(id))!;
}

/**
 * 门派（标准玩家）：先拜本路数的门派，本派货架买齐后改拜下一派；
 * 在线派短差，下线前改派长差（见 offline）；贡献按优先级依次换，换不起就攒着。
 */
function tendSect(route: RouteId): void {
  const s = st();
  if (s.realm < SECT_REALM) return;
  if (s.sect === null) {
    const order = [route, ...SECT_IDS.filter((id) => id !== route)];
    st().joinSect(order.find((id) => sectShelfOf(s, id).some((it) => !it.owned)) ?? route);
  }
  // 剩下的在线时间跑得完一件短差才派，否则留给下线前的长差
  if (st().sectTask === null && onlineLeftSec >= SECT_TASKS.short.hours * 3600) st().startSectTask('short');
  // 先换绝学武学（直接进装配），再内功、招式秘籍、卷册
  const rank = { wuxue: 0, neigong: 1, scroll: 2, juance: 3 } as const;
  for (let guard = 0; guard < 12; guard++) {
    const it = sectShelfOf(st(), st().sect!).filter((x) => !x.owned && x.lock === null)
      .sort((a, b) => rank[a.kind] - rank[b.kind])[0];
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
    .slice(0, slotCount(s.realm));
  for (const id of s.equipped) if (!want.includes(id)) st().unequipWuxue(id);
  for (const id of want) st().equipWuxue(id);
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
 * 归隐并花声望（寿终正寝已自动归隐时只收尾）。买法同 pacing_sim：基础声望买修行感悟；
 * 前沿乘数与名号多出来的部分先按序买五件传承，买齐后并入修行感悟。
 */
export function retireAndShop(): void {
  if (st().retireCeremony === null && retireKind(st()) !== null) {
    st().openRetire();
    st().proceedRetire();
    st().confirmRetire();
  }
  const c = st().retireCeremony;
  if (c) qolBudget += c.settle.total - c.settle.base + c.settle.fameThisLife;
  st().closeRetireCeremony();
  for (const node of REP_NODES) {
    if (st().ownedRepNodes.includes(node.id)) continue;
    if (qolBudget < node.price) break;
    st().buyRepNode(node.id);
    if (st().ownedRepNodes.includes(node.id)) qolBudget -= node.price;
  }
  // 传承未买齐时，留着的余量不许修行感悟花掉
  const reserve = REP_NODES.every((n) => st().ownedRepNodes.includes(n.id)) ? 0 : qolBudget;
  if (reserve === 0) qolBudget = 0;
  let guard = 2000;
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
  if (!process.env.PACE_NO_SECT && st().sect !== null && st().sectTask === null) st().startSectTask('long');
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

/** 标准玩家的一天：上线 → 在线 4 小时 → 推前沿 → 离线 20 小时 */
export function playDay(route: RouteId): void {
  login(route);
  online(route);
  pushFronts();
  offline();
}

/** 新开局时清空武学预算（hardReset 之后调用） */
export function resetBot(): void {
  skillBudget = 0;
  lastDantian = 0;
  qolBudget = 0;
}
