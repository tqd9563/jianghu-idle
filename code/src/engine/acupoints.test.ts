/**
 * 窍穴/经脉/冲穴/气势纯函数测试 —— 权威来源：docs/systems/zhoutian/design.md
 */
import { describe, expect, it } from 'vitest';
import {
  REALM_ACUPOINTS, currentSuccessRate, attemptAcupoint,
  breakthroughReady, totalAcupointBonus, acupointBonus, meridianBonus,
  isMeridianComplete, consumeQishi, qishiToBonus,
  BASE_P, FAIL_BONUS_PP, QISHI_CAP_PP,
  type AcupointState,
} from './acupoints';

describe('冲穴成功率（spec §4：p=85% + 失败×10pp + 第3次必成）', () => {
  it('基础 p=85%', () => {
    const a: AcupointState = { failCount: 0, opened: false };
    expect(currentSuccessRate(a, 0)).toBe(BASE_P);
  });
  it('失败 1 次 +10pp', () => {
    const a: AcupointState = { failCount: 1, opened: false };
    expect(currentSuccessRate(a, 0)).toBe(BASE_P + FAIL_BONUS_PP);
  });
  it('第 3 次必成（failCount=2）', () => {
    const a: AcupointState = { failCount: 2, opened: false };
    expect(currentSuccessRate(a, 0)).toBe(1.0);
  });
  it('气势加成叠加', () => {
    const a: AcupointState = { failCount: 0, opened: false };
    expect(currentSuccessRate(a, 0.15)).toBe(BASE_P + 0.15);
  });
});

describe('冲穴尝试（spec §5.2）', () => {
  it('roll < p → 成功', () => {
    const a: AcupointState = { failCount: 0, opened: false };
    const r = attemptAcupoint(a, 0, 0.5);  // p=0.85, roll=0.5 < 0.85
    expect(r.success).toBe(true);
    expect(r.opened).toBe(true);
    expect(r.newFailCount).toBe(0);
  });
  it('roll ≥ p → 失败，failCount+1', () => {
    const a: AcupointState = { failCount: 0, opened: false };
    const r = attemptAcupoint(a, 0, 0.9);  // p=0.85, roll=0.9 ≥ 0.85
    expect(r.success).toBe(false);
    expect(r.opened).toBe(false);
    expect(r.newFailCount).toBe(1);
  });
  it('必成兜底：failCount=2 时 roll 任意都成功', () => {
    const a: AcupointState = { failCount: 2, opened: false };
    const r = attemptAcupoint(a, 0, 0.99);  // p=1.0
    expect(r.success).toBe(true);
    expect(r.opened).toBe(true);
  });
});

describe('突破双条件（spec §6）', () => {
  it('丹田满 + 窍穴齐 → ready', () => {
    expect(breakthroughReady(10000, 10000, 3, 3)).toBe(true);
  });
  it('丹田满 + 窍穴未齐 → not ready', () => {
    expect(breakthroughReady(10000, 10000, 2, 3)).toBe(false);
  });
  it('丹田未满 + 窍穴齐 → not ready', () => {
    expect(breakthroughReady(5000, 10000, 3, 3)).toBe(false);
  });
});

describe('加成计算（spec §6.3/§9）', () => {
  it('境界 2-4 单穴 +2%', () => {
    expect(acupointBonus(2)).toBe(0.02);
    expect(acupointBonus(3)).toBe(0.02);
    expect(acupointBonus(4)).toBe(0.02);
  });
  it('境界 5 单穴 +1.5%（预算比修订）', () => {
    expect(acupointBonus(5)).toBe(0.015);
  });
  it('贯通 = 单穴 × 1.5', () => {
    expect(meridianBonus(2)).toBe(0.03);
    expect(meridianBonus(5)).toBe(0.0225);
  });
  it('总加成 = 窍穴 + 贯通（加法合并）', () => {
    expect(totalAcupointBonus(4, 3, 1)).toBe(0.09);  // 3×2% + 1×3% = 9%
  });
});

describe('气势消耗与加成（spec §5）', () => {
  it('消耗 70%：100 → 30', () => {
    expect(consumeQishi(100)).toBeCloseTo(30, 6);
  });
  it('气势加成：满档 100 → +15pp', () => {
    expect(qishiToBonus(100)).toBe(QISHI_CAP_PP);
  });
  it('气势加成：50 → +7.5pp（线性）', () => {
    expect(qishiToBonus(50)).toBe(0.075);
  });
  it('气势加成封顶：200 → +15pp', () => {
    expect(qishiToBonus(200)).toBe(QISHI_CAP_PP);
  });
});

describe('经脉贯通检查（spec §4.4）', () => {
  it('所有窍穴已通 → 贯通', () => {
    const m = { id: 'test', name: 'test', acupointIds: ['a', 'b'] };
    expect(isMeridianComplete(m, new Set(['a', 'b']))).toBe(true);
  });
  it('有窍穴未通 → 未贯通', () => {
    const m = { id: 'test', name: 'test', acupointIds: ['a', 'b'] };
    expect(isMeridianComplete(m, new Set(['a']))).toBe(false);
  });
});

describe('窍穴池数据完整性（spec §3）', () => {
  it('境界 2: 池 4, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[2];
    expect(d.acupoints).toHaveLength(4);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 3: 池 5, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[3];
    expect(d.acupoints).toHaveLength(5);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 4: 池 6, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[4];
    expect(d.acupoints).toHaveLength(6);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 5: 池 8, 经脉 3 条', () => {
    const d = REALM_ACUPOINTS[5];
    expect(d.acupoints).toHaveLength(8);
    expect(d.meridians).toHaveLength(3);
  });
  it('境界 1/6/7 不接入本版', () => {
    expect(REALM_ACUPOINTS[1]).toBeUndefined();
    expect(REALM_ACUPOINTS[6]).toBeUndefined();
    expect(REALM_ACUPOINTS[7]).toBeUndefined();
  });
});
