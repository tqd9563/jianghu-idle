/**
 * 门派实测 —— 每世在门派里待几天（门派改造数值的输入；sect-overhaul/design.md §4 §5）。
 *
 * 用模拟玩家（simBot）驱动真实 store 连续玩 SECT_DAYS 天，按天记：第几世、境界、是否已拜入、贡献余额。
 * 六级地位与六档差事的推演不在这里做（尚未实装）——它只量「一世在门派里有几天、落在第几天」，
 * 门槛与价格由 docs/systems/sim/sect_rank_sim.py 拿这份实测倒推。日常 CI 不跑（SIM_SECT=1 才跑）。
 *
 * 用法：SIM_SECT=1 npx vitest run src/telemetry/sectLife.sim.test.ts   → docs/systems/sim/sect_life_measured.json
 *       SECT_DAYS=120 SECT_SEEDS=7 SECT_ROUTES=huashan 可改天数 / 种子 / 路线
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import type { RouteId } from '../engine/content';
import { useGameStore } from '../store/gameStore';
import { playDay, resetBot, st } from './simBot';

const OUT = resolve(process.cwd(), '../docs/systems/sim/sect_life_measured.json');
const ROUTES = (process.env.SECT_ROUTES ? process.env.SECT_ROUTES.split(',') : ['huashan', 'shaolin']) as RouteId[];
const SEEDS = process.env.SECT_SEEDS ? process.env.SECT_SEEDS.split(',').map(Number) : [7, 42];
const DAYS = Number(process.env.SECT_DAYS ?? 200);

interface DayRow { day: number; run: number; realm: number; sect: string | null; contrib: number }
interface Life { run: number; startDay: number; days: number; sectDays: number; realmStart: number; realmEnd: number; joinDay: number | null }
interface Sample { route: RouteId; seed: number; days: DayRow[]; lives: Life[] }

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
  const days: DayRow[] = [];
  for (let day = 1; day <= DAYS; day++) {
    playDay(route);
    const s = st();
    days.push({ day, run: s.run, realm: s.realm, sect: s.sect, contrib: s.contrib ?? 0 });
  }
  vi.mocked(Math.random).mockRestore();
  const lives: Life[] = [];
  for (const d of days) {
    let L = lives[lives.length - 1];
    if (!L || L.run !== d.run) { L = { run: d.run, startDay: d.day, days: 0, sectDays: 0, realmStart: d.realm, realmEnd: d.realm, joinDay: null }; lives.push(L); }
    L.days += 1; L.realmEnd = d.realm;
    if (d.sect !== null) { L.sectDays += 1; L.joinDay ??= d.day; }
  }
  return { route, seed, days, lives };
}

describe.skipIf(!process.env.SIM_SECT)('门派实测：每世在门派里待几天（SIM_SECT=1）', () => {
  beforeAll(() => { vi.useFakeTimers(); });
  afterAll(() => { vi.useRealTimers(); });

  it('记录各世的门派天数', () => {
    const samples: Sample[] = [];
    for (const route of ROUTES) for (const seed of SEEDS) samples.push(play(route, seed));
    const out = {
      generated: new Date().toISOString().slice(0, 10),
      note: `由 code/src/telemetry/sectLife.sim.test.ts 生成（SIM_SECT=1）：标准玩家（每天在线 4 小时）各世的天数与门派天数，${DAYS} 天`,
      days: DAYS, seeds: SEEDS, routes: ROUTES,
      samples: samples.map((s) => ({ route: s.route, seed: s.seed, lives: s.lives, days: s.days })),
    };
    writeFileSync(OUT, JSON.stringify(out));
    for (const s of samples) {
      const inSect = s.lives.filter((L) => L.sectDays > 0);
      console.log(`${s.route} seed ${s.seed}: ${s.lives.length} 世，入过门派 ${inSect.length} 世，门派天数 ${inSect.map((L) => L.sectDays).join(',')}`);
    }
  }, 6_000_000);
});
