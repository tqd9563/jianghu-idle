/**
 * 装备引擎测试 —— battle-loot/spec.md §1（基础属性 / 词条 / 出售价、整数口径）、§2.1（品阶权重）、§6（apply_gear：不穿时逐项不变）
 */
import { describe, expect, it } from 'vitest';
import { computeAttributes } from './attributes';
import { fight, makeBuild } from './combat';
import { getStage, allStages } from './enemies';
import {
  AFFIX_POOL, BAG_CELLS, GRADE_NAMES, SELL_MULT, applyGearToBuild, bagFits, bagUsed, gearBonusOf, gearFullName,
  gearNameOf, gradeWeights, rollGear, rollGrade, type GearItem,
} from './gear';

/** 固定序列的伪随机：依次吐出给定值，用尽后循环 */
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
/** 线性同余：可复现的「随机」 */
const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

describe('gear · 生成', () => {
  it('数值一律整数且最低 1（裁决 37）；词条数在品阶区间内、不重复、来自本部位池；出售价 = 首通银两 × 品阶倍率', () => {
    const rng = lcg(7);
    const counts: Record<number, [number, number]> = { 1: [0, 1], 2: [1, 2], 3: [2, 3], 4: [3, 4], 5: [4, 4] };
    for (let i = 0; i < 400; i++) {
      const grade = ((i % 5) + 1) as GearItem['grade'];
      const it = rollGear({ grade, level: 1 + (i % 9) * 0.5, clearSilver: 40 }, rng);
      for (const v of Object.values(it.base)) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); }
      for (const [, v] of it.afx) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); }
      expect(it.afx.length).toBeGreaterThanOrEqual(counts[grade][0]);
      expect(it.afx.length).toBeLessThanOrEqual(counts[grade][1]);
      expect(new Set(it.afx.map(([k]) => k)).size).toBe(it.afx.length);
      for (const [k] of it.afx) expect(AFFIX_POOL[it.slot]).toContain(k);
      expect(it.sell).toBe(Math.round(40 * SELL_MULT[grade]));
      expect(it.cat !== undefined).toBe(it.slot === '兵器');
      expect(gearNameOf(it.slot, it.form, it.grade, it.cat)).toEqual([it.name, it.img]);
    }
  });

  it('基础属性按部位与型：兵器重型只有攻击、轻型另带命中；衣甲厚型气血 > 坚型；佩饰命中型 / 闪避型二选一', () => {
    const mid = () => 0.5;   // 浮动取中位
    const heavy = rollGear({ slot: '兵器', grade: 1, level: 3, clearSilver: 1 }, seq([0.1, 0.1, 0.1, 0.5, 0.5, 0.5]));
    expect(heavy.form).toBe(0);
    expect(Object.keys(heavy.base)).toEqual(['攻击']);
    const light = rollGear({ slot: '兵器', grade: 1, level: 3, clearSilver: 1 }, seq([0.1, 0.9, 0.5, 0.5, 0.5, 0.5]));
    expect(light.form).toBe(1);
    expect(Object.keys(light.base)).toEqual(['攻击', '命中']);
    expect(light.base.攻击!).toBeLessThanOrEqual(heavy.base.攻击!);

    const thick = rollGear({ slot: '衣甲', grade: 3, level: 5, clearSilver: 1 }, seq([0.1, 0.5, 0.5, 0.5, 0.5]));
    const firm = rollGear({ slot: '衣甲', grade: 3, level: 5, clearSilver: 1 }, seq([0.9, 0.5, 0.5, 0.5, 0.5]));
    expect(thick.base.气血!).toBeGreaterThan(firm.base.气血!);
    expect(thick.base.防御!).toBeLessThan(firm.base.防御!);

    const hitP = rollGear({ slot: '佩饰', grade: 1, level: 1, clearSilver: 1 }, seq([0.1, mid(), 0, 0]));
    const dodgeP = rollGear({ slot: '佩饰', grade: 1, level: 1, clearSilver: 1 }, seq([0.9, mid(), 0, 0]));
    expect(Object.keys(hitP.base)).toEqual(['命中']);
    expect(Object.keys(dodgeP.base)).toEqual(['闪避']);
  });

  it('装备等级沿 1.7^(ℓ−1) 放大：第 5 当量的兵器攻击约为第 1 当量的 8 倍', () => {
    const at = (level: number) => rollGear({ slot: '兵器', grade: 1, level, clearSilver: 1 }, seq([0.1, 0.1, 0.5, 0.5, 0.9])).base.攻击!;
    // 展示尺度（content.md §1 v2.9）：第 1 当量 0.036 × 100 × 1.08 ≈ 3.89 → 4；第 5 当量 × 1.7^4 ≈ 32.5 → 32
    expect(at(1)).toBe(4);
    expect(at(5)).toBe(32);
    expect(at(9)).toBe(Math.round(0.036 * 100 * Math.pow(1.7, 8) * 1.08));
  });

  it('品阶阶梯（裁决 49）：同部位同等级，每升一阶主属性 +20% 以上，橙约为白的 2.35 倍', () => {
    // 掷骰序列：型 0.1（第一型）→ 浮动取中位 0.5 → 词条全取 0.5
    const main = (slot: GearItem['slot'], grade: GearItem['grade'], level: number) => {
      const it = rollGear({ slot, cat: '刀', grade, level, clearSilver: 1 }, seq([0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
      return slot === '衣甲' ? it.base.气血! : it.base.攻击!;
    };
    for (const slot of ['兵器', '暗器', '衣甲'] as const) {
      for (const level of [6, 9, 12]) {
        const v = ([1, 2, 3, 4, 5] as const).map((g) => main(slot, g, level));
        for (let g = 1; g < 5; g++) expect(v[g] / v[g - 1]).toBeGreaterThanOrEqual(1.2);
        expect(v[4] / v[0]).toBeCloseTo(2.35, 1);
      }
    }
    // 境界 3 前沿附近（当量 8.4）的刀：凡品 → 极品
    expect([main('兵器', 1, 8.4), main('兵器', 5, 8.4)]).toEqual([Math.round(0.036 * 100 * 1.7 ** 7.4 * 1.08), Math.round(0.036 * 100 * 1.7 ** 7.4 * 1.08 * 2.35)]);
  });
});

describe('gear · 品阶与掉落', () => {
  it('品阶权重：段首白 55 / 绿 35 / 蓝 8，段末白 15 / 蓝 22；精英三成 +1、Boss 必 +1、入门关封顶精良', () => {
    expect(gradeWeights(0).slice(0, 3)).toEqual([55, 35, 8]);
    expect(gradeWeights(1).slice(0, 3)).toEqual([15, 35, 22]);
    expect(rollGrade(0, 'normal', seq([0]))).toBe(1);
    expect(rollGrade(0, 'normal', seq([0.99]))).toBe(3);        // 段首最高蓝（紫橙权重 < 0.1）
    expect(rollGrade(0, 'boss', seq([0]))).toBe(2);
    expect(rollGrade(0, 'elite', seq([0, 0.1]))).toBe(2);
    expect(rollGrade(0, 'elite', seq([0, 0.5]))).toBe(1);
    expect(rollGrade(1, 'boss', seq([0.9999]), true)).toBe(2);  // 入门关
    expect(rollGrade(1, 'boss', seq([0.99999]))).toBe(5);
  });

  it('一万次普通关掷骰：白绿蓝比例与权重一致（±3 pp）', () => {
    const rng = lcg(3);
    const n: Record<number, number> = {};
    for (let i = 0; i < 10000; i++) { const g = rollGrade(0.5, 'normal', rng); n[g] = (n[g] ?? 0) + 1; }
    const w = gradeWeights(0.5); const t = w.reduce((a, b) => a + b, 0);
    for (const g of [1, 2, 3]) expect(Math.abs((n[g] ?? 0) / 10000 - w[g - 1] / t)).toBeLessThan(0.03);
  });
});

describe('gear · 名字与背包', () => {
  it('全名 = 前缀（按词条强度从高到低）+ 的 + 物件名；无词条只有物件名', () => {
    const base = rollGear({ slot: '兵器', grade: 1, level: 1, clearSilver: 1 }, seq([0.1, 0.1, 0.5, 0.1]));
    const bare: GearItem = { ...base, afx: [] };
    expect(gearFullName(bare)).toBe(bare.name);
    expect(gearFullName({ ...bare, afx: [['hit', 2], ['atk', 5]] })).toBe(`锋锐精准的${bare.name}`);   // 攻击 5%（区间中位 2.2）强于命中 2（2.2）
    expect(gearFullName({ ...bare, afx: [['atk', 2], ['crit', 2], ['cd', 2], ['boss', 2]] })).toMatch(/^[一-龥]{8}的/);
    expect(GRADE_NAMES[5]).toBe('极品');
  });

  it('形态格：兵器 3 格、暗器 2 格、衣甲 4 格、佩饰 1 格，共 80 格', () => {
    const rng = lcg(11);
    const mk = (slot: GearItem['slot']) => rollGear({ slot, grade: 1, level: 1, clearSilver: 1 }, rng);
    const bag = [mk('兵器'), mk('暗器'), mk('衣甲'), mk('佩饰')];
    expect(bagUsed(bag)).toBe(10);
    const full = Array.from({ length: 20 }, () => mk('衣甲'));
    expect(bagUsed(full)).toBe(BAG_CELLS);
    expect(bagFits(full, mk('佩饰'))).toBe(false);
    expect(bagFits(full.slice(1), mk('衣甲'))).toBe(true);
  });
});

describe('gear · 叠进构筑（spec §6）', () => {
  const sword: GearItem = {
    id: 'a', slot: '兵器', cat: '剑', form: 0, grade: 3, level: 3, name: '玄铁剑', img: 'jian-xuantie',
    base: { 攻击: 2 }, afx: [['atk', 4], ['crit', 2], ['boss', 5]], sell: 1, fresh: false,
  };
  const armor: GearItem = {
    id: 'b', slot: '衣甲', form: 0, grade: 2, level: 3, name: '皮甲', img: 'jia-pi',
    base: { 气血: 20, 防御: 1 }, afx: [['hp', 3], ['qi', 5]], sell: 1, fresh: false,
  };

  it('不穿装备时构筑与属性逐项不变（判据 1）', () => {
    const b = makeBuild('huashan', 3, 5, 0);
    expect(applyGearToBuild(b, gearBonusOf({}))).toEqual(b);
    expect(applyGearToBuild(b, gearBonusOf(undefined))).toEqual(b);
    const a0 = computeAttributes(3, 'huashan', 5);
    expect(computeAttributes(3, 'huashan', 5, 0, 0, 1, gearBonusOf({}))).toEqual(a0);
  });

  it('百分比乘进基础值、命中 / 闪避 / 真气相加、会心封顶 80%；破军只对精英 / Boss 生效', () => {
    const g = gearBonusOf({ 兵器: sword, 衣甲: armor });
    expect(g).toMatchObject({ atk: 2, hp: 20, def: 1, atkPct: 0.04, hpPct: 0.03, critPP: 2, hardPct: 0.05, qi: 5 });
    const b = makeBuild('shaolin', 3, 5, 0);
    const gb = applyGearToBuild(b, g);
    expect(gb.atk).toBeCloseTo((b.atk + 2) * 1.04, 9);
    expect(gb.hp).toBeCloseTo((b.hp + 20) * 1.03, 9);
    expect(gb.crit).toBeCloseTo(b.crit + 0.02, 9);
    expect(applyGearToBuild(b, { ...g, critPP: 500 }).crit).toBe(0.8);

    const a = computeAttributes(3, 'shaolin', 5, 0, 0, 1, g);
    const a0 = computeAttributes(3, 'shaolin', 5);
    expect(a.atk).toBeCloseTo((a0.atk + 2) * 1.04, 0);   // a0.atk 已取整到 0.1，再乘会差半位
    expect(a.critRate).toBeCloseTo(a0.critRate + 0.02, 9);

    const normal = allStages().find((e) => e.kind === 'normal' && !e.tags.includes('高血'))!;
    const elite = allStages().find((e) => e.kind === 'elite')!;
    const build = makeBuild('huashan', 6, 10, 0);
    const dmg = (e: typeof normal, bonus: number) => fight(build, e, { mode: 'ev', hardDmgBonus: bonus }).stats.dmgDealt;
    expect(dmg(normal, 0.5)).toBe(dmg(normal, 0));
    expect(dmg(elite, 0.5)).toBeGreaterThan(dmg(elite, 0));
    expect(getStage(1, 0, 1).kind).toBe('normal');
  });
});
