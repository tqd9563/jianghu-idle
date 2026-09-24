/**
 * 转世引擎测试 —— 权威来源：docs/systems/reincarnation/spec.md v1.1
 */
import { describe, expect, it } from 'vitest';
import {
  INIT_AGE, LIFESPAN_CAP, AGE_YEARS_PER_MIN, ERA_START, SOUL_WEAK_MULT, DUSK_MARGIN,
  lifespanCap, ageAfter, isOldDeath, isDusk, currentEra, nextLife, soulMult,
} from './reincarnation';
import { LIFESPAN_LOSS_HEAVY } from './injury';

describe('常量与规格对表（spec §2.2 / §3.1 / §4.1）', () => {
  it('初始 18 岁、寿元 120、江湖历起于 100 年', () => {
    expect(INIT_AGE).toBe(18);
    expect(LIFESPAN_CAP).toBe(120);
    expect(ERA_START).toBe(100);
  });
  it('年岁速率 1.322 年/分：典型一世 34 分钟活 45 年', () => {
    expect(AGE_YEARS_PER_MIN).toBe(1.322);
    expect(ageAfter(INIT_AGE, 34) - INIT_AGE).toBeCloseTo(44.9, 1);
  });
  it('魂魄未稳 ×0.6', () => {
    expect(SOUL_WEAK_MULT).toBe(0.6);
  });
  it('垂暮阈值与重伤折寿量绑定，不另设常量', () => {
    expect(DUSK_MARGIN).toBe(LIFESPAN_LOSS_HEAVY);
  });
});

describe('寿元与老死（spec §3）', () => {
  it('未折寿时 120 岁即老死，119.9 岁未死', () => {
    expect(isOldDeath(119.9, 0)).toBe(false);
    expect(isOldDeath(120, 0)).toBe(true);
  });
  it('重伤折寿直接压低本世寿元', () => {
    expect(lifespanCap(15)).toBe(105);
    expect(isOldDeath(106, 15)).toBe(true);
  });
});

describe('垂暮（原型 §1-B）', () => {
  it('离寿元不足一次重伤时进入垂暮', () => {
    expect(isDusk(104.9, 0)).toBe(false);
    expect(isDusk(105, 0)).toBe(true);
    expect(isDusk(119, 0)).toBe(true);
  });
  it('已死不算垂暮', () => {
    expect(isDusk(120, 0)).toBe(false);
  });
  it('折寿后垂暮线随之前移', () => {
    expect(isDusk(90, 15)).toBe(true);    // 寿元 105，垂暮自 90 起
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
