/**
 * 节奏守卫 —— 多天一世（pacing/design.md §2 / §5，issue #22 第 6 步）。
 *
 * 用模拟玩家驱动**真实 store** 连续玩 100 多天，量出首达境界 2–6 是第几天，对里程碑
 * （第 1 / 7 / 21 / 42 / 100 天；境界 5 由 50 改 42，pacing/design.md 裁决 25）。
 * 每条路线跑 4 个随机种子取平均：单个种子的波动约 ±4–5 天，只看一个会误报。玩家画像同 pacing_sim：每天在线 4 小时、离线 20 小时，
 * 丹田封顶、只能在线突破，寿元撑不到下次上线就推完前沿归隐（simBot.ts）。
 *
 * 为什么在代码里量：pacing_sim 是按规则推出来的数，这里用真实代码再走一遍——
 * 前沿乘数 ×1.2、名号声望、冲穴的随机、受伤养伤这些 sim 里简化掉的东西都照实发生。
 *
 * 用法：
 *   重新测量并写入记录：WRITE_PACE=1 npx vitest run src/telemetry/pace.sim.test.ts
 *   日常（CI）：各路线 4 个种子的平均首达日须落在里程碑 ±20%（至少 ±2 天）之内，否则游戏节奏已偏离设计。
 *   只跑一个种子排查：PACE_SEED=7 PACE_OUT=/tmp/x.json；模拟玩家不用武学：PACE_NO_WUXUE=1
 *
 * 为什么是 ±20%（2026-09-29 用户选定）：sim 把冲穴与武学的份额也算进了丹田封顶，真实代码里它们在线另付，
 * 前期会早到一两天；三条路线的战斗与名号声望也不同，首达境界 5 相差近一成。这两处 sim 刻画不了。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteId } from '../engine/content';
import { useGameStore } from '../store/gameStore';
import { playDay, resetBot, st } from './simBot';

const OUT = resolve(process.cwd(), '../docs/systems/sim/pace_measured.json');
const ROUTES: RouteId[] = ['huashan', 'tangmen', 'shaolin'];
const SEEDS = process.env.PACE_SEED ? [Number(process.env.PACE_SEED)] : [7, 42, 99, 2026];
/**
 * 里程碑（pacing/design.md §0）。境界 5 按实测改为第 42 天（裁决 25）：门径并入内功后机制来得早、
 * 战力与声望起得早（sect-neigong/spec.md S10）。pacing_sim 的设计锚点仍是第 50 天——sim 不刻画这两处。
 */
const MILESTONE: Record<number, number> = { 2: 1, 3: 7, 4: 21, 5: 42, 6: 100 };
const TOLERANCE = 0.20;
const MIN_SLACK_DAYS = 2;
const MAX_DAYS = 120;
/** 写记录用的真实日期（测试里时钟是假的） */
const TODAY = new Date().toISOString().slice(0, 10);

interface Sample {
  route: RouteId;
  seed: number;
  firstDay: Record<number, number>;
  lives: number;
}

/** 从第 1 天玩到首达境界 6（或 MAX_DAYS），返回各境界首达日与转世次数 */
function playLongline(route: RouteId, seed: number): Sample {
  let x = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  });
  vi.setSystemTime(Date.UTC(2026, 8, 29, 8, 0, 0));
  st().hardReset();
  useGameStore.setState({ started: true });
  st().setAutoAdvance(false);
  resetBot();
  const firstDay: Record<number, number> = {};
  for (let day = 1; day <= MAX_DAYS; day++) {
    playDay(route);
    const peak = st().peakRealm ?? 1;
    for (let r = 2; r <= peak; r++) firstDay[r] ??= day;
    if (peak >= 6) break;
  }
  vi.mocked(Math.random).mockRestore();
  return { route, seed, firstDay, lives: st().run };
}

describe('节奏守卫：真实代码的里程碑天数（多天一世）', () => {
  beforeAll(() => { vi.useFakeTimers(); });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('三条路线首达境界 2–6 的多种子平均落在里程碑 ±20%', () => {
    const samples = ROUTES.flatMap((r) => SEEDS.map((seed) => playLongline(r, seed)));
    // 各路线平均首达日（没到的按 MAX_DAYS + 1 计，必然判不过）
    const means = ROUTES.map((route) => {
      const mine = samples.filter((x) => x.route === route);
      const firstDay = Object.fromEntries(Object.keys(MILESTONE).map((k) => [k,
        Math.round(mine.reduce((a, x) => a + (x.firstDay[Number(k)] ?? MAX_DAYS + 1), 0) / mine.length * 10) / 10]));
      return { route, firstDay };
    });
    if (process.env.WRITE_PACE) {
      writeFileSync(process.env.PACE_OUT ?? OUT, JSON.stringify({
        generated: TODAY,
        note: '由 code/src/telemetry/pace.sim.test.ts 生成（WRITE_PACE=1）：真实代码的首达日（各路线 4 个种子），对照 pacing/design.md 里程碑。',
        milestone: MILESTONE,
        seeds: SEEDS,
        means,
        samples,
      }, null, 2) + '\n');
    }
    for (const s of means) {
      for (const [realm, target] of Object.entries(MILESTONE)) {
        const got = s.firstDay[Number(realm)];
        const slack = Math.max(MIN_SLACK_DAYS, Math.round(target * TOLERANCE));
        expect(got, `${s.route} 平均首达境界 ${realm}：第 ${got} 天，目标第 ${target} 天 ±${slack}`)
          .toBeGreaterThanOrEqual(target - slack);
        expect(got, `${s.route} 平均首达境界 ${realm}：第 ${got} 天，目标第 ${target} 天 ±${slack}`)
          .toBeLessThanOrEqual(target + slack);
      }
    }
  }, 1_800_000);
});
