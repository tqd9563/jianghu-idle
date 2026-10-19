/**
 * 声望、宿慧与修行感悟 —— 对照 docs/rules/economy.md v2.2（数值由 pacing_sim / longline_sim 生成）。
 */
import { describe, expect, it } from 'vitest';
import {
  FRONT_MULT, REP_NODES, deepestBoss, ganwuAffordable, ganwuPrice, isBossKey, isEliteKey,
  diyunBonus, diyunCum, diyunGainAt, diyunPrice, outputMult, settleRetire, suhuiTotal,
} from './prestige';
import { allStages, stageKey, trackLength, type MapId, type TierId } from './enemies';

const boss = (map: MapId, tier: TierId) => stageKey(map, tier, trackLength(map, tier));

describe('宿慧（economy.md §2）', () => {
  it('首达 2/3/4/5 依次 +1.6 / +3.7 / +7.6 / +13.4，累计', () => {
    expect(suhuiTotal(1)).toBe(0);
    expect(suhuiTotal(2)).toBeCloseTo(1.6, 10);
    expect(suhuiTotal(4)).toBeCloseTo(12.9, 10);
    expect(suhuiTotal(6)).toBeCloseTo(26.3, 10);
  });
  it('达成后乘区与宿慧表一致（第 7 天 12.5×、第 21 天 34.9×，修行感悟级数取 pacing_sim 推演）', () => {
    // 第 7 天：修行感悟 31 级（+6.2×）+ 宿慧 1.6 + 3.7 + 基础 1
    expect(outputMult(3, 31)).toBeCloseTo(12.5, 10);
    // 第 21 天：105 级（+21.0×）+ 宿慧 12.9 + 基础 1
    expect(outputMult(4, 105)).toBeCloseTo(34.9, 10);
  });
});

describe('修行感悟（economy.md §3）', () => {
  it('第 n 级价格 ⌈8.5n⌉（底蕴分走 15% 声望后的补偿价）', () => {
    expect([1, 2, 3, 10].map(ganwuPrice)).toEqual([9, 17, 26, 85]);
  });
  it('尽数传承：从 136 级、7,570 声望起可连买 5 级、花 6,950', () => {
    expect(ganwuAffordable(136, 7570)).toEqual({ levels: 6, cost: 7116 });
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
    const cleared = [boss(1, 0), boss(2, 0)];
    const hit = settleRetire({ ...base, weightedHours: 598.4, clearedStages: cleared, deepestBossEver: 2 });
    expect(hit.frontReached).toBe(true);
    expect(hit.frontMult).toBe(FRONT_MULT);
    expect(hit.total).toBe(Math.floor(5984 * 1.2));
    const miss = settleRetire({ ...base, weightedHours: 598.4, clearedStages: [boss(1, 0)], deepestBossEver: 2 });
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

describe('Boss 深浅与精英键（难度优先、同档比图序，economy.md §1.2）', () => {
  it('只有段末 Boss 计深浅；精英不计', () => {
    expect(deepestBoss([boss(1, 0)])).toBe(1);
    expect(deepestBoss([boss(1, 0), boss(3, 0)])).toBe(3);
    expect(deepestBoss([boss(3, 0), boss(1, 1)])).toBe(11);   // 历练 · 图 1 深于 初入 · 图 3
    const elite = allStages().find((e) => e.map === 1 && e.tier === 0 && e.kind === 'elite')!;
    expect(deepestBoss([stageKey(1, 0, elite.stage)])).toBe(0);
    expect(isBossKey(stageKey(1, 0, elite.stage))).toBe(false);
  });
  it('精英、Boss 键可辨认，普通关都不是', () => {
    const elite = allStages().find((e) => e.kind === 'elite')!;
    expect(isEliteKey(stageKey(elite.map, elite.tier, elite.stage))).toBe(true);
    expect(isBossKey(boss(2, 1))).toBe(true);
    expect(isEliteKey(boss(2, 1))).toBe(false);
    expect(isBossKey(stageKey(1, 0, 1))).toBe(false);
  });
});

describe('十四件机缘（prestige-shop/design.md §2b）', () => {
  it('十四件按价升序，合计 4,040；旧三件废止节点不再出现', () => {
    expect(REP_NODES.map((n) => n.id)).toEqual([
      'chongchu_jianghu', 'qingzhuang_shanglu', 'gaixian_yizhe', 'baoluo_wanxiang', 'huiyan_shizhu', 'yaodao_bingchu', 'anhun_dingpo',
      'haina_baichuan', 'jiaqing_jiushu', 'renzu_guizong', 'taojia_huanjia', 'shuangguan_qixia', 'bizhou_zizhen', 'kegu_mingxin',
    ]);
    expect(REP_NODES.reduce((a, n) => a + n.price, 0)).toBe(4040);
    expect(REP_NODES.every((n, i) => i === 0 || n.price >= REP_NODES[i - 1].price)).toBe(true);
  });
});

describe('底蕴（prestige-shop/design.md §2）', () => {
  it('价格等比：10 · 14 · 18 · 25 · 33；第 20 级 2,995', () => {
    expect([1, 2, 3, 4, 5].map(diyunPrice)).toEqual([10, 14, 18, 25, 33]);
    expect(diyunPrice(20)).toBe(2995);
  });
  it('收益逐级 × 0.96：气血类 25 级累计约 +80%，上限 125%', () => {
    expect(diyunGainAt(0.05, 1)).toBeCloseTo(0.05, 10);
    expect(diyunGainAt(0.05, 2)).toBeCloseTo(0.048, 10);
    expect(diyunCum(0.05, 25)).toBeCloseTo(0.80, 2);
    expect(diyunCum(0.05, 1000)).toBeCloseTo(1.25, 3);
    expect(diyunBonus(undefined, 'qixue')).toBe(0);
    expect(diyunBonus({ huixin: 3 }, 'huixin')).toBeCloseTo(0.005 * (1 + 0.96 + 0.96 ** 2), 10);
  });
  it('修行感悟价 ⌈8.5n⌉：1 / 2 / 137 级 = 9 / 17 / 1,165', () => {
    expect([1, 2, 137].map(ganwuPrice)).toEqual([9, 17, 1165]);
  });
});
