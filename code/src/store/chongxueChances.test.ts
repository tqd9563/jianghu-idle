/**
 * 冲穴机会与周天存档回归 —— 权威来源：docs/systems/zhoutian/design.md §3（数值）
 * + spec.md §5.1（每次周天圆满发 1 次冲穴机会）
 *
 * 复现的线上故障：丹田 5,000/5,000「三周天圆满」却提示「冲穴机会不足」。
 * 两个成因：(1) persist 映射漏了周天字段，重载即散功；
 *          (2) 机会是累加计数器，chargeHighWater 已达标的状态永不再发放。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chongxueChancesLeft, chongxueUsed, REALM_ACUPOINTS } from '../engine/acupoints';
import { REALMS } from '../engine/content';
import { effChongxueChances, useGameStore } from './gameStore';
import { loadGame, resetGame } from '../save/storage';

const N2 = REALMS[1].zhoutianCount!;          // 境界 2 = 3 段
const R2 = REALM_ACUPOINTS[2].acupoints;

describe('冲穴机会：由高水位推导（spec §5.1）', () => {
  it('每圆满一个周天得 1 次机会，未冲穴时全额保留', () => {
    expect(chongxueChancesLeft(2, 0, N2, {})).toBe(0);
    expect(chongxueChancesLeft(2, 2, N2, {})).toBe(2);
    expect(chongxueChancesLeft(2, N2, N2, {})).toBe(N2);
  });

  it('已用次数由窍穴进度精确反推：失败记 failCount，成功记 opened（failCount 不清零）', () => {
    const progress = {
      [R2[0].id]: { failCount: 2, opened: true },    // 两败一成 = 3 次
      [R2[1].id]: { failCount: 1, opened: false },   // 一败 = 1 次
    };
    expect(chongxueUsed(2, progress)).toBe(4);
    expect(chongxueChancesLeft(2, N2, N2, progress)).toBe(0);
  });

  it('旧档的 chargeHighWater 可能大于当前境界段数（旧版 5 段制），按 N 封顶不超发', () => {
    expect(chongxueChancesLeft(2, 5, N2, {})).toBe(N2);
  });

  it('回归：丹田已满且 chargeHighWater 已达标时，机会不再为 0（原累加计数器的漏发）', () => {
    // 这正是线上故障态：高水位已 3，若靠事件累加则永远不会再发放
    expect(chongxueChancesLeft(2, N2, N2, {})).toBeGreaterThan(0);
  });

  it('境界 1 无窍穴系统，恒为 0', () => {
    expect(chongxueChancesLeft(1, 3, REALMS[0].zhoutianCount, {})).toBe(0);
  });
});

describe('周天状态必须落盘（存档 v2）', () => {
  beforeEach(() => { resetGame(); });

  it('窍穴进度与气势在存档往返后保留，冲穴机会随之复原', () => {
    useGameStore.setState({
      started: true, realm: 2, dantian: 5000, chargeHighWater: N2,
      qishi: 62, acupointProgress: { [R2[0].id]: { failCount: 1, opened: true } },
      ownedRepNodes: [], paused: false,
    });
    // 任一会持久化的动作都应把周天字段一并写盘
    useGameStore.getState().tick(Date.now() + 60_000);

    const saved = loadGame<{
      acupointProgress: Record<string, { failCount: number; opened: boolean }>;
      qishi: number; chargeHighWater: number;
    }>();
    expect(saved).not.toBeNull();
    expect(saved!.acupointProgress[R2[0].id]).toEqual({ failCount: 1, opened: true });
    expect(saved!.qishi).toBeGreaterThan(0);
    expect(saved!.chargeHighWater).toBe(N2);

    // 重载后：3 段已圆满、已用 2 次（1 败 + 1 成）→ 尚余 1 次
    expect(effChongxueChances({
      realm: 2, chargeHighWater: saved!.chargeHighWater, acupointProgress: saved!.acupointProgress,
    })).toBe(N2 - 2);
  });

  it('正常成长路径：境界 2 涨满丹田后共得 3 次机会', () => {
    useGameStore.setState({
      started: true, realm: 2, dantian: 0, chargeHighWater: 0,
      qishi: 0, acupointProgress: {}, ownedRepNodes: [], paused: false, runPlaySec: 0,
    });
    // lastTick 是模块级变量，上一用例可能已把它推到未来；从更晚的起点开跑避免 dt 被钳成 0
    let t = Date.now() + 600_000;
    for (let i = 0; i < 500; i++) { t += 1000; useGameStore.getState().tick(t); }
    const s = useGameStore.getState();
    expect(s.chargeHighWater).toBe(N2);
    expect(effChongxueChances(s)).toBe(N2);
  });
});
