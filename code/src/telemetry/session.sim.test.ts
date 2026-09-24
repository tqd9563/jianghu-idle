/**
 * 会话模拟器：假时钟 + 种子随机驱动真实 store 完整走完「两轮 + 归隐」，
 * 产出观察员导出格式的样例文件，供 sim/analyze_telemetry.py 自验（埋点规格 §4 验收清单）。
 * 确定性：Date 假时钟固定起点 + Math.random LCG 种子 → 每次运行产出逐字节一致。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import { requiredMeridian, type AcupointState } from '../engine/acupoints';
import { effBreakCost, nextStageOf, useGameStore, type MapNo } from '../store/gameStore';
import { exportTelemetryJSON, getEvents } from './telemetry';

const OUT_DIR = resolve(process.cwd(), '../code/test-output');
const T0 = Date.UTC(2026, 6, 6, 9, 0, 0);

const st = () => useGameStore.getState();

/**
 * 本样例画像是「正常玩到归隐」，不该发生强制转世。一旦发生就立刻报错而不是让脚本空转：
 * 转世会把境界打回 1，「推到境界 N」的循环将永远到不了，测试直接挂死。
 */
function assertNoForcedRebirth() {
  const ev = getEvents().find((e) => e.e === 'forced_reincarnation');
  if (ev) {
    throw new Error(
      `样例玩家在第 ${ev.run} 世被迫转世：死因 ${String(ev.cause)}，${String(ev.age_at_death)} 岁，` +
      `已活 ${Math.round(Number(ev.run_duration_s) / 60)} 分钟，折寿 ${String(ev.lifespan_lost)} 年。` +
      '年岁速率与实际游玩节奏不匹配，见 reincarnation/spec.md §2.2',
    );
  }
}

/** 推进假时钟并驱动 tick（分块 ≤250s，避开单 tick 300s 上限） */
function advance(seconds: number) {
  let left = seconds;
  while (left > 0) {
    const step = Math.min(left, 250);
    vi.setSystemTime(Date.now() + step * 1000);
    st().tick(Date.now());
    assertNoForcedRebirth();
    left -= step;
  }
}

/** 播完当前战斗回放（每回合一次 tick） */
function playBattle() {
  let guard = 200;
  while (st().battle && !st().battle!.resolved && guard-- > 0) {
    vi.setSystemTime(Date.now() + st().battle!.intervalMs);
    st().tick(Date.now());
    assertNoForcedRebirth();
  }
  st().dismissFailure();
}

/**
 * 有伤先养好再打：伤势升到重度会折寿，重度再败即越过致死线当场战死（injury/spec.md §6）。
 * 正常玩家看到身上带伤会先养一养；不养伤硬撼同一堵墙是设计里的赌命路径，不是本样例要模拟的画像。
 */
function restIfGravelyHurt() {
  let guard = 60;
  while (Object.values(st().injuries ?? {}).some((w) => w.severity >= 1) && guard-- > 0) advance(60);
}

function challenge(map: MapNo, stage: number): boolean {
  restIfGravelyHurt();
  st().challengeStage(map, stage);
  playBattle();

  return st().battle!.result.win;
}

/** 失败后的「有意义调整」：优先买机制节点，其次升武学，否则等突破（贪心画像，对齐 sim） */
/** 直接把本境界首条经脉标为已贯通——埋点 sim 不测冲穴过程，只需越过突破门槛 */
function openRequiredMeridian(realm: number): void {
  const req = requiredMeridian(realm);
  if (!req) return;
  const acupointProgress: Record<string, AcupointState> = { ...useGameStore.getState().acupointProgress };
  for (const id of req.acupointIds) acupointProgress[id] = { failCount: 0, opened: true };
  useGameStore.setState({ acupointProgress });
}

function adjust() {
  const s = st();
  if (s.route) {
    const routes = ['tm1', 'tm2', 'tm3', 'sl1', 'sl2', 'sl3', 'hs1', 'hs2', 'hs3'];
    const next = routes.find((id) => !s.ownedMechNodes.includes(id) && id.startsWith(s.route === 'tangmen' ? 'tm' : s.route === 'shaolin' ? 'sl' : 'hs'));
    if (next) {
      st().buyMechNode(next);
      if (st().ownedMechNodes.includes(next)) return;
    }
    st().upgradeSkill();
    const upgraded = st().skillLevel > s.skillLevel;
    if (upgraded) return;
  }
  const cost = effBreakCost(st());
  if (cost !== null) {
    let guard = 40;
    while (st().dantian < cost && guard-- > 0) advance(120);
    // 主题版本双条件：模拟玩家已贯通本境界首条经脉（design.md §4）
    openRequiredMeridian(st().realm);
    st().breakthrough();
    st().dismissCeremony();
  } else {
    advance(120); // 已满境界：攒钱升武学
    st().upgradeSkill();
  }
}

/** 推平一张图（自动连战关闭，逐关挑战；失败→调整→重试） */
function pushMap(map: MapNo, opts: { stopAfterFirstBossAttempt?: boolean } = {}) {
  let guard = 120;
  for (;;) {
    const next = nextStageOf(map, st().clearedStages);
    if (next === null || guard-- <= 0) return;
    const isBoss = next === (map === 1 ? 8 : 10);
    const win = challenge(map, next);
    if (isBoss && opts.stopAfterFirstBossAttempt) return;
    if (!win) {
      adjust();
      advance(8);
    } else {
      advance(20); // 关卡间的自然间隔
      // 顺手升级可负担的武学（保持与产出同步成长）
      if (st().route && st().dantian > effBreakCost(st())! * 0.6) st().upgradeSkill();
    }
  }
}

function reachRealm(target: number) {
  let guard = 60;
  while (st().realm < target && guard-- > 0) {
    const cost = effBreakCost(st())!;
    while (st().dantian < cost) advance(200);
    // 主题版本双条件：模拟玩家已贯通本境界首条经脉（design.md §4）
    openRequiredMeridian(st().realm);
    st().breakthrough();
    st().dismissCeremony();
    if (st().realm === 2 && st().route === null) st().selectRoute('tangmen');
    advance(10);
  }
}

function exportFile(testerId: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  const json = exportTelemetryJSON({
    tester_id: testerId, build: BUILD, tables_version: TABLES_VERSION, telemetry_spec: TELEMETRY_SPEC,
  });
  writeFileSync(resolve(OUT_DIR, `mvp0_${testerId}_sample.json`), json);
}

describe('会话模拟器 · 产出 analyze_telemetry.py 自验样例', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    let seed = 42;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });
  });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('T90：完整两轮（标准归隐 + 二轮到 Boss 2），含 2 分钟暂停验收案例', () => {
    st().hardReset();
    st().startSession('T90');
    st().setAutoAdvance(false);
    advance(30);

    // 第一轮：境界 2 → 择路唐门 → 推图（含 Boss 2 首败与调整重试的真实链路）
    reachRealm(2);
    pushMap(1);
    // 埋点规格 §4 验收：一次人工 2 分钟暂停，净时间必须被扣除
    st().pauseSession();
    advance(120);
    st().resumeSession();
    pushMap(2);
    pushMap(3);
    // 推到标准归隐门槛（境界 5）即收手。此处原写 reachRealm(REALMS.length)：写于境界只有 5 个时，
    // MVP-2 扩到 7 个后含义悄悄变成「深推到境界 7」——那正是寿元要惩罚的贪命路径，不是本样例画像。
    reachRealm(5);
    if (nextStageOf(3, st().clearedStages) !== null) pushMap(3);

    // 归隐：预览 → 确认 → 30 秒内首购（§8.6-4）
    advance(40); // 归隐犹豫
    st().openRetire();
    advance(8);
    st().proceedRetire();
    advance(5);
    st().confirmRetire();
    st().closeRetireCeremony();
    advance(10);
    st().buyRepNode('jiumeng_chongwen');
    advance(5);
    st().buyRepNode('kuaisu_rumen');

    // 第二轮：更快抵达 Boss 2（首次挑战即算抵达，胜负不论）
    advance(15);
    reachRealm(2);
    pushMap(1);
    reachRealm(3);
    pushMap(2, { stopAfterFirstBossAttempt: true });
    st().endSession('completed');

    const names = getEvents().map((e) => e.e);
    expect(names).toContain('retire_confirmed');
    expect(names).toContain('test_paused');
    expect(names).toContain('test_resumed');
    expect(getEvents().some((e) => e.e === 'run_start' && e.run === 2)).toBe(true);
    expect(getEvents().some((e) => e.e === 'key_battle_end' && e.target === 'boss2' && e.run === 2)).toBe(true);
    const retire = getEvents().find((e) => e.e === 'retire_confirmed')!;
    expect(retire.kind).toBe('standard');
    exportFile('T90');
  });

  it('T91：设计脱落（Boss 2 卡死放弃，未归隐）', () => {
    st().hardReset(); // 同时清空埋点缓冲，开始新测试者
    st().startSession('T91');
    st().setAutoAdvance(false);
    advance(30);
    reachRealm(2);
    pushMap(1);
    pushMap(2, { stopAfterFirstBossAttempt: true });
    // 纯重试三次（不做任何调整）→ §10.2「无脑连点」信号
    for (let i = 0; i < 3; i++) {
      const next = nextStageOf(2, st().clearedStages);
      if (next === null) break;
      challenge(2, next);
      advance(6);
    }
    st().endSession('design_dropout');

    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(false);
    expect(getEvents().find((e) => e.e === 'test_session_end')!.reason).toBe('design_dropout');
    exportFile('T91');
  });
});
