/**
 * 内功引擎（sect-neigong/spec.md §1、§3）。寻常内功必须与原「招式十成 + 火候」构筑逐项一致：
 * 这是关卡与敌人不用重调的前提（spec §7 判据零）。
 */
import { describe, expect, it } from 'vitest';
import { makeBuild } from './combat';
import {
  NEIGONG, STARTER_NEIGONG, TIERS, dunwuChance, neigongBuild, neigongOf, qiMax, rollWuxing, switchFee,
  tierGate, zhongAfterSwitch, zhongCost,
} from './neigong';

describe('内功构筑', () => {
  it('寻常内功 = makeBuild（前三阶即机制节点 1/2/3），逐项一致', () => {
    for (const id of STARTER_NEIGONG) {
      for (const [realm, zhong, passed] of [[2, 6, 3], [3, 41, 3], [4, 70, 3], [5, 95, 3], [2, 3, 1]] as const) {
        expect(neigongBuild(id, realm, zhong, passed)).toEqual(makeBuild(NEIGONG[id].route, realm, zhong, passed));
      }
    }
  });

  it('上乘火候多 2%，化境改机制参数（惊雷剑招 +50pp）', () => {
    const base = makeBuild('huashan', 4, 60, 3);
    const up = neigongBuild('leimingjianjing', 4, 60, 4);
    expect(up.atk / base.atk).toBeCloseTo(Math.pow(1.7, 2.5 * 0.02), 9);
    expect(up.burstMult).toBeCloseTo(base.burstMult + 0.5, 9);
    expect(neigongBuild('leimingjianjing', 4, 60, 3).burstMult).toBe(base.burstMult);
  });
});

describe('台阶与顿悟', () => {
  it('重数到了下一台阶、还没跨过去才挡；品质决定有几阶', () => {
    expect(tierGate('寻常', 1, 0)).toBeNull();
    expect(tierGate('寻常', 2, 0)!.tier.name).toBe('登堂');
    expect(tierGate('寻常', 5, 2)).toBeNull();            // 入室已过、大成在第 6 重
    expect(tierGate('寻常', 30, 3)).toBeNull();           // 寻常只有三阶
    expect(tierGate('上乘', 20, 3)!.tier.name).toBe('化境');
    expect(tierGate('绝学', 40, 4)!.needScroll).toBe(true); // 归真要卷册
    expect(tierGate('绝学', 40, 4, true)!.needScroll).toBe(false);
  });

  it('顿悟概率 = 基础 × 悟性', () => {
    expect(dunwuChance(TIERS[0], 1.2)).toBeCloseTo(0.6, 9);
    expect(dunwuChance(TIERS[3], 0.8)).toBeCloseTo(0.016, 9);
  });

  it('悟性 0.8–1.2，武道笔记 +0.1', () => {
    expect(rollWuxing(0)).toBe(0.8);
    expect(rollWuxing(0.999999)).toBe(1.2);
    expect(rollWuxing(0.5, 0.1)).toBe(1.1);
  });
});

describe('真气、价格、转修', () => {
  it('真气上限 = (70 + 15 × (境界 − 2) + 重数) × 品质系数', () => {
    expect(qiMax(2, 40, '寻常')).toBe(110);
    expect(qiMax(4, 61, '上乘')).toBe(177);
    expect(qiMax(5, 103, '绝学')).toBe(262);
  });

  it('第 n 重价 = 3,490 × 1.08^(n−1)', () => {
    expect(zhongCost(1)).toBe(3490);
    expect(zhongCost(11)).toBe(Math.round(3490 * 1.08 ** 10));
  });

  it('同路数少 3 重（保留约八成累计内力），跨路数归零；手续费 = 境界 × 100', () => {
    expect(zhongAfterSwitch('jingleijue', 'leimingjianjing', 40)).toBe(37);
    expect(zhongAfterSwitch('jingleijue', 'leimingjianjing', 2)).toBe(0);
    expect(zhongAfterSwitch('jingleijue', 'zhenyuegong', 40)).toBe(0);
    const spent = (n: number) => Array.from({ length: n }, (_, i) => zhongCost(i + 1)).reduce((a, b) => a + b, 0);
    expect(spent(37) / spent(40)).toBeGreaterThan(0.77);
    expect(spent(37) / spent(40)).toBeLessThan(0.83);
    expect(switchFee(3)).toBe(300);
  });

  it('名录：三路数 × 三品质各一部', () => {
    for (const r of ['huashan', 'shaolin', 'tangmen'] as const) {
      for (const q of ['寻常', '上乘', '绝学'] as const) expect(NEIGONG[neigongOf(r, q)].quality).toBe(q);
    }
  });
});
