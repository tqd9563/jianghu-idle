/**
 * 会话模拟器：假时钟 + 种子随机驱动真实 store 完整走完「两世 + 归隐」（多天一世的标准玩家，simBot.ts），
 * 产出观察员导出格式的样例文件，供 sim/analyze_telemetry.py 自验（埋点规格 §4 验收清单）。
 * 确定性：Date 假时钟固定起点 + Math.random LCG 种子 → 每次运行产出逐字节一致。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import { trackLength } from '../engine/enemies';
import { nextStageOf, useGameStore } from '../store/gameStore';
import { exportTelemetryJSON, getEvents } from './telemetry';
import { advance, challenge, login, offline, online, pushFronts, resetBot, setAfterTick, st } from './simBot';

const OUT_DIR = resolve(process.cwd(), '../code/test-output');
const T0 = Date.UTC(2026, 6, 6, 9, 0, 0);

/**
 * 本样例画像是「正常玩到归隐」，不该发生强制转世。一旦发生就立刻报错而不是让脚本空转：
 * 转世会把境界打回 1，「推到境界 N」的循环将永远到不了，测试直接挂死。
 */
function assertNoForcedRebirth() {
  const ev = getEvents().find((e) => e.e === 'forced_reincarnation');
  if (ev) {
    throw new Error(
      `样例玩家在第 ${ev.run} 世被迫转世：死因 ${String(ev.cause)}，${String(ev.age_at_death)} 岁，` +
      `已活 ${Math.round(Number(ev.run_duration_s) / 60)} 分钟，折寿 ${String(ev.lifespan_lost)} 年。` +
      '年岁速率与实际游玩节奏不匹配，见 reincarnation/spec.md §2.2',
    );
  }
}

const R = 'tangmen' as const;

function exportFile(testerId: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  const json = exportTelemetryJSON({
    tester_id: testerId, build: BUILD, tables_version: TABLES_VERSION, telemetry_spec: TELEMETRY_SPEC,
  });
  writeFileSync(resolve(OUT_DIR, `mvp0_${testerId}_sample.json`), json);
}

describe('会话模拟器 · 产出 analyze_telemetry.py 自验样例', () => {
  beforeAll(() => {
    setAfterTick(assertNoForcedRebirth);
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    let seed = 42;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });
  });
  afterAll(() => {
    setAfterTick(() => {});
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('T90：完整两世（第 2 天上线归隐 + 第二世推回图 1 Boss），含 2 分钟暂停验收案例', () => {
    st().hardReset();
    useGameStore.setState({ started: true });
    resetBot();
    st().startSession('T90');
    st().setAutoAdvance(false);

    // 第一世第 1 天：在线 4 小时入境界 2、择路唐门，推图 1
    online(R);
    pushFronts();
    // 埋点规格 §4 验收：一次人工 2 分钟暂停，净时间必须被扣除
    st().pauseSession();
    advance(120);
    st().resumeSession();
    offline();

    // 第 2 天上线：寿元撑不到明天（阶段 2 一世一天），推完前沿归隐，买传承与修行感悟
    login(R);
    expect(st().run).toBe(2);

    // 第二世：在线 4 小时，推到图 1 初入的 Boss（首次挑战即算抵达，胜负不论）
    online(R);
    pushFronts();
    const boss = trackLength(1, 0);
    if (nextStageOf(1, 0, st().clearedStages) === boss) challenge(1, 0, boss);
    st().endSession('completed');

    const names = getEvents().map((e) => e.e);
    expect(names).toContain('retire_confirmed');
    expect(names).toContain('test_paused');
    expect(names).toContain('test_resumed');
    expect(getEvents().some((e) => e.e === 'run_start' && e.run === 2)).toBe(true);
    expect(getEvents().some((e) => e.e === 'key_battle_end' && e.run === 2)).toBe(true);
    const retire = getEvents().find((e) => e.e === 'retire_confirmed')!;
    expect(retire.kind).toBe('standard');
    exportFile('T90');
  });

  it('T91：设计脱落（图 1 卡关放弃，未归隐）', () => {
    st().hardReset(); // 同时清空埋点缓冲，开始新测试者
    useGameStore.setState({ started: true });
    resetBot();
    st().startSession('T91');
    st().setAutoAdvance(false);
    online(R, 1);
    pushFronts({ stopAfterFirstLoss: true });
    // 纯重试三次（不做任何调整）→ §10.2「无脑连点」信号
    for (let i = 0; i < 3; i++) {
      const next = nextStageOf(1, 0, st().clearedStages);
      if (next === null) break;
      challenge(1, 0, next);
      advance(6);
    }
    st().endSession('design_dropout');

    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(false);
    expect(getEvents().find((e) => e.e === 'test_session_end')!.reason).toBe('design_dropout');
    exportFile('T91');
  });
});
