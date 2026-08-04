/**
 * 周天年轮视图模型测试 —— 权威来源：docs/systems/zhoutian/spec.md §1（呈现一致性三层语义）
 * + design.md §3.1/§3.2（周天段数 / 窍穴池与经脉分组）+ docs/rules/copy/zhoutian.md（冻结文案）
 *
 * 覆盖「几何由数据推导」这一实现契约：增脉增穴只改 REALM_ACUPOINTS / REALMS，
 * 本图应自行生长，不需要改布局代码。
 */
import { describe, it, expect } from 'vitest';
import { buildMandalaModel, slotGeometry, MAX_SLOTS } from './zhoutianMandalaModel';
import type { MandalaInput, MandalaSlot } from './zhoutianMandalaModel';
import { REALM_ACUPOINTS } from '../engine/acupoints';
import { REALMS } from '../engine/content';

const base: MandalaInput = {
  realm: 2, dantian: 0, breakCost: REALMS[2].breakthroughCost!,
  chargeHighWater: 0, chongxueChances: 0, qishi: 0, acupointProgress: {},
};
const at = (realm: number, patch: Partial<MandalaInput> = {}): MandalaInput => ({
  ...base, realm, breakCost: REALMS[realm].breakthroughCost!, ...patch,
});
const unlocked = (s: MandalaSlot) => s as Extract<MandalaSlot, { locked: false }>;
/** 摊平当前境界所有已解锁脉位上的窍穴 */
const allAcupoints = (slots: MandalaSlot[]) =>
  slots.filter(s => !s.locked).flatMap(s => unlocked(s).acupoints);
const opened = (ids: string[]) =>
  Object.fromEntries(ids.map(id => [id, { failCount: 0, opened: true }]));

describe('周天年轮 · 内圈周天环（spec §1 前两层语义）', () => {
  it('分段数逐境界跟随 zhoutianCount（3/4/6/8），不写死', () => {
    for (const realm of [2, 3, 4, 5]) {
      const m = buildMandalaModel(at(realm))!;
      expect(m.n).toBe(REALMS[realm - 1].zhoutianCount);
      expect(m.segments).toHaveLength(REALMS[realm - 1].zhoutianCount!);
    }
  });

  it('进度回落：内力支取后当前段填充如实回落（第一层语义）', () => {
    const cost = REALMS[2].breakthroughCost!;
    const high = buildMandalaModel(at(2, { dantian: cost * 0.30 }))!;
    const low = buildMandalaModel(at(2, { dantian: cost * 0.10 }))!;
    const fillSum = (m: typeof high) => m.segments.reduce((a, s) => a + s.filled, 0);
    expect(fillSum(high)).toBeGreaterThan(fillSum(low));
  });

  it('印记常亮：珠点数等于 chargeHighWater，内力归零也不消失（第二层语义可与第一层区分）', () => {
    const m = buildMandalaModel(at(3, { dantian: 0, chargeHighWater: 3 }))!;
    expect(m.segments.filter(s => s.pearl)).toHaveLength(3);
    expect(m.segments.every(s => s.filled === 0)).toBe(true);
  });

  it('圆满态使用冻结文案「{CN[N]}周天圆满 · 丹田已满」', () => {
    const cost = REALMS[2].breakthroughCost!;
    const m = buildMandalaModel(at(2, { dantian: cost }))!;
    expect(m.n).toBe(3);
    expect(m.centerText).toBe('三周天圆满 · 丹田已满');
  });

  it('境界圆满（无突破消耗）时不出图', () => {
    expect(buildMandalaModel({ ...base, realm: 5, breakCost: null })).toBeNull();
  });
});

describe('周天年轮 · 外圈经脉与窍穴（design.md §3.2）', () => {
  it('脉位数固定为终局最大值，未解锁脉位以占位形式保留并给出目标指引', () => {
    const m = buildMandalaModel(at(3))!;
    expect(m.slots).toHaveLength(MAX_SLOTS);
    expect(REALM_ACUPOINTS[3].meridians).toHaveLength(MAX_SLOTS - 1);
    const locked = m.slots.filter(s => s.locked);
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ name: '经脉·丙', unlockRealm: 5 });
  });

  it('境界 5 满配：3 脉全解锁、8 穴全可见、无锁定占位', () => {
    const m = buildMandalaModel(at(5))!;
    expect(m.slots.every(s => !s.locked)).toBe(true);
    const total = allAcupoints(m.slots).length;
    expect(total).toBe(REALMS[4].acupointPoolSize);
    expect(total).toBe(REALM_ACUPOINTS[5].acupoints.length);
  });

  it('每个境界的窍穴都在图上有位置（无遗漏、无重复）', () => {
    for (const realm of [2, 3, 4, 5]) {
      const m = buildMandalaModel(at(realm))!;
      const ids = allAcupoints(m.slots).map(a => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort()).toEqual(REALM_ACUPOINTS[realm].acupoints.map(a => a.id).sort());
    }
  });

  it('整脉冲开即贯通，未冲满的脉如实显示 n/total', () => {
    const jia = REALM_ACUPOINTS[2].meridians[0];
    const m = buildMandalaModel(at(2, { acupointProgress: opened(jia.acupointIds) }))!;
    expect(unlocked(m.slots[0]).through).toBe(true);
    const yi = unlocked(m.slots[1]);
    expect(yi.through).toBe(false);
    expect([yi.openedCount, yi.total]).toEqual([0, 2]);
  });

  it('成功率只在有冲穴机会时可操作（无机会时是纯览图，不堆噪声）', () => {
    const idle = buildMandalaModel(at(2, { chongxueChances: 0 }))!;
    expect(allAcupoints(idle.slots).every(a => !a.actionable)).toBe(true);
    expect(idle.statusText).toBe('冲穴机会不足 · 运转周天获取');

    const ready = buildMandalaModel(at(2, { chongxueChances: 2 }))!;
    const acus = allAcupoints(ready.slots);
    expect(acus.every(a => a.actionable)).toBe(true);
    expect(acus[0].rate).toBeCloseTo(0.85);          // 基础成功率 p（design.md §3.3）
    expect(ready.statusText).toBe('冲穴机会 2 · 点亮窍穴以行气冲穴');
  });

  it('已通窍穴不再可冲；失败累积推高该穴成功率（+10pp/次）', () => {
    const [a1, a2] = REALM_ACUPOINTS[2].acupoints;
    const m = buildMandalaModel(at(2, {
      chongxueChances: 1,
      acupointProgress: {
        [a1.id]: { failCount: 0, opened: true },
        [a2.id]: { failCount: 2, opened: false },
      },
    }))!;
    const acus = allAcupoints(m.slots);
    expect(acus.find(a => a.id === a1.id)!.actionable).toBe(false);
    expect(acus.find(a => a.id === a2.id)!.rate).toBeCloseTo(1);   // 第 3 次必成
  });
});

describe('周天年轮 · 脉位几何', () => {
  it('脉位均布整圆且互不重叠（增脉后自动重排）', () => {
    const geos = Array.from({ length: MAX_SLOTS }, (_, i) => slotGeometry(i));
    for (let i = 1; i < geos.length; i++) {
      expect(geos[i].mid - geos[i - 1].mid).toBeCloseTo(360 / MAX_SLOTS);
    }
    expect(geos[0].span).toBeLessThan(360 / MAX_SLOTS);
    expect(geos[0].span).toBeGreaterThan(0);
  });
});
