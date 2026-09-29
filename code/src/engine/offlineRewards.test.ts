/**
 * 离线收益测试 —— 覆盖 docs/rules/offline-rewards.md §1.3（A1/A3/A5/A6）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSavedAt, saveGame, setDebugOfflineCap } from '../save/storage';
import { useGameStore } from '../store/gameStore';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import {
  OFFLINE_CAP_MIN, calculateOfflineRewards, findOfflineRewardStage, getEffectiveOfflineMinutes,
  maxIdleStage, shouldShowOfflineSettlement,
} from './offlineRewards';
import { stageKey, trackLength } from './enemies';

const MIN = 60_000;

describe('offlineRewards · 档位匹配与驱动字段（表 A §2.2）', () => {
  it('按最大可挂机关卡匹配 8 档，边界闭区间', () => {
    expect(findOfflineRewardStage(1).id).toBe(1001);
    expect(findOfflineRewardStage(4).id).toBe(1001);
    expect(findOfflineRewardStage(5).id).toBe(1002);
    expect(findOfflineRewardStage(12).id).toBe(1003);
    expect(findOfflineRewardStage(13).id).toBe(1004);
    expect(findOfflineRewardStage(28).id).toBe(1008);
  });

  it('地图 4/5 的全局关卡 29–48 分别匹配扩展档', () => {
    for (let stage = 29; stage <= 38; stage++) {
      expect(findOfflineRewardStage(stage).id).toBe(1009);
    }
    for (let stage = 39; stage <= 48; stage++) {
      expect(findOfflineRewardStage(stage).id).toBe(1010);
    }
  });

  it('越界 clamp：0 → 首档；>48 → 末档', () => {
    expect(findOfflineRewardStage(0).id).toBe(1001);
    expect(findOfflineRewardStage(99).id).toBe(1010);
  });

  it('maxIdleStage：按最深「初入」地图及进度比例折回表 A 全局序号（旧图 1 八关、其余十关）', () => {
    expect(maxIdleStage([])).toBe(1);
    const n1 = trackLength(1, 0);
    expect(maxIdleStage([stageKey(1, 0, n1)])).toBe(8);
    expect(maxIdleStage([stageKey(1, 0, n1), stageKey(2, 0, trackLength(2, 0))])).toBe(18);
    expect(maxIdleStage([stageKey(4, 0, trackLength(4, 0))])).toBe(38);
    // 只看初入：历练 / 绝境与非法键不计
    expect(maxIdleStage([stageKey(1, 1, 5), 'm1s8', 'bogus'])).toBe(1);
  });
});

describe('offlineRewards · v2.0 长线规则（offline-rewards.md §1.1）', () => {
  const RATE = 669; // 第 35 天境界 4 的在线速率（内力/秒，含乘区）

  it('离线内力 = 在线速率 × 有效分钟 × 60 × 60%', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 10 * MIN, neiliPerSec: RATE });
    expect(r.effectiveMin).toBe(10);
    expect(r.efficiency).toBe(0.60);
    expect(r.neili).toBe(Math.floor(RATE * 60 * 10 * 0.60));
  });

  it('银两 / 阅历沿用表 A 档位 × 60%', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 10 * MIN, neiliPerSec: RATE });
    expect(r.silver).toBe(Math.floor(4 * 10 * 0.60));
    expect(r.xp).toBe(Math.floor(0.6 * 10 * 0.60));
  });

  it('上限 24 小时，与关卡档位无关', () => {
    for (const stage of [1, 28, 48]) {
      const r = calculateOfflineRewards({ currentMaxIdleStage: stage, lastSeenAt: 0, now: 30 * 60 * MIN, neiliPerSec: RATE });
      expect(r.capMin).toBe(OFFLINE_CAP_MIN);
      expect(r.effectiveMin).toBe(1440);
      expect(r.capped).toBe(true);
    }
  });

  it('20 小时离线折合 12 小时在线（标准一天 4 + 20 × 60% = 16 小时）', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 20 * 60 * MIN, neiliPerSec: 1 });
    expect(r.neili).toBe(Math.floor(20 * 3600 * 0.60));
  });
});

describe('offlineRewards · A3 触顶 / A6 时钟边界（表 C 策略）', () => {
  it('A3：超上限截断到 cap，不溢出；恰达上限即触顶', () => {
    const { effectiveMin, capped } = getEffectiveOfflineMinutes(0, 8 * 60 * MIN, 20);
    expect(effectiveMin).toBe(20);
    expect(capped).toBe(true);
    expect(getEffectiveOfflineMinutes(0, 19 * MIN, 20).capped).toBe(false);
  });

  it('A6：时钟回拨 → 0 处理（zero_reward），不为负不崩溃', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 100 * MIN, now: 0, neiliPerSec: 9 });
    expect(r.rawSec).toBe(0);
    expect([r.neili, r.silver, r.xp]).toEqual([0, 0, 0]);
  });

  it('A6：前拨一年 → 按上限截断（clamp_to_cap），发放不超满额', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 365 * 24 * 60 * MIN, neiliPerSec: 9 });
    expect(r.effectiveMin).toBe(1440);
    expect(r.neili).toBe(Math.floor(9 * 60 * 1440 * 0.60));
  });

  it('A4 调试覆盖：capOverrideMin=10 生效且 debug_cap 位裸露；长离线不误判静默', () => {
    const r = calculateOfflineRewards({
      currentMaxIdleStage: 1, lastSeenAt: 0, now: 60 * MIN, capOverrideMin: 10, neiliPerSec: 9,
    });
    expect(r.effectiveMin).toBe(10);
    expect(r.debugCap).toBe(true);
    expect(r.silent).toBe(false);
  });
});

describe('offlineRewards · A5 最小结算阈值', () => {
  it('原始离线 < 180s 静默入账（silent），≥180s 弹出出关结算', () => {
    expect(calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 179_000, neiliPerSec: 9 }).silent).toBe(true);
    expect(calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 180_000, neiliPerSec: 9 }).silent).toBe(false);
    expect(shouldShowOfflineSettlement(3, 3)).toBe(true);
    expect(shouldShowOfflineSettlement(2.9, 3)).toBe(false);
  });
});

describe('offlineRewards · store 集成（init 结算：A2 决策保留 + consume_timestamp_once）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().hardReset();
    resetTelemetry();
    setDebugOfflineCap(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    setDebugOfflineCap(null);
  });

  /** 新手（境界 1、乘区 1）离线 min 分钟的内力：9/秒 × 60 × min × 60% */
  const OFF = (min: number) => Math.floor(9 * 60 * min * 0.60);

  function reopenAfter(offlineMs: number) {
    // 模拟关页：persist 已由 hardReset/动作写盘（savedAt = 当前假时钟），前拨时钟后重新 init
    vi.setSystemTime(Date.now() + offlineMs);
    useGameStore.setState({ started: false, offlineSettlement: null });
    useGameStore.getState().init();
  }

  it('出关结算发内力与银两（阅历冻结）；埋点与 store 入账同源同值（A1 三处同源的引擎/埋点两处）', () => {
    const before = useGameStore.getState();
    expect(before.dantian).toBe(0);
    reopenAfter(10 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(OFF(10));
    expect(s.silver).toBe(Math.floor(4 * 10 * 0.60));
    expect(s.xp).toBe(0); // 阅历冻结（sect-neigong/spec.md §4.4）：离线不再入账
    const ev = getEvents().find((e) => e.e === 'offline_settled')!;
    expect(ev).toBeDefined();
    expect([ev.neili, ev.silver]).toEqual([s.dantian, s.silver]);
    expect(ev).not.toHaveProperty('xp');
    expect(ev.silent).toBe(false);
    expect(s.offlineSettlement).not.toBeNull();
  });

  it('A2 决策保留：不自动突破/不推进关卡/不动停滞计时；除资源外状态与离线前一致', () => {
    useGameStore.setState({ dantian: 2700, runPlaySec: 500, lastProgressSec: 100 });
    useGameStore.getState().setAutoAdvance(true); // 触发 persist，写入上述状态
    reopenAfter(20 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(2700 + OFF(20));
    expect(s.realm).toBe(1); // 不自动突破
    expect(s.clearedStages).toEqual([]); // 不推进关卡
    expect(s.runPlaySec).toBe(500); // 活跃秒不计离线（A7 口径隔离）
    expect(s.lastProgressSec).toBe(100); // 进展计时不动
  });

  it('consume_timestamp_once：结算后立即刷新 savedAt，重复 init 不双重结算（A5）', () => {
    reopenAfter(10 * MIN);
    expect(useGameStore.getState().dantian).toBe(OFF(10));
    const savedAt = loadSavedAt()!;
    expect(Math.abs(savedAt - Date.now())).toBeLessThan(1000); // 时间戳已消费
    // 立即再次重开（<5s 热刷新下界）：不入账、不再发事件
    useGameStore.setState({ started: false, offlineSettlement: null });
    useGameStore.getState().init();
    expect(useGameStore.getState().dantian).toBe(OFF(10));
    expect(getEvents().filter((e) => e.e === 'offline_settled')).toHaveLength(1);
  });

  it('短离线（<180s）静默入账：资源到账但不弹结算屏', () => {
    reopenAfter(2 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(OFF(2));
    expect(s.offlineSettlement).toBeNull();
    expect(getEvents().find((e) => e.e === 'offline_settled')!.silent).toBe(true);
  });

  it('观察员暂停中的存档：离线不结算（冻结口径），时间戳照常消费', () => {
    useGameStore.getState().startSession('T99');
    useGameStore.getState().pauseSession();
    reopenAfter(30 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(0);
    expect(getEvents().find((e) => e.e === 'offline_settled')).toBeUndefined();
  });

  it('A6 时钟回拨（savedAt 在未来）：0 处理，不入账不崩溃', () => {
    saveGame({}); // savedAt = 假时钟当前
    vi.setSystemTime(Date.now() - 60 * MIN); // 回拨 1 小时
    useGameStore.setState({ started: false });
    useGameStore.getState().init();
    expect(useGameStore.getState().dantian).toBe(0);
    expect(getEvents().find((e) => e.e === 'offline_settled')).toBeUndefined();
  });

  it('A4：调试上限压低 + 触顶→结算→再触顶多次循环，每次独立正确无串账', () => {
    setDebugOfflineCap(10);
    for (let i = 1; i <= 3; i++) {
      reopenAfter(60 * MIN); // 每次离线 1h，压至 10 分钟上限
      const s = useGameStore.getState();
      expect(s.dantian).toBe(OFF(10) * i); // 逐次累计不串账
      const evs = getEvents().filter((e) => e.e === 'offline_settled');
      expect(evs).toHaveLength(i);
      expect(evs[i - 1].capped).toBe(true);
      expect(evs[i - 1].debug_cap).toBe(true);
      useGameStore.getState().dismissOfflineSettlement();
    }
  });
});
