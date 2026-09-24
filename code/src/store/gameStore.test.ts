/**
 * store 行为测试：单钱包丹田模型 + 埋点事件发射（对齐规格书 §6.1 v0.9 / 埋点规格 §1.2）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REALMS, skillUpgradeCost } from '../engine/content';
import {
  resetLiveTestWindowForTests, startLiveTestWindow as persistLiveTestWindow, loadGame, saveGame, backdateSavedAt,
} from '../save/storage';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import { TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import { effBreakCost, effIdleRate, playerBuild, resetLiveTestVisitForTests, retireKind, useGameStore } from './gameStore';
import { freshInjuries, isHurt } from '../engine/injury';
import { idleNeiliPerSec } from '../engine/formulas';
import { REALM_ACUPOINTS } from '../engine/acupoints';
import { INIT_AGE, ERA_START, AGE_YEARS_PER_MIN, LIFESPAN_CAP, SOUL_WEAK_MULT } from '../engine/reincarnation';

function names() {
  return getEvents().map((e) => e.e);
}

describe('gameStore · 单钱包丹田模型', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('挂机 tick 按境界速率入丹田；周天新高越段发 charge_segment_full，回落再越不重复', () => {
    const s = useGameStore.getState();
    const t0 = Date.now();
    // 100 秒 → 900 内力（境界 1 速率 9/s），越过第一段阈值 560
    s.tick(t0 + 100_000);
    expect(useGameStore.getState().dantian).toBeCloseTo(900, 0);
    expect(names().filter((n) => n === 'charge_segment_full')).toHaveLength(1);

    // 花钱回落（模拟升武学扣款）再涨回：不重复发段事件
    useGameStore.setState({ dantian: 300 });
    useGameStore.getState().tick(t0 + 140_000); // +360 → 660，重新越过 560
    expect(names().filter((n) => n === 'charge_segment_full')).toHaveLength(1);
  });

  it('丹田不足时不能突破；足额突破扣全额、境界+1、发 realm_breakthrough', () => {
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(1);

    useGameStore.setState({ dantian: 2800 });
    useGameStore.getState().breakthrough();
    const s = useGameStore.getState();
    expect(s.realm).toBe(2);
    expect(s.dantian).toBe(0);
    expect(s.ceremony).toBe(2);
    expect(names()).toContain('realm_breakthrough');
  });

  it('武学升级受上限 = 境界×2 约束，消耗 200×1.4^(n−1)', () => {
    useGameStore.setState({ realm: 2, route: 'tangmen', dantian: 10_000, skillLevel: 3 });
    useGameStore.getState().upgradeSkill(); // → Lv4（境界 2 上限 4）
    expect(useGameStore.getState().skillLevel).toBe(4);
    expect(useGameStore.getState().dantian).toBe(10_000 - skillUpgradeCost(4));

    useGameStore.getState().upgradeSkill(); // Lv5 超上限，拒绝
    expect(useGameStore.getState().skillLevel).toBe(4);
  });

  it('选路线只此一次（换线走 route_changed，随战斗模块交付）', () => {
    useGameStore.setState({ realm: 2 });
    useGameStore.getState().selectRoute('shaolin');
    expect(names()).toContain('route_selected');
    useGameStore.getState().selectRoute('huashan');
    expect(useGameStore.getState().route).toBe('shaolin');
  });

  it('机制节点按路线购买、扣阅历、发 mech_node_bought', () => {
    useGameStore.setState({ realm: 3, route: 'tangmen', xp: 100 });
    useGameStore.getState().buyMechNode('tm1'); // 40 阅历
    const s = useGameStore.getState();
    expect(s.ownedMechNodes).toEqual(['tm1']);
    expect(s.xp).toBe(60);
    useGameStore.getState().buyMechNode('tm2'); // 80 阅历 > 60，拒绝
    expect(useGameStore.getState().ownedMechNodes).toEqual(['tm1']);
  });
});

const m1all = Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`);
const m2all = Array.from({ length: 10 }, (_, i) => `m2s${i + 1}`);
const m3all = Array.from({ length: 10 }, (_, i) => `m3s${i + 1}`);

describe('gameStore · 归隐与声望阁', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('归隐门槛：境界 5 前不可用；境界 5 + Boss 3 = 标准；保底一经开放持续存在', () => {
    expect(retireKind(useGameStore.getState())).toBeNull();

    useGameStore.setState({ realm: 5, clearedStages: [...m1all, ...m2all, ...m3all] });
    expect(retireKind(useGameStore.getState())).toBe('standard');

    // 保底：累计 4 败触发；后续调整（b3Fails 不清）也不收回
    useGameStore.setState({ clearedStages: [...m1all, ...m2all, ...m3all.slice(0, 9)], b3Fails: 4 });
    expect(retireKind(useGameStore.getState())).toBe('fallback');
    useGameStore.setState({ b3Fails: 0, fallbackUnlocked: true, lastProgressSec: 0, runPlaySec: 0 });
    expect(retireKind(useGameStore.getState())).toBe('fallback');
  });

  it('保底触发 tick 上报 retire_unlocked(fallback) 并弹一次性提示', () => {
    useGameStore.setState({
      realm: 5, clearedStages: [...m1all, ...m2all, ...m3all.slice(0, 9)],
      b3Fails: 4, runPlaySec: 2400, lastProgressSec: 2300,
    });
    useGameStore.getState().tick(Date.now() + 500);
    const s = useGameStore.getState();
    expect(s.fallbackUnlocked).toBe(true);
    expect(s.retireToast).toBe('fail_streak');
    const ev = getEvents().find((e) => e.e === 'retire_unlocked')!;
    expect(ev.kind).toBe('fallback');
    expect(ev.trigger).toBe('fail_streak');
  });

  it('归隐执行：三事件链、声望入账（三图轮 120）、状态重置、节点继承生效', () => {
    useGameStore.setState({
      realm: 5, route: 'tangmen', skillLevel: 10,
      dantian: 3400, silver: 830, xp: 59,
      clearedStages: [...m1all, ...m2all, ...m3all],
      runPlaySec: 2760, ownedRepNodes: ['wudao_biji'],
    });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();
    const s = useGameStore.getState();
    expect(s.run).toBe(2);
    expect(s.realm).toBe(1);
    expect(s.route).toBeNull();
    expect(s.dantian).toBe(0);
    expect(s.silver).toBe(0);
    expect(s.xp).toBe(40); // 武道笔记
    expect(s.reputation).toBe(120);
    expect(s.clearedStages).toEqual([]);
    expect(s.retireCeremony!.settle.total).toBe(120);
    const ns = names();
    expect(ns).toContain('retire_preview_opened');
    expect(ns).toContain('retire_confirmed');
    const runStart = getEvents().find((e) => e.e === 'run_start' && e.run === 2)!;
    expect(runStart.carry_xp).toBe(40);
    expect(runStart.owned_nodes).toEqual(['wudao_biji']);
  });

  it('秘籍收集跨归隐保留，本轮渠道计数重置并全部持久化', () => {
    useGameStore.setState({
      realm: 5,
      clearedStages: [...m1all, ...m2all, ...m3all],
      runPlaySec: 2760,
      collectedPages: ['legacy_intro_page_1'],
      completedBooks: ['legacy_intro'],
      trialWinsThisRun: { trial_jinglei: 1 },
      bossKillsThisRun: { boss_1: 1, boss_2: 1 },
      shopPurchasesThisRun: 1,
    });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();

    const state = useGameStore.getState();
    expect(state.collectedPages).toEqual(['legacy_intro_page_1']);
    expect(state.completedBooks).toEqual(['legacy_intro']);
    expect(state.trialWinsThisRun).toEqual({});
    expect(state.bossKillsThisRun).toEqual({});
    expect(state.shopPurchasesThisRun).toBe(0);

    const saved = loadGame<{
      collectedPages: string[];
      completedBooks: string[];
      trialWinsThisRun: Record<string, number>;
      bossKillsThisRun: Record<string, number>;
      shopPurchasesThisRun: number;
    }>();
    expect(saved).toMatchObject({
      collectedPages: ['legacy_intro_page_1'],
      completedBooks: ['legacy_intro'],
      trialWinsThisRun: {},
      bossKillsThisRun: {},
      shopPurchasesThisRun: 0,
    });
  });

  it('预览/确认中退出发 retire_cancelled 且不结算', () => {
    useGameStore.setState({ realm: 5, clearedStages: [...m1all, ...m2all, ...m3all], runPlaySec: 2760 });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().cancelRetire();
    expect(useGameStore.getState().run).toBe(1);
    const ev = getEvents().find((e) => e.e === 'retire_cancelled')!;
    expect(ev.step).toBe('confirm');
  });

  it('声望节点购买：扣声望、发 prestige_node_bought；不足拒绝', () => {
    useGameStore.setState({ reputation: 130 });
    useGameStore.getState().buyRepNode('jiumeng_chongwen'); // 60
    let s = useGameStore.getState();
    expect(s.reputation).toBe(70);
    expect(s.ownedRepNodes).toEqual(['jiumeng_chongwen']);
    useGameStore.getState().buyRepNode('poguan_xinde'); // 70 → 0
    useGameStore.getState().buyRepNode('shimen_zhiyin'); // 80 > 0，拒绝
    s = useGameStore.getState();
    expect(s.reputation).toBe(0);
    expect(s.ownedRepNodes).toEqual(['jiumeng_chongwen', 'poguan_xinde']);
    const ev = getEvents().filter((e) => e.e === 'prestige_node_bought');
    expect(ev).toHaveLength(2);
    expect(ev[0].balance_after).toBe(70);
  });

  it('换路线：阅历 100% 返还（仅已投入）、200 银两摩擦费、武学清零、发 route_changed', () => {
    useGameStore.setState({
      realm: 3, route: 'tangmen', skillLevel: 5, silver: 530, xp: 189,
      ownedMechNodes: ['tm1'], mechXpInvested: 40,
    });
    useGameStore.getState().switchRoute('shaolin');
    const s = useGameStore.getState();
    expect(s.route).toBe('shaolin');
    expect(s.skillLevel).toBe(0);
    expect(s.silver).toBe(330);
    expect(s.xp).toBe(229);
    expect(s.ownedMechNodes).toEqual([]);
    expect(s.mechXpInvested).toBe(0);
    const ev = getEvents().find((e) => e.e === 'route_changed')!;
    expect(ev.route_from).toBe('tangmen');
    expect(ev.route_to).toBe('shaolin');
    expect(ev.xp_refunded).toBe(40);
    expect(ev.fee_paid).toBe(200);
  });

  it('轻装上路：每轮第一次换线免费；第二次收费且银两不足拒绝', () => {
    useGameStore.setState({
      realm: 3, route: 'tangmen', skillLevel: 2, silver: 0, xp: 0,
      ownedRepNodes: ['qingzhuang_shanglu'],
    });
    useGameStore.getState().switchRoute('huashan'); // 免费成功
    expect(useGameStore.getState().route).toBe('huashan');
    expect(getEvents().find((e) => e.e === 'route_changed')!.fee_paid).toBe(0);
    useGameStore.getState().switchRoute('shaolin'); // 第二次要 200，银两 0 → 拒绝
    expect(useGameStore.getState().route).toBe('huashan');
  });

  it('师门指引跟随换线：新路线节点一免费重赠，免费赠予不计入返还', () => {
    useGameStore.setState({
      realm: 3, route: 'tangmen', skillLevel: 0, silver: 400, xp: 0,
      ownedRepNodes: ['shimen_zhiyin'], ownedMechNodes: ['tm1'], mechXpInvested: 0,
    });
    useGameStore.getState().switchRoute('shaolin');
    const s = useGameStore.getState();
    expect(s.ownedMechNodes).toEqual(['sl1']);
    expect(s.xp).toBe(0); // 赠予节点无投入，无返还
  });

  it('观察员暂停冻结产出与活跃时长；恢复后继续；会话事件字段齐全', () => {
    const t0 = Date.now();
    useGameStore.getState().startSession('T03');
    const start = getEvents().find((e) => e.e === 'test_session_start')!;
    expect(start.tester_id).toBe('T03');
    expect(start.telemetry_spec).toBe(TELEMETRY_SPEC);

    useGameStore.getState().pauseSession();
    useGameStore.getState().tick(t0 + 50_000);
    let s = useGameStore.getState();
    expect(s.dantian).toBe(0);
    expect(s.runPlaySec).toBe(0);

    useGameStore.getState().resumeSession();
    useGameStore.getState().tick(t0 + 60_000);
    s = useGameStore.getState();
    expect(s.runPlaySec).toBeCloseTo(10, 0);
    expect(s.dantian).toBeCloseTo(90, 0);

    useGameStore.getState().endSession('completed');
    expect(getEvents().find((e) => e.e === 'test_session_end')!.reason).toBe('completed');
    expect(names()).toContain('test_paused');
    expect(names()).toContain('test_resumed');
  });

  it('会话状态持久化：重复开始不重发事件；暂停中结束自动补发 test_resumed 闭合配对', () => {
    useGameStore.getState().startSession('T02');
    let s = useGameStore.getState();
    expect(s.sessionActive).toBe(true);
    expect(loadGame<{ sessionActive: boolean }>()!.sessionActive).toBe(true); // 面板重开/刷新不丢

    useGameStore.getState().startSession('T02'); // 面板状态错乱时的双击保护
    expect(names().filter((n) => n === 'test_session_start')).toHaveLength(1);

    useGameStore.getState().pauseSession();
    expect(loadGame<{ paused: boolean }>()!.paused).toBe(true); // 刷新不静默解冻
    useGameStore.getState().endSession('completed');
    const evs = names();
    expect(evs.indexOf('test_resumed')).toBeGreaterThan(evs.indexOf('test_paused'));
    expect(evs.indexOf('test_session_end')).toBeGreaterThan(evs.indexOf('test_resumed'));
    s = useGameStore.getState();
    expect(s.sessionActive).toBe(false);
    expect(s.paused).toBe(false);
  });

  it('胜利收益快照（收益行同源同值）：首通全额、回刷内力两成阅历为零、江湖熟路仅乘内力', () => {
    useGameStore.setState({
      realm: 5, route: 'tangmen', skillLevel: 10, ownedRepNodes: ['jianghu_shulu'],
      autoAdvance: false,
    });
    const play = () => {
      const t0 = Date.now();
      for (let i = 1; i <= 80 && !(useGameStore.getState().battle?.resolved ?? false); i++) {
        useGameStore.getState().tick(t0 + i * 700);
      }
      return useGameStore.getState().battle!;
    };
    useGameStore.getState().challengeStage(1, 1);
    const first = play();
    expect(first.result.win).toBe(true);
    const base = first.enemy.reward;
    expect(first.reward).toEqual({
      neili: base.neili * 1.2, silver: base.silver, xp: base.xp, refarm: false,
    });

    useGameStore.getState().challengeStage(1, 1); // 回刷同一关
    const second = play();
    expect(second.reward!.refarm).toBe(true);
    expect(second.reward!.neili).toBeCloseTo(Math.round(base.neili * 0.2) * 1.2, 6);
    expect(second.reward!.xp).toBe(0);

    useGameStore.getState().challengeStage(1, 1); // 连续第 2 次回刷：×0.8 衰减（公式表 §6）
    const third = play();
    expect(third.reward!.neili).toBeCloseTo(Math.round(Math.round(base.neili * 0.2) * 0.8) * 1.2, 6);
    expect(third.reward!.silver).toBe(Math.round(Math.round(base.silver * 0.5) * 0.8));

    // 间隔 10 分钟重置衰减
    useGameStore.setState({ runPlaySec: useGameStore.getState().runPlaySec + 601 });
    useGameStore.getState().challengeStage(1, 1);
    const fourth = play();
    expect(fourth.reward!.neili).toBeCloseTo(Math.round(base.neili * 0.2) * 1.2, 6);
  });

  it('师门指引：择路免费获得机制节点一，不发 mech_node_bought；快速入门折减境界 2 消耗', () => {
    useGameStore.setState({ realm: 2, ownedRepNodes: ['shimen_zhiyin', 'kuaisu_rumen'] });
    expect(effBreakCost(useGameStore.getState())).toBe(Math.round(5000 * 0.7)); // 境界 3 目标
    useGameStore.setState({ realm: 1 });
    expect(effBreakCost(useGameStore.getState())).toBe(Math.round(2800 * 0.7));

    useGameStore.setState({ realm: 2 });
    useGameStore.getState().selectRoute('tangmen');
    expect(useGameStore.getState().ownedMechNodes).toEqual(['tm1']);
    expect(names().filter((n) => n === 'mech_node_bought')).toHaveLength(0);
  });

  it('回刷胜利后自动连战回到同一关（回退挂机）；收益标记 refarm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    useGameStore.setState({ realm: 5, route: 'shaolin', skillLevel: 10, clearedStages: ['m1s1'], autoAdvance: true });
    useGameStore.getState().challengeStage(1, 1); // 已通关 → 回刷

    // 推进回放至结算（境界 5 打第 1 关必胜，普通关 650ms/回合）
    for (let i = 0; i < 300; i++) {
      const b = useGameStore.getState().battle;
      if (!b || b.resolved) break;
      vi.setSystemTime(Date.now() + 700);
      useGameStore.getState().tick(Date.now());
    }
    const b1 = useGameStore.getState().battle!;
    expect(b1.resolved).toBe(true);
    expect(b1.result.win).toBe(true);
    expect(b1.reward!.refarm).toBe(true);
    expect(b1.chainStage).toBe(1); // 回刷 → 原关，不是下一关

    // 越过 chainAt：自动开下一场，仍是第 1 关
    vi.setSystemTime(Date.now() + 1_000);
    useGameStore.getState().tick(Date.now());
    const b2 = useGameStore.getState().battle!;
    expect(b2).not.toBeNull();
    expect(b2.stage).toBe(1);
    expect(b2.resolved).toBe(false);
    vi.useRealTimers();
  });
});

describe('gameStore · MVP-2 natural live-test window', () => {
  beforeEach(() => {
    resetLiveTestWindowForTests();
    resetLiveTestVisitForTests();
    useGameStore.getState().hardReset();
    useGameStore.setState({ liveTestWindow: null });
    resetTelemetry();
  });

  it('starts after init in start → visit order and suppresses duplicate start/visit on this page', () => {
    useGameStore.getState().applyLiveTestSwitch(1);
    useGameStore.getState().applyLiveTestSwitch(1);
    const events = getEvents();
    expect(events.map((event) => event.e)).toEqual(['natural_window_started', 'natural_window_visit']);
    expect(events[0].window_id).toBe(events[1].window_id);
    expect(events[0].tables_version_started).toBe(TABLES_VERSION);
    expect(events[0].tables_version_current).toBe(TABLES_VERSION);
    expect(events[0].tables_version_changed).toBe(false);
  });

  it('reloads a persisted window with exactly one visit and reports table-version drift', () => {
    const record = persistLiveTestWindow('older-tables', 1234);
    resetLiveTestVisitForTests();
    useGameStore.setState({ started: false, liveTestWindow: null, offlineSettlement: null });
    useGameStore.getState().init();
    useGameStore.getState().init();
    const visits = getEvents().filter((event) => event.e === 'natural_window_visit');
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      window_id: record.windowId,
      started_at: 1234,
      tables_version_started: 'older-tables',
      tables_version_current: TABLES_VERSION,
      tables_version_changed: true,
    });
  });

  it('captures only existing objective snapshot decisions and stops in ended order', () => {
    useGameStore.setState({
      realm: 2, route: 'tangmen', skillLevel: 3, dantian: 10_000,
      clearedStages: [...m1all, 'm2s1'],
    });
    useGameStore.getState().applyLiveTestSwitch(1);
    const visit = getEvents().find((event) => event.e === 'natural_window_visit')!;
    expect(visit).toMatchObject({
      run: 1, realm: 2, route: 'tangmen', max_cleared_stage: 'm2s1', cleared_stage_count: 9,
      offline_settlement_present: false, offline_settlement_capped: null,
      decision_breakthrough: true, decision_skill: true, decision_battle: true, decision_retire: false,
    });
    useGameStore.getState().applyLiveTestSwitch(0);
    useGameStore.getState().applyLiveTestSwitch(0);
    expect(names()).toEqual(['natural_window_started', 'natural_window_visit', 'natural_window_ended']);
    expect(useGameStore.getState().liveTestWindow).toBeNull();
  });

  it('trims subjective note fields and emits nothing without an active window', () => {
    const note = {
      natural_open: true,
      open_reason: '  想起突破  ',
      settlement_understood: null,
      decision: '  升武学  ',
      next_goal: '  打 Boss  ',
      feeling: '  目标清楚  ',
    } as const;
    useGameStore.getState().recordNaturalWindowNote(note);
    expect(getEvents()).toHaveLength(0);
    useGameStore.getState().applyLiveTestSwitch(1);
    useGameStore.getState().recordNaturalWindowNote(note);
    const event = getEvents().find((item) => item.e === 'natural_window_note')!;
    expect(event).toMatchObject({
      natural_open: true, open_reason: '想起突破', settlement_understood: null,
      decision: '升武学', next_goal: '打 Boss', feeling: '目标清楚',
    });
  });
});

describe('gameStore · 受伤系统接线（injury/spec.md）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('新存档带空伤势，挂机产出不被压制', () => {
    const s = useGameStore.getState();
    expect(isHurt(s.injuries ?? freshInjuries())).toBe(false);
    expect(effIdleRate(s)).toBeCloseTo(idleNeiliPerSec(s.realm), 6);
  });

  it('带伤时挂机产出按 spec §3 压制', () => {
    useGameStore.setState({ injuries: { ...freshInjuries(), nei: { severity: 2, healAccMin: 0 } } });
    const s = useGameStore.getState();
    // 内伤·中 → 0.8125（spec §3 精确值表）
    expect(effIdleRate(s)).toBeCloseTo(idleNeiliPerSec(s.realm) * 0.8125, 6);
  });

  it('tick 推进游戏内时间会自愈（spec §5：轻伤境界 1 需 3 分钟）', () => {
    useGameStore.setState({ injuries: { ...freshInjuries(), wai: { severity: 1, healAccMin: 0 } } });
    const t0 = Date.now();
    // 分两段推进：tick 单次 dt 上限 300 秒
    useGameStore.getState().tick(t0 + 120_000);
    expect(useGameStore.getState().injuries!.wai.severity).toBe(1);  // 2 分钟未愈
    useGameStore.getState().tick(t0 + 240_000);
    expect(useGameStore.getState().injuries!.wai.severity).toBe(0);  // 满 3 分钟痊愈
  });

  it('伤势叠加进 playerBuild，且不污染路线专属字段', () => {
    const base = playerBuild({
      realm: 4, route: 'huashan', skillLevel: 7, ownedMechNodes: [], completedBooks: [],
    });
    const hurt = playerBuild({
      realm: 4, route: 'huashan', skillLevel: 7, ownedMechNodes: [], completedBooks: [],
      injuries: { ...freshInjuries(), nei: { severity: 3, healAccMin: 0 } },
    });
    expect(hurt.atk).toBeCloseTo(base.atk * 0.55, 6);   // 重度内伤压攻击 45%
    expect(hurt.def).toBeCloseTo(base.def, 6);
    expect(hurt.sqNeed).toBe(base.sqNeed);
  });

  it('归隐清零伤势与折寿（FRESH 展开重置）', () => {
    useGameStore.setState({
      injuries: { ...freshInjuries(), wai: { severity: 3, healAccMin: 0 } },
      lifespanLost: 15,
    });
    expect(isHurt(useGameStore.getState().injuries!)).toBe(true);
    useGameStore.getState().hardReset();
    const after = useGameStore.getState();
    expect(isHurt(after.injuries ?? freshInjuries())).toBe(false);
    expect(after.lifespanLost ?? 0).toBe(0);
  });
});

describe('gameStore · 冲穴耗内力制（design.md v4.0）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  /**
   * 把角色放到境界 2、周天缴满 N 段、丹田封顶的状态。
   * 消耗取 effBreakCost（= 下一境界行），与 store 内部同源——REALMS 行口径不一致是既有问题。
   */
  function atRealm2(chargeHighWater = 3) {
    useGameStore.setState({ started: true, realm: 2, acupointProgress: {}, chargeHighWater });
    const cost = effBreakCost(useGameStore.getState())!;
    useGameStore.setState({ dantian: cost });
    return cost;
  }

  it('真气未行至该穴时冲不动，内力分文不扣', () => {
    const cost = atRealm2(0);
    useGameStore.getState().attemptAcupoint('quchi');
    expect(useGameStore.getState().acupointProgress).toEqual({});
    expect(useGameStore.getState().dantian).toBe(cost);
  });

  it('同一条脉须按次序冲：前穴未通时后穴冲不动', () => {
    const cost = atRealm2();
    useGameStore.getState().attemptAcupoint('hegu');   // 曲池尚未通
    expect(useGameStore.getState().acupointProgress).toEqual({});
    expect(useGameStore.getState().dantian).toBe(cost);
  });

  it('冲穴成败同扣真气——失败也扣，这就是惩罚', () => {
    const cost = atRealm2();
    const N = REALMS[1].zhoutianCount!;
    const before = useGameStore.getState().dantian;
    // roll=0.99 > 曲池 90% → 必失败
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    useGameStore.getState().attemptAcupoint('quchi');
    vi.mocked(Math.random).mockRestore();

    const after = useGameStore.getState();
    expect(after.acupointProgress!.quchi).toEqual({ failCount: 1, opened: false });
    const expected = (cost / N) * 0.11;    // 当前段配额 × 11%
    expect(before - after.dantian).toBeCloseTo(expected, 6);
  });

  it('末段圆满、丹田封顶时仍冲得动——v4.0 要消灭的死锁不再复现', () => {
    // 旧实现把「已缴 N 段」直接拿去减，当前段真气恒为 0，最后一个窍穴永远冲不动。
    const cost = atRealm2();
    const N = REALMS[1].zhoutianCount!;
    const per = (cost / N) * 0.11;

    vi.spyOn(Math, 'random').mockReturnValue(0.99);   // 第一次必失败（曲池 90%）
    useGameStore.getState().attemptAcupoint('quchi');
    expect(useGameStore.getState().acupointProgress!.quchi.opened).toBe(false);
    expect(useGameStore.getState().dantian).toBeCloseTo(cost - per, 6);

    // 扣款使液面回落，但真气仍够再冲一次——持续性正是无死锁的含义
    useGameStore.getState().attemptAcupoint('quchi');
    vi.mocked(Math.random).mockRestore();
    expect(useGameStore.getState().acupointProgress!.quchi.opened).toBe(true);   // 失败累进到 100%
    expect(useGameStore.getState().dantian).toBeCloseTo(cost - per * 2, 6);      // 两次都扣了
  });

  it('突破须贯通首条经脉：通了另一条脉不顶用', () => {
    atRealm2();
    const other = REALM_ACUPOINTS[2].meridians[1].acupointIds;
    useGameStore.setState({
      acupointProgress: Object.fromEntries(other.map(id => [id, { failCount: 0, opened: true }])),
    });
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(2);    // 没突破

    // 补通首条脉 → 可突破
    const req = REALM_ACUPOINTS[2].meridians[0].acupointIds;
    useGameStore.setState({
      acupointProgress: {
        ...useGameStore.getState().acupointProgress,
        ...Object.fromEntries(req.map(id => [id, { failCount: 0, opened: true }])),
      },
    });
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(3);
  });
});

describe('gameStore · 转世（reincarnation/spec.md v1.1）', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  const st = () => useGameStore.getState();
  const heavyAll = () => ({
    wai: { severity: 3 as const, healAccMin: 0 },
    nei: { severity: 3 as const, healAccMin: 0 },
    du: { severity: 3 as const, healAccMin: 0 },
  });

  it('新档：18 岁、江湖历 100 年、魂魄安稳', () => {
    expect(st().age).toBe(INIT_AGE);
    expect(st().eraStart).toBe(ERA_START);
    expect(st().soulUnsettled).toBe(false);
  });

  it('年岁随活跃时长增长：一分钟老 0.718 岁', () => {
    const t0 = Date.now();
    st().tick(t0 + 60_000);
    expect(st().age).toBeCloseTo(INIT_AGE + AGE_YEARS_PER_MIN, 6);
  });

  it('观察员暂停期间不变老（与挂机产出同一冻结口径）', () => {
    useGameStore.setState({ paused: true });
    st().tick(Date.now() + 60_000);
    expect(st().age).toBe(INIT_AGE);
  });

  it('寿元将尽时再挂一会儿 → 老死：强制转世，声望全额，来世魂魄未稳', () => {
    useGameStore.setState({ age: LIFESPAN_CAP - 0.01, reputation: 7 });
    st().tick(Date.now() + 60_000);
    const s = st();
    expect(s.run).toBe(2);
    expect(s.age).toBe(INIT_AGE);
    expect(s.soulUnsettled).toBe(true);
    expect(s.retireCeremony?.cause).toBe('old');
    expect(s.retireCeremony?.deathAge).toBe(LIFESPAN_CAP);
    // 江湖历从谢幕年份接着算：出生 100 年，活到约 120 岁 → 下一世生于约 202 年
    expect(s.eraStart).toBeGreaterThan(ERA_START + (LIFESPAN_CAP - INIT_AGE) - 0.1);
    const ev = getEvents().find((e) => e.e === 'forced_reincarnation')!;
    expect(ev.cause).toBe('old');
    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(false);
  });

  it('重伤折寿压低寿元：折了 15 年，105 岁即老死', () => {
    useGameStore.setState({ age: 105.5, lifespanLost: 15 });
    st().tick(Date.now() + 1_000);
    expect(st().retireCeremony?.cause).toBe('old');
  });

  it('魂魄未稳：挂机产出 ×0.6，与伤势压制同一乘法链', () => {
    const base = effIdleRate(st());
    useGameStore.setState({ soulUnsettled: true });
    expect(effIdleRate(st())).toBeCloseTo(base * SOUL_WEAK_MULT, 10);
  });

  it('魂魄未稳在首次突破时解除', () => {
    const cost = effBreakCost(st())!;
    useGameStore.setState({ soulUnsettled: true, dantian: cost });
    st().breakthrough();
    expect(st().realm).toBe(2);
    expect(st().soulUnsettled).toBe(false);
  });

  it('主动归隐：年岁重置、江湖历接续、魂魄安稳，走 retire_confirmed 而非强制转世', () => {
    useGameStore.setState({
      realm: 5, clearedStages: ['m3s10'], age: 60, eraStart: 130,
      soulUnsettled: false, retireStep: 'confirm',
    });
    st().confirmRetire();
    const s = st();
    expect(s.run).toBe(2);
    expect(s.age).toBe(INIT_AGE);
    expect(s.eraStart).toBeCloseTo(130 + (60 - INIT_AGE), 6);
    expect(s.soulUnsettled).toBe(false);
    expect(s.retireCeremony?.cause).toBeNull();
    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(true);
    expect(getEvents().some((e) => e.e === 'forced_reincarnation')).toBe(false);
  });

  it('战死：三处重伤时再败于 Boss → 越过致死线，强制转世', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    useGameStore.setState({
      realm: 1, route: null,
      clearedStages: ['m1s1', 'm1s2', 'm1s3', 'm1s4', 'm1s5', 'm1s6', 'm1s7'],
      injuries: heavyAll(), lifespanLost: 45,
    });
    st().challengeStage(1, 8);    // 境界 1 白身挑战 Boss 1，带三处重伤，必败
    for (let i = 0; i < 400; i++) {
      const b = st().battle;
      if (!b || b.resolved) break;
      vi.setSystemTime(Date.now() + 1_000);
      st().tick(Date.now());
    }
    vi.useRealTimers();
    const s = st();
    expect(s.retireCeremony?.cause).toBe('battle');
    expect(s.run).toBe(2);
    expect(s.soulUnsettled).toBe(true);
    // 伤势与折寿随转世清零
    expect(isHurt(s.injuries ?? freshInjuries())).toBe(false);
    expect(s.lifespanLost).toBe(0);
    expect(s.battle).toBeNull();
  });

  it('离线同样变老；闭关期间寿终 → 回来直接进转世演出，出关结算屏不再出现', () => {
    // 构造一份 119 岁、下线 30 分钟的存档
    saveGame({ ...st(), age: 119, run: 1 });
    backdateSavedAt(30 * 60);
    useGameStore.setState({ started: false });
    st().init();
    const s = st();
    expect(s.retireCeremony?.cause).toBe('old');
    expect(s.retireCeremony?.deathAge).toBe(LIFESPAN_CAP);   // 按寿元封顶，不显示越界年岁
    expect(s.offlineSettlement).toBeNull();
    expect(s.run).toBe(2);
  });

  it('存档不丢字段：FRESH 里的每个字段都能原样存取（修复前窍穴进度 / 图鉴 / 伤势 / 折寿刷新即丢）', () => {
    const [acu] = REALM_ACUPOINTS[2].acupoints;
    useGameStore.setState({
      acupointProgress: { [acu.id]: { failCount: 2, opened: true } },
      acupointLog: [acu.id],
      injuries: { ...freshInjuries(), nei: { severity: 2, healAccMin: 1.5 } },
      lifespanLost: 15, age: 44.4, eraStart: 187, soulUnsettled: true,
    });
    st().pauseSession();   // 任一会持久化的动作都行，这里借暂停触发一次写盘
    const saved = loadGame() as Record<string, unknown>;
    expect(saved.acupointProgress).toEqual({ [acu.id]: { failCount: 2, opened: true } });
    expect(saved.acupointLog).toEqual([acu.id]);
    expect((saved.injuries as { nei: { severity: number } }).nei.severity).toBe(2);
    expect(saved.lifespanLost).toBe(15);
    expect(saved.age).toBe(44.4);
    expect(saved.eraStart).toBe(187);
    expect(saved.soulUnsettled).toBe(true);
  });
});
