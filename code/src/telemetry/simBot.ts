/**
 * 模拟玩家：在假时钟下驱动**真实 store** 玩游戏。供两处复用：
 *   - session.sim.test.ts：产出埋点样例文件（埋点规格 §4 验收）；
 *   - pace.sim.test.ts：实测世时长，给转世年岁速率做标定输入（reincarnation/spec.md §2.2）。
 *
 * 画像：贪心推图、失败后做「有意义调整」、有伤先养好再打、冲穴真花内力。
 * 只供测试使用，依赖 vitest 的假时钟。
 */
import { vi } from 'vitest';
import { requiredMeridian } from '../engine/acupoints';
import type { RouteId } from '../engine/content';
import { effBreakCost, nextStageOf, useGameStore, type MapNo } from '../store/gameStore';

export const st = () => useGameStore.getState();

/** 每次 tick 之后调用的钩子：样例用它拦截意外转世，标定用它冻结年岁 */
let afterTick: () => void = () => {};
export function setAfterTick(fn: () => void): void { afterTick = fn; }

/** 推进假时钟并驱动 tick（分块 ≤250s，避开单 tick 300s 上限） */
export function advance(seconds: number): void {
  let left = seconds;
  while (left > 0) {
    const step = Math.min(left, 250);
    vi.setSystemTime(Date.now() + step * 1000);
    st().tick(Date.now());
    afterTick();
    left -= step;
  }
}

/** 播完当前战斗回放（每回合一次 tick） */
export function playBattle(): void {
  let guard = 200;
  while (st().battle && !st().battle!.resolved && guard-- > 0) {
    vi.setSystemTime(Date.now() + st().battle!.intervalMs);
    st().tick(Date.now());
    afterTick();
  }
  st().dismissFailure();
}

/**
 * 有伤先养好再打：伤势升到重度会折寿，重度再败即越过致死线当场战死（injury/spec.md §6）。
 * 正常玩家看到身上带伤会先养一养；不养伤硬撼同一堵墙是设计里的赌命路径，不是这里要模拟的画像。
 * 实测对比：只在重度时才养，反而更慢（反复升入重度、带重伤挂机被压产出）。
 */
export function restIfHurt(): void {
  let guard = 60;
  while (Object.values(st().injuries ?? {}).some((w) => w.severity >= 1) && guard-- > 0) advance(60);
}

export function challenge(map: MapNo, stage: number): boolean {
  restIfHurt();
  st().challengeStage(map, stage);
  playBattle();
  return st().battle!.result.win;
}

/** 等丹田蓄满本境界突破消耗 */
function waitForFullDantian(): void {
  const cost = effBreakCost(st());
  if (cost === null) return;
  let guard = 400;
  while (st().dantian < cost && guard-- > 0) advance(60);
}

/**
 * 真冲穴：按次序冲本境界首条经脉，直到贯通（zhoutian/design.md v4.0）。
 * 冲一次扣所需真气、成败同扣；未松动或真气不足时修一会儿再冲。
 */
export function cultivateRequiredMeridian(): void {
  const req = requiredMeridian(st().realm);
  if (!req) return;
  let guard = 600;
  while (guard-- > 0) {
    const next = req.acupointIds.find((id) => !st().acupointProgress?.[id]?.opened);
    if (!next) return;
    const before = st().dantian;
    st().attemptAcupoint(next);
    if (st().dantian === before) advance(30);
  }
}

/** 突破一次：蓄满 → 冲穴贯通首脉 → 再蓄满 → 突破 */
function breakOnce(route: RouteId): void {
  waitForFullDantian();
  cultivateRequiredMeridian();
  waitForFullDantian();
  st().breakthrough();
  st().dismissCeremony();
  if (st().realm === 2 && st().route === null) st().selectRoute(route);
}

/** 失败后的「有意义调整」：优先买机制节点，其次升武学，否则去突破（贪心画像，对齐 mvp0_sim） */
export function adjust(route: RouteId): void {
  const s = st();
  if (s.route) {
    const prefix = s.route === 'tangmen' ? 'tm' : s.route === 'shaolin' ? 'sl' : 'hs';
    const next = [1, 2, 3].map((i) => `${prefix}${i}`).find((id) => !s.ownedMechNodes.includes(id));
    if (next) {
      st().buyMechNode(next);
      if (st().ownedMechNodes.includes(next)) return;
    }
    st().upgradeSkill();
    if (st().skillLevel > s.skillLevel) return;
  }
  if (effBreakCost(st()) !== null) {
    breakOnce(route);
  } else {
    advance(120); // 已满境界：攒钱升武学
    st().upgradeSkill();
  }
}

/** 推平一张图（自动连战关闭，逐关挑战；失败→调整→重试） */
export function pushMap(map: MapNo, route: RouteId, opts: { stopAfterFirstBossAttempt?: boolean } = {}): void {
  let guard = 120;
  for (;;) {
    const next = nextStageOf(map, st().clearedStages);
    if (next === null || guard-- <= 0) return;
    const isBoss = next === (map === 1 ? 8 : 10);
    const win = challenge(map, next);
    if (isBoss && opts.stopAfterFirstBossAttempt) return;
    if (!win) {
      adjust(route);
      advance(8);
    } else {
      advance(20); // 关卡间的自然间隔
      // 顺手升级可负担的武学（保持与产出同步成长）
      if (st().route && st().dantian > effBreakCost(st())! * 0.6) st().upgradeSkill();
    }
  }
}

export function reachRealm(target: number, route: RouteId): void {
  let guard = 60;
  while (st().realm < target && guard-- > 0) {
    breakOnce(route);
    advance(10);
  }
}
