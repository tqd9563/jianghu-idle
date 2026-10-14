/**
 * 经济实测 —— 市集 / 黑市 / 贡献商店的「实装后 sim 复核」（issue #45 末项；battle-loot/design.md 裁决 31–34、spec.md §7）。
 *
 * 用模拟玩家（simBot：穿装备、卖杂件、逛铺子、买蒙面货）驱动真实 store 连续玩 ECON_DAYS 天，按天记：
 * 银两进账与去向、前沿首通银两（铺子与黑市的定价基数）、黑市解锁日与每世买了几件、掉落件数与品阶、贡献与绝学。
 * 它不设判据——判据在 spec.md §7 里按这份实测定；日常 CI 不跑（SIM_ECON=1 才跑）。
 *
 * 用法：SIM_ECON=1 npx vitest run src/telemetry/economy.sim.test.ts   → docs/systems/sim/economy_measured.json
 *       ECON_DAYS=40 ECON_SEEDS=7 可改天数 / 种子
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import type { RouteId } from '../engine/content';
import { GRADE_NAMES, type GearSlot } from '../engine/gear';
import { maskPrice } from '../engine/market';
import { getStage } from '../engine/enemies';
import { WUXUE } from '../engine/wuxue';
import { frontierStageOf, marketGoodsOf, priceBasisOf, useGameStore } from '../store/gameStore';
import { getEvents, resetTelemetry } from './telemetry';
import { playDay, resetBot, st } from './simBot';

const OUT = resolve(process.cwd(), '../docs/systems/sim/economy_measured.json');
const ROUTES: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
const SEEDS = process.env.ECON_SEEDS ? process.env.ECON_SEEDS.split(',').map(Number) : [7, 42];
const DAYS = Number(process.env.ECON_DAYS ?? 70);

interface DayRow {
  day: number; run: number; realm: number;
  /** 前沿关与它的首通银两（铺子 / 黑市定价基数） */
  frontier: string; clearSilver: number;
  /** 挂机关与它的首通银两、当天挂机场次 */
  idle: string | null; idleSilver: number; idleFights: number;
  silver: number;
  /** 当天进账：战斗 + 离线 + 出售；去向：武馆 / 铺子 / 黑市 */
  income: number; sellIncome: number; spentWuxue: number; spentStall: number; spentBlack: number;
  stallPrice: [number, number]; maskedPrice: number;
  blackOpen: boolean; blackBuys: number; marketSpent: number;
  /** 当天掉落件数（在线逐件 + 离线合计）与在线掉落的品阶分布 */
  drops: number; dropGrades: number[];
  worn: Partial<Record<GearSlot, number>>;
  contrib: number; juexue: number;
}

interface Sample {
  route: RouteId; seed: number; days: DayRow[];
  lives: { run: number; realmStart: number; days: number; income: number; spentStall: number; spentBlack: number; blackBuys: number; blackOpenDay: number | null }[];
  firstBlackOpen: number | null;
}

function play(route: RouteId, seed: number): Sample {
  let x = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  });
  vi.setSystemTime(Date.UTC(2026, 8, 29, 8, 0, 0));
  st().hardReset();
  useGameStore.setState({ started: true });
  resetBot();
  resetTelemetry();
  // 进账：同一世内银两每次上涨都记（战斗 / 离线 / 出售 / 重复首杀折银）
  let income = 0;
  const unsub = useGameStore.subscribe((s, prev) => {
    if (s.run === prev.run && s.silver > prev.silver) income += s.silver - prev.silver;
  });
  const days: DayRow[] = [];
  let seen = 0;
  let fights0 = 0;
  for (let day = 1; day <= DAYS; day++) {
    const income0 = income;
    playDay(route);
    const ev = getEvents().slice(seen);
    seen = getEvents().length;
    const s = st();
    const front = frontierStageOf(s);
    const goods = marketGoodsOf(s);
    const idleStage = s.idle ? getStage(s.idle.map, s.idle.tier, s.idle.stage) : null;
    const fights = s.idle?.fights ?? 0;
    const idleFights = fights >= fights0 ? fights - fights0 : fights;
    fights0 = fights;
    const num = (e: Record<string, unknown>, k: string) => Number(e[k] ?? 0);
    const dropGrades = [0, 0, 0, 0, 0, 0];
    let drops = 0;
    for (const e of ev) {
      if (e.e !== 'gear_dropped') continue;
      if (e.offline) drops += num(e, 'count');
      else { drops += 1; dropGrades[num(e, 'grade')] += 1; }
    }
    const sum = (name: string, k: string, pred: (e: Record<string, unknown>) => boolean = () => true) =>
      ev.filter((e) => e.e === name && pred(e)).reduce((a, e) => a + num(e, k), 0);
    days.push({
      day, run: s.run, realm: s.realm,
      frontier: `m${front.map}t${front.tier}s${front.stage}`, clearSilver: front.reward.silver,
      idle: idleStage ? `m${idleStage.map}t${idleStage.tier}s${idleStage.stage}` : null, idleSilver: idleStage?.reward.silver ?? 0, idleFights,
      silver: s.silver,
      income: income - income0,
      sellIncome: sum('gear_sold', 'silver') + sum('gear_dropped', 'sold'),
      spentWuxue: sum('shop_bought', 'price', (e) => !e.slot),
      spentStall: sum('shop_bought', 'price', (e) => !!e.slot),
      spentBlack: sum('black_bought', 'price'),
      stallPrice: [goods.arms[0].price, goods.arms[5].price],
      maskedPrice: maskPrice('gear', s.realm, priceBasisOf(s)),
      blackOpen: s.blackOpen, blackBuys: s.blackBuys ?? 0, marketSpent: s.marketSpent ?? 0,
      drops, dropGrades,
      worn: Object.fromEntries(Object.entries(s.worn ?? {}).map(([k, v]) => [k, v!.grade])),
      contrib: s.contrib ?? 0,
      juexue: s.ownedWuxue.filter((w) => WUXUE[w].quality === '绝学').length,
    });
  }
  unsub();
  vi.mocked(Math.random).mockRestore();
  // 按世汇总
  const lives: Sample['lives'] = [];
  for (const d of days) {
    let L = lives[lives.length - 1];
    if (!L || L.run !== d.run) { L = { run: d.run, realmStart: d.realm, days: 0, income: 0, spentStall: 0, spentBlack: 0, blackBuys: 0, blackOpenDay: null }; lives.push(L); }
    L.days += 1; L.income += d.income; L.spentStall += d.spentStall; L.spentBlack += d.spentBlack; L.blackBuys = d.blackBuys;
    if (d.blackOpen && L.blackOpenDay === null && !lives.slice(0, -1).some((p) => p.blackOpenDay !== null)) L.blackOpenDay = d.day;
  }
  return { route, seed, days, lives, firstBlackOpen: days.find((d) => d.blackOpen)?.day ?? null };
}

describe.skipIf(!process.env.SIM_ECON)('经济实测：市集 / 黑市 / 贡献商店（SIM_ECON=1）', () => {
  beforeAll(() => { vi.useFakeTimers(); });
  afterAll(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('记录标准玩家各天的银两进出与黑市解锁', () => {
    const samples = ROUTES.flatMap((r) => SEEDS.map((seed) => play(r, seed)));
    // 按境界汇总：每天进账、前沿首通银两、铺子 / 黑市价对进账的倍数、每世黑市件数
    const byRealm: Record<number, { days: number; income: number; clearSilver: number; idleSilver: number; fights: number; stall1: number; stall2: number; masked: number; sell: number; drops: number; blackBuys: number; lives: Set<string> }> = {};
    for (const smp of samples) {
      for (const d of smp.days) {
        const b = byRealm[d.realm] ??= { days: 0, income: 0, clearSilver: 0, idleSilver: 0, fights: 0, stall1: 0, stall2: 0, masked: 0, sell: 0, drops: 0, blackBuys: 0, lives: new Set() };
        b.days += 1; b.income += d.income; b.clearSilver += d.clearSilver; b.idleSilver += d.idleSilver; b.fights += d.idleFights; b.stall1 += d.stallPrice[0]; b.stall2 += d.stallPrice[1];
        b.masked += d.maskedPrice; b.sell += d.sellIncome; b.drops += d.drops;
        b.lives.add(`${smp.route}:${smp.seed}:${d.run}`);
      }
      for (const L of smp.lives) (byRealm[L.realmStart] ??= { days: 0, income: 0, clearSilver: 0, idleSilver: 0, fights: 0, stall1: 0, stall2: 0, masked: 0, sell: 0, drops: 0, blackBuys: 0, lives: new Set() }).blackBuys += L.blackBuys;
    }
    const summary = Object.entries(byRealm).map(([realm, b]) => ({
      realm: Number(realm), days: b.days, lives: b.lives.size,
      incomePerDay: Math.round(b.income / b.days), clearSilver: Math.round(b.clearSilver / b.days), idleSilver: Math.round(b.idleSilver / b.days), fightsPerDay: Math.round(b.fights / b.days),
      stallPrice: [Math.round(b.stall1 / b.days), Math.round(b.stall2 / b.days)], maskedPrice: Math.round(b.masked / b.days),
      sellPerDay: Math.round(b.sell / b.days), dropsPerDay: Math.round(b.drops / b.days * 10) / 10,
      blackBuysPerLife: Math.round(b.blackBuys / b.lives.size * 10) / 10,
    }));
    const blackOpen = samples.map((s) => ({ route: s.route, seed: s.seed, day: s.firstBlackOpen }));
    const lines = ['境界  天数  世数  进账/天  首通银  铺子凡/精  蒙面价  出售/天  掉落/天  黑市件/世'];
    for (const r of summary) {
      lines.push(`${r.realm}  ${String(r.days).padStart(4)}  ${String(r.lives).padStart(4)}  ${String(r.incomePerDay).padStart(7)}  ${String(r.clearSilver).padStart(6)}  ${String(r.stallPrice[0]).padStart(4)}/${String(r.stallPrice[1]).padEnd(5)} ${String(r.maskedPrice).padStart(6)}  ${String(r.sellPerDay).padStart(7)}  ${String(r.dropsPerDay).padStart(7)}  ${String(r.blackBuysPerLife).padStart(8)}`);
    }
    lines.push('黑市首次解锁日：' + blackOpen.map((b) => `${b.route}#${b.seed} 第 ${b.day ?? '—'} 天`).join(' · '));
    console.log(lines.join('\n'));
    writeFileSync(OUT, JSON.stringify({
      generated: new Date().toISOString().slice(0, 10),
      note: '由 code/src/telemetry/economy.sim.test.ts 生成（SIM_ECON=1）：标准玩家（穿装备、卖杂件、铺子只买比身上强的、黑市买得起就买）各天的银两进出；品阶 1–5 = ' + GRADE_NAMES.slice(1).join('/'),
      days: DAYS, seeds: SEEDS, summary, blackOpen, samples,
    }, null, 1) + '\n');
  }, 3_600_000);
});

