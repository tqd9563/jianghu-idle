/**
 * golden 对照种子 —— 用例取自公式表 §2/§3 与内容表既有数值，
 * 后续战斗/经济模块的完整 golden 用例由 sim/mvp0_sim.py 导出固定 fixture。
 */
import { describe, expect, it } from 'vitest';
import { hitChance, idleNeiliPerSec, mitigationMultiplier, zhoutianProgress } from './formulas';
import { REALMS, skillUpgradeCost } from './content';

describe('双曲防御（公式表 §2）', () => {
  it('DEF 17.8（铁臂僧）→ 减免系数 ≈ 0.849', () => {
    expect(mitigationMultiplier(17.8)).toBeCloseTo(100 / 117.8, 6);
  });
  it('DEF 0 → 不减免', () => {
    expect(mitigationMultiplier(0)).toBe(1);
  });
});

describe('命中率（公式表 §2）', () => {
  it('命中 124 vs 闪避 50（游侠儿）≈ 71.3%', () => {
    expect(hitChance(124, 50)).toBeCloseTo(124 / 174, 6);
  });
  it('下限 30%：命中 100 vs 闪避 900 → 0.30', () => {
    expect(hitChance(100, 900)).toBe(0.3);
  });
});

describe('挂机产出（公式表 §3.2）', () => {
  it('境界 1–5 依次为 9.0 / 11.3 / 14.1 / 17.6 / 22.0（内容表口径，1 位小数）', () => {
    expect([1, 2, 3, 4, 5].map((r) => Number(idleNeiliPerSec(r).toFixed(1)))).toEqual([
      9.0, 11.3, 14.1, 17.6, 22.0,
    ]);
  });
});

describe('境界表（内容表 §1）', () => {
  it('突破消耗 2,800 / 5,000 / 10,000 / 21,000', () => {
    expect(REALMS.slice(1).map((r) => r.breakthroughCost)).toEqual([2800, 5000, 10000, 21000]);
  });
  it('武学上限 = 境界 × 2', () => {
    for (const r of REALMS) expect(r.skillCap).toBe(r.realm * 2);
  });
});

describe('武学消耗 200 × 1.4^(n−1)（内容表 §3.1）', () => {
  it('Lv1 = 200，Lv6 = 1,076', () => {
    expect(skillUpgradeCost(1)).toBe(200);
    expect(skillUpgradeCost(6)).toBe(1076);
  });
});

describe('周天派生显示（规格书 §6.1 v0.9 单钱包模型）', () => {
  it('丹田 6,900 / 消耗 10,000 → 3 段圆满 + 第四周天 45%', () => {
    const p = zhoutianProgress(6900, 10000);
    expect(p.segmentsFull).toBe(3);
    expect(p.currentSegmentPct).toBeCloseTo(0.45, 6);
    expect(p.ready).toBe(false);
  });
  it('丹田 ≥ 全额 → 可突破', () => {
    expect(zhoutianProgress(21000, 21000).ready).toBe(true);
  });
});
