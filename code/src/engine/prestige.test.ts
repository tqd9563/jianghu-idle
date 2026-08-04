/**
 * 声望结算对照测试：期望值由 sim settle_reputation 生成（数值权威口径，含银行家舍入）。
 * 生成命令见各 case 注释；改声望公式必须先改 sim 再刷新期望值。
 */
import { describe, expect, it } from 'vitest';
import { breakthroughDiscount, battleNeiliMult, carryXp, idleMult, settleRetire } from './prestige';

const m1all = Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`);
const m2upto = (n: number) => Array.from({ length: n }, (_, i) => `m2s${i + 1}`);
const m3upto = (n: number) => Array.from({ length: n }, (_, i) => `m3s${i + 1}`);
const m4upto = (n: number) => Array.from({ length: n }, (_, i) => `m4s${i + 1}`);
const m5upto = (n: number) => Array.from({ length: n }, (_, i) => `m5s${i + 1}`);
/** 三图 28 关全通（归隐解锁点即在 Boss 3，为常见轮型） */
const FULL3 = [...m1all, ...m2upto(10), ...m3upto(10)];
/** 五图 48 关全通（表现加成唯一能拿满 +30% 的轮型） */
const FULL5 = [...FULL3, ...m4upto(10), ...m5upto(10)];

describe('settleRetire · 对照 sim settle_reputation', () => {
  it('三图轮 · 28 关全通 46 分钟 → 120（精英 +20%，不满足 48 关全通）', () => {
    const r = settleRetire('standard', FULL3, 46 * 60);
    expect(r.base).toBe(100);
    expect(r.fullClear).toBe(false);
    expect(r.perfPct).toBeCloseTo(0.20, 10);
    expect(r.timePenalty).toBe(1);
    expect(r.total).toBe(120);
  });

  it('五图轮 · 48 关全通 90 分钟 → 260（基础 200 × 表现拿满 +30%）', () => {
    const r = settleRetire('standard', FULL5, 90 * 60);
    expect(r.base).toBe(200);
    expect(r.eliteKills).toBe(12);
    expect(r.fullClear).toBe(true);
    expect(r.perfPct).toBeCloseTo(0.30, 10);
    expect(r.total).toBe(260);
  });

  it('深推未全通 · 至 Boss 4、8 精英、70 分钟 → 182（加成已触顶 +30%）', () => {
    const cleared = [...FULL3, ...m4upto(10)];
    const r = settleRetire('standard', cleared, 70 * 60);
    expect(r.base).toBe(140);
    expect(r.eliteKills).toBe(8);
    expect(r.fullClear).toBe(false);
    expect(r.perfPct).toBeCloseTo(0.30, 10);
    expect(r.total).toBe(182);
  });

  it('保底归隐 · Boss1+2、3 精英、41 分钟 → 34（(20+30)×1.12×0.6）', () => {
    const cleared = [...m1all, ...m2upto(10), ...m3upto(3)];
    const r = settleRetire('fallback', cleared, 41 * 60);
    expect(r.base).toBe(50);
    expect(r.eliteKills).toBe(3);
    expect(r.discount).toBe(0.6);
    expect(r.total).toBe(34);
  });

  it('短轮修正 · 三图全通但仅 10 分钟 → 53（×(10/15)²，纯保险条款）', () => {
    const r = settleRetire('standard', FULL3, 10 * 60);
    expect(r.timePenalty).toBeCloseTo((10 / 15) ** 2, 10);
    expect(r.total).toBe(53);
  });

  it('保底最低档 · 仅 Boss1 + 1 精英、49 分钟 → 12', () => {
    const cleared = [...m1all, ...m2upto(4)];
    const r = settleRetire('fallback', cleared, 49 * 60);
    expect(r.base).toBe(20);
    expect(r.eliteKills).toBe(1);
    expect(r.total).toBe(12);
  });

  it('标准但未全通 · 三 Boss + 2 精英、34 分钟 → 108', () => {
    const cleared = ['m1s8', 'm2s10', 'm3s10', 'm2s4', 'm2s7'];
    const r = settleRetire('standard', cleared, 34 * 60);
    expect(r.fullClear).toBe(false);
    expect(r.perfPct).toBeCloseTo(0.08, 10);
    expect(r.total).toBe(108);
  });
});

describe('节点效果参数（sim run_playthrough2 对齐）', () => {
  it('旧梦重温挂机 ×1.2；江湖熟路战斗内力 ×1.2；武道笔记继承 40 阅历', () => {
    expect(idleMult(['jiumeng_chongwen'])).toBe(1.2);
    expect(idleMult([])).toBe(1);
    expect(battleNeiliMult(['jianghu_shulu'])).toBe(1.2);
    expect(carryXp(['wudao_biji'])).toBe(40);
    expect(carryXp([])).toBe(0);
  });

  it('快速入门只折减境界 2/3 突破（−30%），境界 4/5 不受影响', () => {
    const owned = ['kuaisu_rumen'];
    expect(breakthroughDiscount(2, owned)).toBe(0.7);
    expect(breakthroughDiscount(3, owned)).toBe(0.7);
    expect(breakthroughDiscount(4, owned)).toBe(1);
    expect(breakthroughDiscount(5, owned)).toBe(1);
    expect(breakthroughDiscount(2, [])).toBe(1);
  });
});
