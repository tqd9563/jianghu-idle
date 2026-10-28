import { describe, expect, it } from 'vitest';
import { ACHV } from '../engine/achievements';
import { DIYUN_IDS } from '../engine/prestige';
import { XIANG, ZONES, cardAt, jiyuanSlipAt, picLayout, reveal } from './qianchenSceneModel';

describe('前尘 · 往世八相', () => {
  it('八相一一对应八条底蕴', () => {
    expect(XIANG.map((x) => x.id).sort()).toEqual([...DIYUN_IDS].sort());
  });
  it('显影随级数单调变实，0 级留残影、满了封顶', () => {
    expect(reveal(0)).toBeCloseTo(0.12);
    const seq = [1, 2, 3, 5, 8, 15, 30].map(reveal);
    seq.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(seq[i]));
    expect(reveal(1)).toBeGreaterThan(reveal(0));
    expect(reveal(100)).toBe(1);
  });
});

describe('前尘 · 机缘挂签', () => {
  it('十四支签都落在画内，上下两排', () => {
    const at = Array.from({ length: 14 }, (_, i) => jiyuanSlipAt(i));
    at.forEach(([x, y]) => { expect(x).toBeGreaterThan(5); expect(x).toBeLessThan(95); expect(y).toBeGreaterThan(5); expect(y).toBeLessThan(60); });
    expect(at[7][1]).toBeGreaterThan(at[0][1] + 15);
  });
});

describe('前尘 · 江湖百景', () => {
  it('四处地界不重不漏地放下二十二条成就', () => {
    const ids = ZONES.flatMap((z) => z.ids);
    expect(ids.length).toBe(ACHV.length);
    expect(new Set(ids)).toEqual(new Set(ACHV.map((a) => a.id)));
    ZONES.forEach((z) => expect(z.at.length).toBe(z.ids.length));
  });
});

describe('前尘 · 版面', () => {
  it('宽舞台按宽铺满、上下羽化；高舞台放大但左右最多裁 1.5%', () => {
    const wide = picLayout(1300, 900);
    expect(wide.pw).toBeCloseTo(1300 / 0.985);
    expect(wide.short).toBe(true);
    const exact = picLayout(1600, 900);
    expect(exact.pw).toBe(1600); expect(exact.pt).toBe(0); expect(exact.short).toBe(false);
  });
  it('手卷下面放不下改到上方，左右夹在舞台内', () => {
    const stage = { w: 1000, h: 800 }, card = { w: 500, h: 190 };
    expect(cardAt({ left: 100, top: 300, bottom: 340, cx: 120 }, card, stage)).toEqual({ x: 12, y: 346 });
    expect(cardAt({ left: 900, top: 650, bottom: 690, cx: 920 }, card, stage)).toEqual({ x: 488, y: 454 });
  });
});
