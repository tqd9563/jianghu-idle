/**
 * store 行为测试：单钱包丹田模型 + 埋点事件发射（对齐规格书 §6.1 v0.9 / 埋点规格 §1.2）
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { skillUpgradeCost } from '../engine/content';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import { effBreakCost, retireKind, useGameStore } from './gameStore';

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

  it('归隐执行：三事件链、声望入账（130）、状态重置、节点继承生效', () => {
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
    expect(s.reputation).toBe(130);
    expect(s.clearedStages).toEqual([]);
    expect(s.retireCeremony!.settle.total).toBe(130);
    const ns = names();
    expect(ns).toContain('retire_preview_opened');
    expect(ns).toContain('retire_confirmed');
    const runStart = getEvents().find((e) => e.e === 'run_start' && e.run === 2)!;
    expect(runStart.carry_xp).toBe(40);
    expect(runStart.owned_nodes).toEqual(['wudao_biji']);
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
    expect(start.telemetry_spec).toBe(1);

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
});
