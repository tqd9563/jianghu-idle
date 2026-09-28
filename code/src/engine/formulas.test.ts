/**
 * golden 对照种子 —— 用例取自公式表 §2/§3 与内容表既有数值，
 * 后续战斗/经济模块的完整 golden 用例由 sim/mvp0_sim.py 导出固定 fixture。
 */
import { describe, expect, it } from 'vitest';
import {
  hitChance, idleNeiliPerSec, mitigationMultiplier, zhoutianProgress, currentSegmentNeili,
  currentSegmentQuota, paidThrough, segmentQuotas,
} from './formulas';
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

describe('境界表（content.md §1 v2.2「离开本境界」行口径）', () => {
  it('离开境界 1–5 的总额：34.9 万 / 270 万 / 693 万 / 1790 万 / 3700 万（pacing_sim 表一）', () => {
    expect(REALMS.slice(0, 5).map((r) => r.leaveCost)).toEqual([349_000, 2_700_000, 6_930_000, 17_900_000, 37_000_000]);
  });
  it('周天段数 N 与总额同一行：4 / 3 / 4 / 6 / 8；境界 6/7 不可再突破', () => {
    expect(REALMS.slice(0, 5).map((r) => r.zhoutianCount)).toEqual([4, 3, 4, 6, 8]);
    expect(REALMS[5].leaveCost).toBeNull();
    expect(REALMS[6].leaveCost).toBeNull();
  });
  it('武学上限 = 境界 × 2（MVP-0 §1 r1-r5；MVP-2 §8.1 r6/r7 固定 10 不开放 lv11）', () => {
    for (const r of REALMS.slice(0, 5)) expect(r.skillCap).toBe(r.realm * 2);
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

describe('周天段间公比 2（zhoutian/design.md §3.1）', () => {
  it('7,000 分 3 段 → 1,000 / 2,000 / 4,000，合计等于总额', () => {
    expect(segmentQuotas(7000, 3)).toEqual([1000, 2000, 4000]);
    expect(paidThrough(7000, 3, 2)).toBe(3000);
    expect(paidThrough(7000, 3, 3)).toBe(7000);
  });
  it('境界 1 首段 / 末段配额与设计表一致（23,267 / 186,133）', () => {
    const q = segmentQuotas(349_000, 4);
    expect(Math.round(q[0])).toBe(23_267);
    expect(Math.round(q[3])).toBe(186_133);
  });
  it('当前段配额：未缴读首段，末段圆满后仍读第 N 段', () => {
    expect(currentSegmentQuota(7000, 3, 0)).toBe(1000);
    expect(currentSegmentQuota(7000, 3, 3)).toBe(4000);
  });
});

describe('周天派生显示', () => {
  it('丹田 2,000 / 总额 7,000（3 段）→ 1 段圆满 + 第二周天 50%', () => {
    const p = zhoutianProgress(2000, 7000, 3);
    expect(p.segmentsFull).toBe(1);
    expect(p.currentSegmentPct).toBeCloseTo(0.5, 6);
    expect(p.ready).toBe(false);
  });
  it('丹田 ≥ 全额 → 全部圆满、可突破', () => {
    const p = zhoutianProgress(7000, 7000, 3);
    expect(p.segmentsFull).toBe(3);
    expect(p.ready).toBe(true);
  });
  it('6 段：丹田恰好缴满前两段 → 2 段圆满、第三段 0%', () => {
    const p = zhoutianProgress(3000, 63000, 6);
    expect(p.segmentsFull).toBe(2);
    expect(p.currentSegmentPct).toBeCloseTo(0, 6);
  });
});

describe('当前段已蓄真气（design.md §2：冲穴与升武学都从当前段扣款）', () => {
  it('未缴任何段时 = 丹田全额', () => {
    expect(currentSegmentNeili(400, 7000, 3, 0)).toBe(400);
  });
  it('已缴 1 段时扣掉那一段的配额', () => {
    expect(currentSegmentNeili(1400, 7000, 3, 1)).toBe(400);
  });
  it('冲穴扣款使液面跌回已缴线以下 → 当前段归零，已沉入根基的部分不退回', () => {
    // 已缴 2 段（3,000），但丹田被扣到 2,800
    expect(currentSegmentNeili(2800, 7000, 3, 2)).toBe(0);
  });
  it('丹田超过全额时按全额截断', () => {
    expect(currentSegmentNeili(9999, 7000, 3, 2)).toBe(4000);
  });
  it('末段圆满后当前段读作「第 N 段已蓄满」，而非归零——否则末穴永远冲不动', () => {
    expect(currentSegmentNeili(7000, 7000, 3, 3)).toBe(4000);
    // 冲穴扣款后液面回落，当前段随之减少，蓄回来又能再冲（design.md §3.4 W1 无死锁）
    expect(currentSegmentNeili(6850, 7000, 3, 3)).toBe(3850);
  });
});
