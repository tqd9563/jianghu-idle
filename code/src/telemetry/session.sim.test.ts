/**
 * 会话模拟器：假时钟 + 种子随机驱动真实 store 完整走完「两轮 + 归隐」，
 * 产出观察员导出格式的样例文件，供 sim/analyze_telemetry.py 自验（埋点规格 §4 验收清单）。
 * 确定性：Date 假时钟固定起点 + Math.random LCG 种子 → 每次运行产出逐字节一致。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import { nextStageOf } from '../store/gameStore';
import { exportTelemetryJSON, getEvents } from './telemetry';
import { advance, challenge, pushMap, reachRealm, setAfterTick, st } from './simBot';

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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('T90：完整两轮（标准归隐 + 二轮到 Boss 2），含 2 分钟暂停验收案例', () => {
    st().hardReset();
    st().startSession('T90');
    st().setAutoAdvance(false);
    advance(30);

    // 第一轮：境界 2 → 择路唐门 → 推图（含 Boss 2 首败与调整重试的真实链路）
    reachRealm(2, R);
    pushMap(1, R);
    // 埋点规格 §4 验收：一次人工 2 分钟暂停，净时间必须被扣除
    st().pauseSession();
    advance(120);
    st().resumeSession();
    pushMap(2, R);
    pushMap(3, R);
    // 推到标准归隐门槛（境界 5）即收手。此处原写 reachRealm(REALMS.length)：写于境界只有 5 个时，
    // MVP-2 扩到 7 个后含义悄悄变成「深推到境界 7」——那正是寿元要惩罚的贪命路径，不是本样例画像。
    reachRealm(5, R);
    if (nextStageOf(3, st().clearedStages) !== null) pushMap(3, R);

    // 归隐：预览 → 确认 → 30 秒内首购（§8.6-4）
    advance(40); // 归隐犹豫
    st().openRetire();
    advance(8);
    st().proceedRetire();
    advance(5);
    st().confirmRetire();
    st().closeRetireCeremony();
    advance(10);
    st().buyRepNode('jiumeng_chongwen');
    advance(5);
    st().buyRepNode('kuaisu_rumen');

    // 第二轮：更快抵达 Boss 2（首次挑战即算抵达，胜负不论）
    advance(15);
    reachRealm(2, R);
    pushMap(1, R);
    reachRealm(3, R);
    pushMap(2, R, { stopAfterFirstBossAttempt: true });
    st().endSession('completed');

    const names = getEvents().map((e) => e.e);
    expect(names).toContain('retire_confirmed');
    expect(names).toContain('test_paused');
    expect(names).toContain('test_resumed');
    expect(getEvents().some((e) => e.e === 'run_start' && e.run === 2)).toBe(true);
    expect(getEvents().some((e) => e.e === 'key_battle_end' && e.target === 'boss2' && e.run === 2)).toBe(true);
    const retire = getEvents().find((e) => e.e === 'retire_confirmed')!;
    expect(retire.kind).toBe('standard');
    exportFile('T90');
  });

  it('T91：设计脱落（Boss 2 卡死放弃，未归隐）', () => {
    st().hardReset(); // 同时清空埋点缓冲，开始新测试者
    st().startSession('T91');
    st().setAutoAdvance(false);
    advance(30);
    reachRealm(2, R);
    pushMap(1, R);
    pushMap(2, R, { stopAfterFirstBossAttempt: true });
    // 纯重试三次（不做任何调整）→ §10.2「无脑连点」信号
    for (let i = 0; i < 3; i++) {
      const next = nextStageOf(2, st().clearedStages);
      if (next === null) break;
      challenge(2, next);
      advance(6);
    }
    st().endSession('design_dropout');

    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(false);
    expect(getEvents().find((e) => e.e === 'test_session_end')!.reason).toBe('design_dropout');
    exportFile('T91');
  });
});
