/**
 * 世时长实测 —— 转世年岁速率的标定输入（reincarnation/spec.md §2.2）。
 *
 * 为什么在代码里量、不在 mvp0_sim 里算：年岁速率 = 一世典型跨度 ÷ 典型世时长。旧速率 1.322
 * 的世时长取自 mvp0_sim，它早于周天 v4.0（冲穴耗内力）与受伤系统（压产出、要养伤），
 * 实际节奏已慢得多。这里用模拟玩家驱动**真实 store** 连续玩多世，量出的才是当前游戏的节奏。
 *
 * 画像：三条路线 × 三个随机种子 × 连续六世；每世推到标准归隐点（境界 5 + 击败黑风寨主）即归隐，
 * 世间按 mvp0_sim 的贪心顺序购买声望节点。测量期间冻结年岁——只量节奏，不让寿元截断测量。
 *
 * 用法：
 *   重新测量并写入标定输入：WRITE_PACE=1 npx vitest run src/telemetry/pace.sim.test.ts
 *   日常（CI）：对比实测与 pace_measured.json，中位数偏离 >10% 即失败——游戏节奏变了，须重标定。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteId } from '../engine/content';
import type { RepNodeId } from '../engine/prestige';
import { INIT_AGE } from '../engine/reincarnation';
import { nextStageOf, retireKind, useGameStore } from '../store/gameStore';
import { advance, pushMap, reachRealm, setAfterTick, st } from './simBot';

const OUT = resolve(process.cwd(), '../docs/systems/sim/pace_measured.json');
const ROUTES: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
const SEEDS = [42, 7, 2026];
const LIVES = 6;
/** 与 mvp0_sim.GREEDY_SHOP_ORDER 一致 */
const SHOP: RepNodeId[] = [
  'jiumeng_chongwen', 'kuaisu_rumen', 'poguan_xinde', 'jianghu_shulu',
  'shimen_zhiyin', 'wudao_biji', 'zairu_jianghu', 'qingzhuang_shanglu',
];
const DRIFT_TOLERANCE = 0.10;

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}

/** 玩一世到标准归隐点，返回活跃分钟数 */
function playOneLife(route: RouteId): number {
  st().setAutoAdvance(false);
  advance(30);
  reachRealm(2, route);
  pushMap(1, route);
  pushMap(2, route);
  pushMap(3, route);
  reachRealm(5, route);
  if (nextStageOf(3, st().clearedStages) !== null) pushMap(3, route);
  const kind = retireKind(st());
  if (kind !== 'standard') {
    throw new Error(`${route} 未到标准归隐点：境界 ${st().realm}，归隐形态 ${String(kind)}`);
  }
  return st().runPlaySec / 60;
}

function retireAndShop(): void {
  st().openRetire();
  st().proceedRetire();
  st().confirmRetire();
  st().closeRetireCeremony();
  for (const id of SHOP) st().buyRepNode(id);
}

interface Measured {
  generated: string;
  note: string;
  samples: { route: RouteId; seed: number; lives: number[] }[];
  firstLifeMinutes: number[];
  allLifeMinutes: number[];
  medianMinutes: number;
}

describe('世时长实测（转世年岁速率标定输入）', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    // 冻结年岁：只量节奏，不让寿元截断测量
    setAfterTick(() => { if ((st().age ?? INIT_AGE) > INIT_AGE + 30) useGameStore.setState({ age: INIT_AGE }); });
  });
  afterAll(() => {
    setAfterTick(() => {});
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('三路线 × 三种子 × 六世', () => {
    const samples: Measured['samples'] = [];
    for (const route of ROUTES) {
      for (const seed of SEEDS) {
        let x = seed;
        vi.spyOn(Math, 'random').mockImplementation(() => {
          x = (x * 1664525 + 1013904223) >>> 0;
          return x / 2 ** 32;
        });
        vi.setSystemTime(Date.UTC(2026, 8, 24, 9, 0, 0));
        st().hardReset();
        const lives: number[] = [];
        for (let i = 0; i < LIVES; i++) {
          lives.push(Math.round(playOneLife(route) * 10) / 10);
          retireAndShop();
        }
        samples.push({ route, seed, lives });
        vi.mocked(Math.random).mockRestore();
      }
    }
    const firstLifeMinutes = samples.map((s) => s.lives[0]);
    const allLifeMinutes = samples.flatMap((s) => s.lives);
    const measured: Measured = {
      generated: new Date().toISOString().slice(0, 10),
      note: '由 code/src/telemetry/pace.sim.test.ts 生成（WRITE_PACE=1）。reincarnation_sim.py 读本文件反解年岁速率。',
      samples, firstLifeMinutes, allLifeMinutes,
      medianMinutes: median(allLifeMinutes),
    };

    if (process.env.WRITE_PACE) {
      writeFileSync(OUT, JSON.stringify(measured, null, 2) + '\n');
      return;
    }
    expect(existsSync(OUT), '缺标定输入，先跑 WRITE_PACE=1').toBe(true);
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Measured;
    const drift = Math.abs(measured.medianMinutes - saved.medianMinutes) / saved.medianMinutes;
    expect(
      drift,
      `世时长中位数 ${measured.medianMinutes} 分钟，标定时为 ${saved.medianMinutes}——游戏节奏已变，须重标定年岁速率`,
    ).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });
});
