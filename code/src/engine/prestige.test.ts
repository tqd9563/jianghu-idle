/**
 * 声望、宿慧与修行感悟 —— 对照 docs/rules/economy.md v2.2（数值由 pacing_sim / longline_sim 生成）。
 */
import { describe, expect, it } from 'vitest';
import {
  FRONT_MULT, REP_NODES, carryXp, deepestBoss, ganwuAffordable, ganwuPrice, isBossKey, isEliteKey,
  outputMult, settleRetire, suhuiTotal,
} from './prestige';

describe('宿慧（economy.md §2）', () => {
  it('首达 2/3/4/5 依次 +1.2 / +2.8 / +5.8 / +10.0，累计', () => {
    expect(suhuiTotal(1)).toBe(0);
    expect(suhuiTotal(2)).toBeCloseTo(1.2, 10);
    expect(suhuiTotal(4)).toBeCloseTo(9.8, 10);
    expect(suhuiTotal(6)).toBeCloseTo(19.8, 10);
  });
  it('达成后乘区与宿慧表一致（第 7 天 9.8×、第 21 天 26.8×，此时修行感悟按每天 4 级算）', () => {
    // 第 7 天：修行感悟 24 级（+4.8×）+ 宿慧 1.2 + 2.8 + 基础 1
    expect(outputMult(3, 24)).toBeCloseTo(9.8, 10);
    // 第 21 天：80 级（+16.0×）+ 宿慧 9.8 + 基础 1
    expect(outputMult(4, 80)).toBeCloseTo(26.8, 10);
  });
});

describe('修行感悟（economy.md §3）', () => {
  it('第 n 级价格 10n', () => {
    expect(ganwuPrice(1)).toBe(10);
    expect(ganwuPrice(137)).toBe(1370);
  });
  it('尽数传承：从 136 级、7,570 声望起可连买 5 级、花 6,950', () => {
    expect(ganwuAffordable(136, 7570)).toEqual({ levels: 5, cost: 6950 });
    expect(ganwuAffordable(0, 5)).toEqual({ levels: 0, cost: 0 });
  });
});

describe('归隐声望（economy.md §1）', () => {
  const base = { clearedStages: [] as string[], deepestBossEver: 0, fameThisLife: 0 };

  it('基础声望 = 10 × 乘区加权小时，取整', () => {
    const r = settleRetire({ ...base, weightedHours: 598.4 });
    expect(r.base).toBe(5984);
    expect(r.total).toBe(5984);
  });

  it('打到自己的前沿 ×1.2：本世最深 Boss 不浅于历来最深', () => {
    const cleared = ['m1s8', 'm2s10'];
    const hit = settleRetire({ ...base, weightedHours: 598.4, clearedStages: cleared, deepestBossEver: 2 });
    expect(hit.frontReached).toBe(true);
    expect(hit.frontMult).toBe(FRONT_MULT);
    expect(hit.total).toBe(Math.floor(5984 * 1.2));
    const miss = settleRetire({ ...base, weightedHours: 598.4, clearedStages: ['m1s8'], deepestBossEver: 2 });
    expect(miss.frontReached).toBe(false);
    expect(miss.total).toBe(5984);
  });

  it('一个 Boss 都没打过时不给前沿乘数', () => {
    const r = settleRetire({ ...base, weightedHours: 16 });
    expect(r.frontReached).toBe(false);
    expect(r.frontMult).toBe(1);
  });

  it('成就层已即时入账，结算只展示、不计入本次合计', () => {
    const r = settleRetire({ ...base, weightedHours: 10, fameThisLife: 243 });
    expect(r.fameThisLife).toBe(243);
    expect(r.total).toBe(100);
  });
});

describe('Boss 深浅与精英键', () => {
  it('Boss 深浅 = 图序；精英、Boss 键可辨认', () => {
    expect(deepestBoss(['m1s3', 'm1s8', 'm2s4'])).toBe(1);
    expect(deepestBoss(['m1s8', 'm3s10'])).toBe(3);
    expect(isBossKey('m2s10')).toBe(true);
    expect(isEliteKey('m2s10')).toBe(false);
    expect(isBossKey('m1s1')).toBe(false);
  });
});

describe('五件传承（economy.md §4 v2.2）', () => {
  it('价格 150 / 220 / 440 / 660 / 1,100；三件废止节点不再出现', () => {
    expect(REP_NODES.map((n) => [n.id, n.price])).toEqual([
      ['zairu_jianghu', 150], ['qingzhuang_shanglu', 220], ['wudao_biji', 440],
      ['shimen_zhiyin', 660], ['poguan_xinde', 1100],
    ]);
  });
  it('武道笔记继承 40 阅历', () => {
    expect(carryXp(['wudao_biji'])).toBe(40);
    expect(carryXp([])).toBe(0);
  });
});
