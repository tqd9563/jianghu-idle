/**
 * 离线收益测试 —— 覆盖 docs/rules/offline-rewards.md §1.3（A1/A3/A5/A6）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSavedAt, saveGame, setDebugOfflineCap } from '../save/storage';
import { useGameStore } from '../store/gameStore';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import {
  calculateOfflineRewards, findOfflineRewardStage, getEffectiveOfflineMinutes,
  maxIdleStage, OFFLINE_REWARD_STAGES, shouldShowOfflineSettlement,
} from './offlineRewards';

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

  it('maxIdleStage：全局 1–28 序号（图 1 有 8 关、图 2 有 10 关偏移）', () => {
    expect(maxIdleStage([])).toBe(1);
    expect(maxIdleStage(['m1s1', 'm1s2'])).toBe(2);
    expect(maxIdleStage(Array.from({ length: 8 }, (_, i) => `m1s${i + 1}`))).toBe(8);
    expect(maxIdleStage(['m1s8', 'm2s3'])).toBe(11);
    expect(maxIdleStage(['m2s10', 'm3s10'])).toBe(28);
  });

  it('maxIdleStage：地图 4/5 键映射为全局 29–48，忽略越界关卡', () => {
    expect(maxIdleStage(['m4s1'])).toBe(29);
    expect(maxIdleStage(['m4s10'])).toBe(38);
    expect(maxIdleStage(['m5s1'])).toBe(39);
    expect(maxIdleStage(['m5s10'])).toBe(48);
    expect(maxIdleStage(['m5s11', 'm4s0'])).toBe(1);
  });
});

describe('offlineRewards · MVP-2 地图 4/5 扩展', () => {
  it.each([[29, 826.8], [38, 826.8], [39, 1033.7], [48, 1033.7]])(
    '关卡 %i 的 50%%效率产出为 %f 内力/分',
    (stage, expectedOfflineNeiliPerMin) => {
      const tier = findOfflineRewardStage(stage);
      expect(tier.offlineEfficiency).toBe(0.50);
      expect(tier.neiliPerMin * tier.offlineEfficiency).toBeCloseTo(expectedOfflineNeiliPerMin, 10);
    },
  );

  it.each([29, 38, 39, 48])('关卡 %i 的正式离线上限保持 8 小时', (stage) => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: stage, lastSeenAt: 0, now: 10 * 60 * MIN });
    expect(r.capMin).toBe(480);
    expect(r.effectiveMin).toBe(480);
    expect(r.capped).toBe(true);
    expect(r.neili).toBe(Math.floor(r.tier.neiliPerMin * 480 * 0.50));
  });
});

describe('offlineRewards · A1 结算链路对账（满额校验表 §3.3 逐格）', () => {
  // [档位代表关卡, 满额内力, 满额银两, 满额阅历]
  // 口径：§2.1 主公式 floor 真值。§3.3 校验表为四舍五入粗算，4 格差 1（75→74/1822→1821/111→110/2621→2620），
  // 以主公式为权威（验收文档 A1 注记同口径）。
  const FULL: Array<[number, number, number, number]> = [
    [1, 630, 28, 4], [5, 840, 42, 6], [9, 1159, 59, 8], [13, 1421, 74, 10],
    [19, 1821, 95, 13], [23, 2138, 110, 15], [26, 2620, 133, 19], [28, 2995, 166, 23],
  ];
  it.each(FULL)('关卡 %i 满额 = %i 内力 / %i 银两 / %i 阅历', (stage, neili, silver, xp) => {
    const tier = findOfflineRewardStage(stage);
    const r = calculateOfflineRewards({
      currentMaxIdleStage: stage, lastSeenAt: 0, now: tier.offlineCapMin * MIN,
    });
    expect([r.neili, r.silver, r.xp]).toEqual([neili, silver, xp]);
    expect(r.capped).toBe(true);
  });

  it('部分时长：构成因子可核对（时长 × 速率 × 效率，floor）', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 10 * MIN });
    expect(r.effectiveMin).toBe(10);
    expect(r.neili).toBe(Math.floor(90 * 10 * 0.35)); // 315
    expect(r.silver).toBe(Math.floor(4 * 10 * 0.35)); // 14
    expect(r.xp).toBe(Math.floor(0.6 * 10 * 0.35)); // 2
    expect(r.capped).toBe(false);
  });

  it('红线：既有 8 档满额内力 ≤ 4,200（境界 5 单段周天充能，§3.3 预算线）', () => {
    for (const t of OFFLINE_REWARD_STAGES.slice(0, 8)) {
      expect(Math.floor(t.neiliPerMin * t.offlineCapMin * t.offlineEfficiency)).toBeLessThanOrEqual(4200);
    }
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
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 100 * MIN, now: 0 });
    expect(r.rawSec).toBe(0);
    expect([r.neili, r.silver, r.xp]).toEqual([0, 0, 0]);
  });

  it('A6：前拨一年 → 按上限截断（clamp_to_cap），发放不超满额', () => {
    const r = calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 365 * 24 * 60 * MIN });
    expect(r.effectiveMin).toBe(20);
    expect(r.neili).toBe(630);
  });

  it('A4 调试覆盖：capOverrideMin=10 生效且 debug_cap 位裸露；长离线不误判静默', () => {
    const r = calculateOfflineRewards({
      currentMaxIdleStage: 1, lastSeenAt: 0, now: 60 * MIN, capOverrideMin: 10,
    });
    expect(r.effectiveMin).toBe(10);
    expect(r.debugCap).toBe(true);
    expect(r.silent).toBe(false);
  });
});

describe('offlineRewards · A5 最小结算阈值', () => {
  it('原始离线 < 180s 静默入账（silent），≥180s 弹出出关结算', () => {
    expect(calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 179_000 }).silent).toBe(true);
    expect(calculateOfflineRewards({ currentMaxIdleStage: 1, lastSeenAt: 0, now: 180_000 }).silent).toBe(false);
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

  function reopenAfter(offlineMs: number) {
    // 模拟关页：persist 已由 hardReset/动作写盘（savedAt = 当前假时钟），前拨时钟后重新 init
    vi.setSystemTime(Date.now() + offlineMs);
    useGameStore.setState({ started: false, offlineSettlement: null });
    useGameStore.getState().init();
  }

  it('出关结算只发三资源；埋点与 store 入账同源同值（A1 三处同源的引擎/埋点两处）', () => {
    const before = useGameStore.getState();
    expect(before.dantian).toBe(0);
    reopenAfter(10 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(315);
    expect(s.silver).toBe(14);
    expect(s.xp).toBe(2);
    const ev = getEvents().find((e) => e.e === 'offline_settled')!;
    expect(ev).toBeDefined();
    expect([ev.neili, ev.silver, ev.xp]).toEqual([315, 14, 2]);
    expect(ev.silent).toBe(false);
    expect(s.offlineSettlement).not.toBeNull();
  });

  it('A2 决策保留：不自动突破/不推进关卡/不动停滞计时；除资源外状态与离线前一致', () => {
    useGameStore.setState({ dantian: 2700, runPlaySec: 500, lastProgressSec: 100 });
    useGameStore.getState().setAutoAdvance(true); // 触发 persist，写入上述状态
    reopenAfter(20 * MIN); // 满额 630 → 丹田 3330 ≥ 突破 2800，但绝不自动扣款
    const s = useGameStore.getState();
    expect(s.dantian).toBe(2700 + 630);
    expect(s.realm).toBe(1); // 不自动突破
    expect(s.clearedStages).toEqual([]); // 不推进关卡
    expect(s.runPlaySec).toBe(500); // 活跃秒不计离线（A7 口径隔离）
    expect(s.lastProgressSec).toBe(100); // 保底停滞计时不动
  });

  it('consume_timestamp_once：结算后立即刷新 savedAt，重复 init 不双重结算（A5）', () => {
    reopenAfter(10 * MIN);
    expect(useGameStore.getState().dantian).toBe(315);
    const savedAt = loadSavedAt()!;
    expect(Math.abs(savedAt - Date.now())).toBeLessThan(1000); // 时间戳已消费
    // 立即再次重开（<5s 热刷新下界）：不入账、不再发事件
    useGameStore.setState({ started: false, offlineSettlement: null });
    useGameStore.getState().init();
    expect(useGameStore.getState().dantian).toBe(315);
    expect(getEvents().filter((e) => e.e === 'offline_settled')).toHaveLength(1);
  });

  it('短离线（<180s）静默入账：资源到账但不弹结算屏', () => {
    reopenAfter(2 * MIN);
    const s = useGameStore.getState();
    expect(s.dantian).toBe(Math.floor(90 * 2 * 0.35)); // 63
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
      expect(s.dantian).toBe(Math.floor(90 * 10 * 0.35) * i); // 315 × i，逐次累计不串账
      const evs = getEvents().filter((e) => e.e === 'offline_settled');
      expect(evs).toHaveLength(i);
      expect(evs[i - 1].capped).toBe(true);
      expect(evs[i - 1].debug_cap).toBe(true);
      useGameStore.getState().dismissOfflineSettlement();
    }
  });
});
