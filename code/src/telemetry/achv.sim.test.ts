/**
 * 侠名录实测 —— 标准玩家在第 7 / 21 / 50 / 100 天各条成就线的计量（prestige-shop/design.md §2c）。
 *
 * 门槛按这份实测定：标准玩家约第 7 / 21 / 50 天摸到一二三层。与节奏守卫同一个模拟玩家（simBot.ts），
 * 三条路线各跑若干种子取中位数；九类器械线另记「本路线主修类目」的计量，其余类目多半为 0。
 * 不设判据；日常 CI 不跑（SIM_ACHV=1 才跑）。
 *
 * 用法：SIM_ACHV=1 npx vitest run src/telemetry/achv.sim.test.ts   → docs/systems/sim/achv_measured.json
 *       换种子：ACHV_SEEDS=7,42
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import type { RouteId } from '../engine/content';
import { ACHV, CAT_ACHV, achvCount, achvTier, type AchvId } from '../engine/achievements';
import { WUXUE } from '../engine/wuxue';
import { useGameStore } from '../store/gameStore';
import { playDay, resetBot, st } from './simBot';

const OUT = resolve(process.cwd(), '../docs/systems/sim/achv_measured.json');
const ROUTES: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
const SEEDS = process.env.ACHV_SEEDS ? process.env.ACHV_SEEDS.split(',').map(Number) : [7, 42];
const DAYS = [7, 21, 50, 100];

type Snap = Record<AchvId, { count: number; tier: number }>;

function snap(): Snap {
  const s = st();
  return Object.fromEntries(ACHV.map((a) => [a.id, { count: achvCount(s, a.id), tier: achvTier(s, a.id) }])) as Snap;
}

function play(route: RouteId, seed: number) {
  let x = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  });
  st().hardReset();
  useGameStore.setState({ started: true });
  resetBot();
  const out: Record<number, Snap> = {};
  for (let day = 1; day <= DAYS[DAYS.length - 1]; day++) {
    playDay(route);
    if (DAYS.includes(day)) out[day] = snap();
  }
  // 主修类目：一世末装配首位武学的类目
  const main = (st().equipped ?? [])[0];
  const mainCat = main ? CAT_ACHV[WUXUE[main].cat] : null;
  vi.mocked(Math.random).mockRestore();
  return { route, seed, mainCat, days: out };
}

describe.skipIf(!process.env.SIM_ACHV)('侠名录实测（SIM_ACHV=1）', () => {
  beforeAll(() => { vi.useFakeTimers(); });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('三条路线第 7 / 21 / 50 / 100 天的计量与层', () => {
    const samples = ROUTES.flatMap((r) => SEEDS.map((seed) => play(r, seed)));
    writeFileSync(process.env.ACHV_OUT ?? OUT, JSON.stringify({
      generated: new Date().toISOString().slice(0, 10),
      note: '由 code/src/telemetry/achv.sim.test.ts 生成（SIM_ACHV=1）：标准玩家各成就线的计量与层；门槛按「第 7 / 21 / 50 天摸到一二三层」标定。',
      seeds: SEEDS,
      samples,
    }, null, 2) + '\n');
  }, 3_600_000);
});
