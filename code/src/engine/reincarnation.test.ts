/**
 * 转世引擎测试 —— 权威来源：docs/systems/reincarnation/spec.md v1.5
 */
import { describe, expect, it } from 'vitest';
import {
  INIT_AGE, LIFESPAN, LIFE_DAYS, ERA_START, SOUL_WEAK_MULT, SOUL_WEAK_YEARS, DUSK_MARGIN,
  lifespanCap, ageAfter, ageYearsPerDay, minutesUntilAge, isOldDeath, isDusk, outlivesADay,
  currentEra, nextLife, soulMult, soulSettles,
} from './reincarnation';
import { LIFESPAN_LOSS_HEAVY } from './injury';

describe('常量与规格对表（spec §2.2 / §3.1 / §4.1）', () => {
  it('初始 18 岁、江湖历起于 100 年；寿元随境界 70 → 150', () => {
    expect(INIT_AGE).toBe(18);
    expect(ERA_START).toBe(100);
    expect([1, 2, 3, 4, 5, 6].map((r) => LIFESPAN[r])).toEqual([70, 70, 90, 110, 130, 150]);
  });
  it('年岁速率 = (寿元 − 18) ÷ (一世天数 + 4 小时)，对上 pacing_sim 表三', () => {
    expect(ageYearsPerDay(2)).toBeCloseTo(44.6, 1);
    expect(ageYearsPerDay(3)).toBeCloseTo(33.2, 1);
    expect(ageYearsPerDay(4)).toBeCloseTo(29.1, 1);
    expect(ageYearsPerDay(5)).toBeCloseTo(21.7, 1);
    expect(ageYearsPerDay(6)).toBe(ageYearsPerDay(5));   // 境界 6 沿用境界 5
  });
  it('阶段 P 的一世：第 L 天上线时还活着，再过一个在线时段寿终', () => {
    for (const p of [2, 3, 4, 5]) {
      const atLogin = ageAfter(INIT_AGE, LIFE_DAYS[p] * 1440, p);
      expect(isOldDeath(atLogin, p, 0)).toBe(false);
      expect(isOldDeath(ageAfter(atLogin, 4 * 60, p), p, 0)).toBe(true);
    }
  });
  it('魂魄未稳 ×0.6、前 10 年', () => {
    expect(SOUL_WEAK_MULT).toBe(0.6);
    expect(SOUL_WEAK_YEARS).toBe(10);
    expect(soulSettles(27.9)).toBe(false);
    expect(soulSettles(28)).toBe(true);
  });
  it('垂暮阈值与重伤折寿量绑定，不另设常量', () => {
    expect(DUSK_MARGIN).toBe(LIFESPAN_LOSS_HEAVY);
  });
});

describe('寿元与寿终（spec §3）', () => {
  it('境界 1 七十岁寿终，境界 3 九十岁', () => {
    expect(isOldDeath(69.9, 1, 0)).toBe(false);
    expect(isOldDeath(70, 1, 0)).toBe(true);
    expect(isOldDeath(85, 3, 0)).toBe(false);
  });
  it('重伤折寿直接压低本世寿元', () => {
    expect(lifespanCap(3, 15)).toBe(75);
    expect(isOldDeath(76, 3, 15)).toBe(true);
  });
  it('离线寿终：从 69 岁活到 70 岁要多少分钟', () => {
    expect(minutesUntilAge(69, 70, 1)).toBeCloseTo(1440 / ageYearsPerDay(1), 6);
    expect(minutesUntilAge(71, 70, 1)).toBe(0);
  });
  it('寿元提示：剩余寿元够再活一天才提示（retire.md §3）', () => {
    expect(outlivesADay(INIT_AGE, 2, 0, 2)).toBe(true);
    expect(outlivesADay(LIFESPAN[2] - 10, 2, 0, 2)).toBe(false);
  });
});

describe('垂暮（原型 §1-B）', () => {
  it('离寿元不足一次重伤时进入垂暮', () => {
    expect(isDusk(54.9, 1, 0)).toBe(false);
    expect(isDusk(55, 1, 0)).toBe(true);
  });
  it('已死不算垂暮', () => {
    expect(isDusk(70, 1, 0)).toBe(false);
  });
  it('折寿后垂暮线随之前移', () => {
    expect(isDusk(60, 3, 15)).toBe(true);    // 寿元 75，垂暮自 60 起
  });
});

describe('江湖历（spec §2.1 / §6）', () => {
  it('江湖历 = 本世出生年 + 已活年数', () => {
    expect(currentEra(ERA_START, INIT_AGE)).toBe(100);
    expect(currentEra(ERA_START, 78.5)).toBeCloseTo(160.5, 6);
  });
  it('转世：年岁重置，江湖历从谢幕年份接着算，永不回退', () => {
    const next = nextLife(160, 64.5);
    expect(next.age).toBe(INIT_AGE);
    expect(next.eraStart).toBeCloseTo(206.5, 6);
    expect(next.eraStart).toBeGreaterThan(160);
  });
});

describe('魂魄未稳（spec §4.1）', () => {
  it('未稳 ×0.6、安稳 ×1', () => {
    expect(soulMult(true)).toBe(0.6);
    expect(soulMult(false)).toBe(1);
  });
});
