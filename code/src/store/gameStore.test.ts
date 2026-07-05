/**
 * store 行为测试：单钱包丹田模型 + 埋点事件发射（对齐规格书 §6.1 v0.9 / 埋点规格 §1.2）
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { skillUpgradeCost } from '../engine/content';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import { useGameStore } from './gameStore';

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
