/**
 * golden 对照种子 —— 用例取自公式表 §2/§3 与内容表既有数值，
 * 后续战斗/经济模块的完整 golden 用例由 sim/mvp0_sim.py 导出固定 fixture。
 */
import { describe, expect, it } from 'vitest';
import { hitChance, idleNeiliPerSec, mitigationMultiplier, zhoutianProgress, currentSegmentNeili } from './formulas';
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

describe('境界表（内容表 §1 MVP-0 r1-r5）', () => {
  it('突破消耗 2,800 / 5,000 / 10,000 / 21,000', () => {
    expect(REALMS.slice(1, 5).map((r) => r.breakthroughCost)).toEqual([2800, 5000, 10000, 21000]);
  });
  it('武学上限 = 境界 × 2（MVP-0 §1 r1-r5；MVP-2 §8.1 r6/r7 固定 10 不开放 lv11）', () => {
    for (const r of REALMS.slice(0, 5)) expect(r.skillCap).toBe(r.realm * 2);
    // MVP-2 §8.1：r6/r7 skillCap=10，不开放 lv11
    expect(REALMS[5]?.skillCap).toBe(10);
    expect(REALMS[6]?.skillCap).toBe(10);
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

describe('周天 N 段推广（spec §2：境界 2-5 = 3/4/6/8）', () => {
  it('境界 4 N=6：丹田 2,000 / 消耗 10,000 → 1 段圆满 + 20%', () => {
    const p = zhoutianProgress(2000, 10000, 6);
    expect(p.segmentsFull).toBe(1);
    expect(p.currentSegmentPct).toBeCloseTo(0.2, 6);
  });
  it('境界 5 N=8：丹田 2,625 / 消耗 21,000 → 1 段圆满', () => {
    const p = zhoutianProgress(2625, 21000, 8);
    expect(p.segmentsFull).toBe(1);
  });
  it('MVP-0 fallback：不传 N 默认 5 段（维持 golden）', () => {
    const p = zhoutianProgress(6900, 10000);
    expect(p.segmentsFull).toBe(3);
  });
});

describe('当前段已蓄真气（design.md §2：冲穴与升武学都从当前段扣款）', () => {
  it('未缴任何段时 = 丹田全额', () => {
    expect(currentSegmentNeili(400, 3000, 3, 0)).toBe(400);
  });
  it('已缴 1 段时扣掉那一段的配额', () => {
    expect(currentSegmentNeili(1400, 3000, 3, 1)).toBe(400);
  });
  it('冲穴扣款使液面跌回已缴线以下 → 当前段归零，已沉入根基的部分不退回', () => {
    // 已缴 2 段（2000），但丹田被扣到 1800
    expect(currentSegmentNeili(1800, 3000, 3, 2)).toBe(0);
  });
  it('丹田超过全额时按全额截断', () => {
    expect(currentSegmentNeili(9999, 3000, 3, 2)).toBe(1000);
  });
  it('末段圆满后当前段读作「第 N 段已蓄满」，而非归零——否则末穴永远冲不动', () => {
    // 已缴满 3 段、丹田封顶：当前段真气 = 一段配额，足以支付冲穴
    expect(currentSegmentNeili(3000, 3000, 3, 3)).toBe(1000);
    // 冲穴扣款后液面回落，当前段随之减少，蓄回来又能再冲（design.md §3.4 W1 无死锁）
    expect(currentSegmentNeili(2850, 3000, 3, 3)).toBe(850);
  });
});
