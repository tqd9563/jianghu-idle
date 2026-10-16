/**
 * store 行为测试：单钱包丹田模型 + 埋点事件发射（对齐规格书 §6.1 v0.9 / 埋点规格 §1.2）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REALMS } from '../engine/content';
import { zhongCost } from '../engine/neigong';
import {
  resetLiveTestWindowForTests, startLiveTestWindow as persistLiveTestWindow, loadGame, saveGame, backdateSavedAt,
} from '../save/storage';
import { getEvents, resetTelemetry } from '../telemetry/telemetry';
import { TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import {
  buildLoadout, effBreakCost, effIdleRate, mapUnlocked, nextAfterBattle, playerBuild, putInBag, resetLiveTestVisitForTests, retireKind,
  rollDropFor, tierUnlocked, useGameStore, zhongGate,
} from './gameStore';
import { rollGear, type GearItem, type GearSlot, type WeaponCat } from '../engine/gear';
import { applyWuxueDrop, frontierStageOf, handsOf, priceBasisOf, isTeachFailure, learnedFormsOf as learnedFormsOfStore, marketGoodsOf, sectShelfOf } from './gameStore';
import { BLACK_PER_LIFE, BLACK_UNLOCK_SPENT, STALL_PRICE_MULT } from '../engine/market';
import { slotCount } from '../engine/wuxue';
import { QUALITY_PARAMS, WUXUE, checkFormGate, formKey as fk, pagesFull, rollWuxueDrop } from '../engine/wuxue';
import { isBenmen } from '../engine/sect';

/** 一件固定类别的装备（剑 / 刀 / 枪 / 棍按名表第一行取） */
function gearOf(slot: GearSlot, cat?: WeaponCat): GearItem {
  // rollGear 的掷骰顺序：（兵器才有的）类别 → 型 → 基础浮动 → 词条数 … 这里只固定类别与型
  const catIdx = cat ? ['剑', '刀', '枪', '棍'].indexOf(cat) / 4 + 0.01 : 0;
  const seq = [...(slot === '兵器' ? [catIdx] : []), 0.1, 0.5, 0.5, 0.5, 0.5];
  let i = 0;
  const it = rollGear({ slot, grade: 1, level: 1, clearSilver: 1 }, () => seq[Math.min(i++, seq.length - 1)]);
  return { ...it, fresh: false };
}
import { freshInjuries, isHurt } from '../engine/injury';
import { allStages, getStage, REFARM_SILVER, stageKey, trackLength, type MapId, type TierId } from '../engine/enemies';
import { currentSegmentQuota, idleNeiliPerSec } from '../engine/formulas';
import { REALM_ACUPOINTS } from '../engine/acupoints';
import { INIT_AGE, ERA_START, LIFESPAN, SOUL_WEAK_MULT, ageYearsPerDay } from '../engine/reincarnation';

function names() {
  return getEvents().map((e) => e.e);
}

describe('gameStore · 单钱包丹田模型', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('挂机 tick 按境界速率入丹田；周天新高越段发 charge_segment_full，回落再越不重复', () => {
    const t0 = Date.now();
    // 境界 1 速率 9/s、首段配额 5,807：tick 单次最多结算 300 秒，走 3 次 = 900 秒 → 8,100
    for (let i = 1; i <= 3; i++) useGameStore.getState().tick(t0 + i * 300_000);
    expect(useGameStore.getState().dantian).toBeCloseTo(8_100, 0);
    expect(names().filter((n) => n === 'charge_segment_full')).toHaveLength(1);

    // 花钱回落（模拟升武学扣款）再涨回：不重复发段事件
    useGameStore.setState({ dantian: 5_000 });
    useGameStore.getState().tick(t0 + 3 * 300_000 + 300_000); // +2,700 → 7,700，重新越过 5,807
    expect(names().filter((n) => n === 'charge_segment_full')).toHaveLength(1);
  });

  it('乘区加权时长随在线时间累计（基础声望口径，economy.md §1.1）', () => {
    useGameStore.setState({ peakRealm: 3, ganwuLevel: 24 }); // 乘区 1 + 4.8 + 宿慧 1.6 + 3.7 = 11.1×
    useGameStore.getState().tick(Date.now() + 300_000);
    expect(useGameStore.getState().lifeWeightedHours).toBeCloseTo((300 / 3600) * 11.1, 6);
  });

  it('丹田不足时不能突破；足额突破扣全额、境界+1、发 realm_breakthrough', () => {
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(1);

    // 境界 1 教学脉：缴满 8.71 万但手太阴未贯通，仍不能突破
    useGameStore.setState({ dantian: 87_100, chargeHighWater: 4 });
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(1);

    const open = { failCount: 0, opened: true };
    useGameStore.setState({ acupointProgress: { zhongfu: open, chize: open, taiyuan: open } });
    useGameStore.getState().breakthrough();
    const s = useGameStore.getState();
    expect(s.realm).toBe(2);
    expect(s.dantian).toBe(0);
    expect(s.ceremony).toBe(2);
    expect(s.peakRealm).toBe(2); // 首达即得宿慧
    const ev = getEvents().find((e) => e.e === 'realm_breakthrough')!;
    expect(ev.first_reach).toBe(true);
  });

  it('升重不设上限、只受内力约束（sect-neigong/spec.md §1.2）', () => {
    useGameStore.setState({ realm: 2, route: 'tangmen', neigong: 'shiguxinfa', tiersPassed: 3, dantian: 10_000_000, zhong: 10 });
    useGameStore.getState().upgradeZhong(); // 十重之后进入火候，境界 2 也能练
    expect(useGameStore.getState().zhong).toBe(11);
    expect(useGameStore.getState().dantian).toBe(10_000_000 - zhongCost(11));

    useGameStore.setState({ dantian: zhongCost(12) - 1 });
    useGameStore.getState().upgradeZhong(); // 内力差 1，拒绝
    expect(useGameStore.getState().zhong).toBe(11);
  });

  it('台阶挡升重：卡在台阶上挂机每 10 分钟判一次顿悟，成功即跨阶并发 dunwu（spec §1.3）', () => {
    useGameStore.setState({ realm: 2, route: 'tangmen', neigong: 'shiguxinfa', zhong: 2, tiersPassed: 0, dantian: 10_000_000, wuxing: 1 });
    useGameStore.getState().upgradeZhong(); // 第 2 重已到「登堂」门槛，未顿悟不能再升
    expect(useGameStore.getState().zhong).toBe(2);

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // 判不中
    const t0 = Date.now();
    useGameStore.getState().tick(t0);
    useGameStore.getState().tick(t0 + 300_000);
    useGameStore.getState().tick(t0 + 600_000);   // 累计 600 秒：判一次，不中
    expect(useGameStore.getState().tiersPassed).toBe(0);
    rand.mockReturnValue(0.1);                    // 50% × 悟性 1.0 → 判中
    useGameStore.getState().tick(t0 + 900_000);
    useGameStore.getState().tick(t0 + 1_200_000);
    rand.mockRestore();
    const s = useGameStore.getState();
    expect(s.tiersPassed).toBe(1);
    expect(s.dunwuNotice).toBe('登堂');
    expect(getEvents().find((e) => e.e === 'dunwu')!.tier).toBe('登堂');
    useGameStore.getState().upgradeZhong();       // 跨阶后可继续升
    expect(useGameStore.getState().zhong).toBe(3);
  });

  it('选内功只此一次、只能选已拥有的，发 neigong_selected；第一世须先遇见前辈', () => {
    useGameStore.getState().selectNeigong('zhenyuegong'); // 未传功：拒绝
    expect(useGameStore.getState().neigong).toBeNull();
    useGameStore.setState({ taught: true });
    useGameStore.getState().selectNeigong('panshigong'); // 上乘未拥有，拒绝
    expect(useGameStore.getState().neigong).toBeNull();
    useGameStore.getState().selectNeigong('zhenyuegong');
    expect(names()).toContain('neigong_selected');
    expect(useGameStore.getState().route).toBe('shaolin');
    useGameStore.getState().selectNeigong('jingleijue');
    expect(useGameStore.getState().neigong).toBe('zhenyuegong');
  });
});

/** 某前沿的前 n 关；n 缺省为全通 */
const upto = (map: MapId, tier: TierId, n = trackLength(map, tier)) =>
  Array.from({ length: n }, (_, i) => stageKey(map, tier, i + 1));
const m1all = upto(1, 0);
const m2all = upto(2, 0);
const m3all = upto(3, 0);
/** 图 1 初入的第一个精英 */
const ELITE1 = allStages().find((e) => e.map === 1 && e.tier === 0 && e.kind === 'elite')!.stage;
/** 图 1 初入段末 Boss */
const M1BOSS = trackLength(1, 0);

describe('gameStore · 归隐与声望阁', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('归隐门槛：本世至少突破一次（境界 ≥ 2）；首次可归隐时上报一次 retire_unlocked', () => {
    expect(retireKind(useGameStore.getState())).toBeNull();
    useGameStore.getState().openRetire();
    expect(useGameStore.getState().retireStep).toBeNull();

    useGameStore.setState({ realm: 2 });
    expect(retireKind(useGameStore.getState())).toBe('standard');
    useGameStore.getState().tick(Date.now() + 500);
    useGameStore.getState().tick(Date.now() + 1000);
    const ev = getEvents().filter((e) => e.e === 'retire_unlocked');
    expect(ev).toHaveLength(1);
    expect(ev[0].trigger).toBe('first_breakthrough');
  });

  it('归隐执行：声望 = 10 × 加权小时 × 前沿乘数；宿慧、修行感悟、最深 Boss、名号跨世保留', () => {
    useGameStore.setState({
      realm: 5, route: 'tangmen', neigong: 'shiguxinfa', zhong: 10, tiersPassed: 3, peakRealm: 5, ganwuLevel: 3,
      dantian: 3400, silver: 830, xp: 59,
      clearedStages: [...m1all, ...m2all], deepestBossEver: 2,
      lifeWeightedHours: 12, fameClaimed: [`stage:${stageKey(1, 0, trackLength(1, 0))}`], fameThisLife: 30, reputation: 30,
      runPlaySec: 2760, ownedRepNodes: ['wudao_biji'],
    });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();
    const s = useGameStore.getState();
    expect(s.run).toBe(2);
    expect(s.realm).toBe(1);
    expect(s.route).toBeNull();
    expect(s.dantian).toBe(0);
    expect(s.silver).toBe(0);
    expect(s.xp).toBe(59); // 阅历冻结：原样留着
    expect(s.neigong).toBeNull();
    expect(s.zhong).toBe(0);
    expect(s.ownedNeigong).toEqual(['jingleijue', 'zhenyuegong', 'shiguxinfa']);
    expect(s.wuxing).toBeGreaterThanOrEqual(0.9);   // 武道笔记：悟性 +0.1
    expect(s.wuxing).toBeLessThanOrEqual(1.3);
    // 基础 120 × 前沿 1.2（本世再败洛阳近郊 Boss，不浅于历来最深）= 144
    expect(s.retireCeremony!.settle.total).toBe(144);
    expect(s.reputation).toBe(30 + 144);
    expect(s.clearedStages).toEqual([]);
    expect(s.peakRealm).toBe(5);
    expect(s.ganwuLevel).toBe(3);
    expect(s.deepestBossEver).toBe(2);
    expect(s.fameClaimed).toEqual([`stage:${stageKey(1, 0, trackLength(1, 0))}`]);
    expect(s.lifeWeightedHours).toBe(0);
    expect(s.fameThisLife).toBe(0);
    const confirmed = getEvents().find((e) => e.e === 'retire_confirmed')!;
    expect(confirmed.prestige_total).toBe(144);
    expect(confirmed.front_mult).toBe(1.2);
    const runStart = getEvents().find((e) => e.e === 'run_start' && e.run === 2)!;
    expect(runStart.wuxing).toBe(s.wuxing);
    expect(runStart.owned_nodes).toEqual(['wudao_biji']);
  });

  it('已拥有的内功跨世保留并持久化；所修内功与重数清零', () => {
    useGameStore.setState({
      realm: 5, route: 'huashan', neigong: 'leimingjianjing', zhong: 40, tiersPassed: 4,
      ownedNeigong: ['jingleijue', 'zhenyuegong', 'shiguxinfa', 'leimingjianjing'],
      clearedStages: [...m1all, ...m2all, ...m3all], runPlaySec: 2760,
    });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();
    const state = useGameStore.getState();
    expect(state.ownedNeigong).toContain('leimingjianjing');
    expect(state.neigong).toBeNull();
    expect(state.tiersPassed).toBe(0);
    const saved = loadGame<{ ownedNeigong: string[]; zhong: number }>();
    expect(saved).toMatchObject({ zhong: 0 });
    expect(saved!.ownedNeigong).toContain('leimingjianjing');
  });

  it('预览/确认中退出发 retire_cancelled 且不结算', () => {
    useGameStore.setState({ realm: 5, clearedStages: [...m1all, ...m2all, ...m3all], runPlaySec: 2760 });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().cancelRetire();
    expect(useGameStore.getState().run).toBe(1);
    const ev = getEvents().find((e) => e.e === 'retire_cancelled')!;
    expect(ev.step).toBe('confirm');
  });

  it('声望节点购买：扣声望、发 prestige_node_bought；不足拒绝', () => {
    useGameStore.setState({ reputation: 370 });
    useGameStore.getState().buyRepNode('zairu_jianghu'); // 150
    let s = useGameStore.getState();
    expect(s.reputation).toBe(220);
    expect(s.ownedRepNodes).toEqual(['zairu_jianghu']);
    useGameStore.getState().buyRepNode('qingzhuang_shanglu'); // 220 → 0
    useGameStore.getState().buyRepNode('wudao_biji'); // 440 > 0，拒绝
    s = useGameStore.getState();
    expect(s.reputation).toBe(0);
    expect(s.ownedRepNodes).toEqual(['zairu_jianghu', 'qingzhuang_shanglu']);
    const ev = getEvents().filter((e) => e.e === 'prestige_node_bought');
    expect(ev).toHaveLength(2);
    expect(ev[0].balance_after).toBe(220);
  });

  it('修行感悟：传承一级 / 尽数传承，乘区随之上涨', () => {
    useGameStore.setState({ reputation: 7570, ganwuLevel: 136 });
    useGameStore.getState().buyGanwu('one');
    expect(useGameStore.getState().ganwuLevel).toBe(137);
    expect(useGameStore.getState().reputation).toBe(7570 - 1370);
    useGameStore.getState().buyGanwu('all');
    const s = useGameStore.getState();
    expect(s.ganwuLevel).toBe(141); // 再买 4 级：1,380 + 1,390 + 1,400 + 1,410 = 5,580
    expect(s.reputation).toBe(7570 - 1370 - 5580);
    const ev = getEvents().filter((e) => e.e === 'ganwu_bought');
    expect(ev.map((e) => e.level_to)).toEqual([137, 141]);
    expect(effIdleRate(s)).toBeCloseTo(idleNeiliPerSec(1) * (1 + 141 * 0.2), 6);
  });

  it('同路数转修：少 3 重、台阶重新顿悟、收境界 × 100 银两，发 neigong_switched（spec §1.5）', () => {
    useGameStore.setState({
      realm: 3, route: 'huashan', neigong: 'jingleijue', zhong: 30, tiersPassed: 3, silver: 530,
      ownedNeigong: ['jingleijue', 'zhenyuegong', 'shiguxinfa', 'leimingjianjing'],
    });
    useGameStore.getState().switchNeigong('leimingjianjing');
    const s = useGameStore.getState();
    expect(s.neigong).toBe('leimingjianjing');
    expect(s.route).toBe('huashan');
    expect(s.zhong).toBe(27);
    expect(s.tiersPassed).toBe(0);
    expect(s.silver).toBe(230);
    const ev = getEvents().find((e) => e.e === 'neigong_switched')!;
    expect(ev.same_route).toBe(true);
    expect(ev.fee_paid).toBe(300);
  });

  it('跨路数散功重修：重数归零；银两不足或未拥有则拒绝', () => {
    useGameStore.setState({
      realm: 3, route: 'tangmen', neigong: 'shiguxinfa', zhong: 12, tiersPassed: 3, silver: 299,
    });
    useGameStore.getState().switchNeigong('zhenyuegong'); // 手续费 300，差 1
    expect(useGameStore.getState().neigong).toBe('shiguxinfa');
    useGameStore.setState({ silver: 300 });
    useGameStore.getState().switchNeigong('panshigong'); // 未拥有
    expect(useGameStore.getState().neigong).toBe('shiguxinfa');
    useGameStore.getState().switchNeigong('zhenyuegong');
    const s = useGameStore.getState();
    expect(s.route).toBe('shaolin');
    expect(s.zhong).toBe(0);
    expect(s.silver).toBe(0);
  });

  it('观察员暂停冻结产出与活跃时长；恢复后继续；会话事件字段齐全', () => {
    const t0 = Date.now();
    useGameStore.getState().startSession('T03');
    const start = getEvents().find((e) => e.e === 'test_session_start')!;
    expect(start.tester_id).toBe('T03');
    expect(start.telemetry_spec).toBe(TELEMETRY_SPEC);

    useGameStore.getState().pauseSession();
    useGameStore.getState().tick(t0 + 50_000);
    let s = useGameStore.getState();
    expect(s.dantian).toBe(0);
    expect(s.runPlaySec).toBe(0);

    useGameStore.getState().resumeSession();
    useGameStore.getState().tick(t0 + 60_000);
    s = useGameStore.getState();
    expect(s.runPlaySec).toBeCloseTo(10, 0);
    expect(s.dantian).toBeCloseTo(90, 0);

    useGameStore.getState().endSession('completed');
    expect(getEvents().find((e) => e.e === 'test_session_end')!.reason).toBe('completed');
    expect(names()).toContain('test_paused');
    expect(names()).toContain('test_resumed');
  });

  it('会话状态持久化：重复开始不重发事件；暂停中结束自动补发 test_resumed 闭合配对', () => {
    useGameStore.getState().startSession('T02');
    let s = useGameStore.getState();
    expect(s.sessionActive).toBe(true);
    expect(loadGame<{ sessionActive: boolean }>()!.sessionActive).toBe(true); // 面板重开/刷新不丢

    useGameStore.getState().startSession('T02'); // 面板状态错乱时的双击保护
    expect(names().filter((n) => n === 'test_session_start')).toHaveLength(1);

    useGameStore.getState().pauseSession();
    expect(loadGame<{ paused: boolean }>()!.paused).toBe(true); // 刷新不静默解冻
    useGameStore.getState().endSession('completed');
    const evs = names();
    expect(evs.indexOf('test_resumed')).toBeGreaterThan(evs.indexOf('test_paused'));
    expect(evs.indexOf('test_session_end')).toBeGreaterThan(evs.indexOf('test_resumed'));
    s = useGameStore.getState();
    expect(s.sessionActive).toBe(false);
    expect(s.paused).toBe(false);
  });

  it('胜利收益快照：关卡不掉内力；回刷银两两成半、阅历为零、重打不递减；首次击败精英名号传开', () => {
    useGameStore.setState({ realm: 5, route: 'tangmen', neigong: 'shiguxinfa', zhong: 10, tiersPassed: 3 });
    const play = () => {
      const t0 = Date.now();
      for (let i = 1; i <= 200 && !(useGameStore.getState().battle?.resolved ?? false); i++) {
        useGameStore.getState().tick(t0 + i * 700);
      }
      return useGameStore.getState().battle!;
    };
    useGameStore.getState().challengeStage(1, 0, 1);
    const first = play();
    expect(first.result.win).toBe(true);
    const base = first.enemy.reward;
    expect(first.reward).toMatchObject({ neili: 0, silver: base.silver, refarm: false, fame: 0 });   // 可能另带 6% 的装备掉落
    expect(useGameStore.getState().xp).toBe(0); // 阅历冻结：关卡不再发

    useGameStore.getState().challengeStage(1, 0, 1); // 回刷同一关
    const second = play();
    expect(second.reward!.refarm).toBe(true);
    expect(second.reward!.neili).toBe(0);
    expect(second.reward!.silver).toBe(Math.round(base.silver * REFARM_SILVER));

    useGameStore.getState().challengeStage(1, 0, 1); // 连续重打：不再递减（battle-loot 裁决 14）
    const third = play();
    expect(third.reward!.silver).toBe(Math.round(base.silver * REFARM_SILVER));
    expect(third.chainStage).toBeNull(); // 重打一次：打完就停

    // 首次击败图 1 初入的第一个精英：6.4 × 乘区 1，向下取整 6 声望，跨世只领一次
    useGameStore.setState({ clearedStages: m1all.slice(0, ELITE1 - 1) });
    useGameStore.getState().challengeStage(1, 0, ELITE1);
    const elite = play();
    expect(elite.result.win).toBe(true);
    expect(elite.reward!.fame).toBe(6);
    let s = useGameStore.getState();
    expect(s.reputation).toBe(6);
    expect(s.fameThisLife).toBe(6);
    expect(s.fameClaimed).toEqual([`stage:${stageKey(1, 0, ELITE1)}`]);
    useGameStore.getState().challengeStage(1, 0, ELITE1); // 重打不再给
    expect(play().reward!.fame).toBe(0);
    s = useGameStore.getState();
    expect(s.reputation).toBe(6);
    expect(getEvents().filter((e) => e.e === 'fame_gained')).toHaveLength(1);
  });

  it('难度解锁：打通段末 Boss 开本图下一档与下一图初入，跨世保留；封存的前沿打不了', () => {
    const st = () => useGameStore.getState();
    useGameStore.setState({ realm: 5, route: 'shaolin', neigong: 'zhenyuegong', zhong: 40, tiersPassed: 3 });
    const n = trackLength(1, 0);
    useGameStore.setState({ clearedStages: m1all.slice(0, n - 1) });
    expect(tierUnlocked(1, 1, st().tiersUnlocked)).toBe(false);
    useGameStore.getState().challengeStage(1, 0, n);
    const t0 = Date.now();
    for (let i = 1; i <= 400 && !(st().battle?.resolved ?? false); i++) st().tick(t0 + i * 700);
    expect(st().battle!.result.win).toBe(true);
    expect(st().tiersUnlocked).toEqual(['1-0', '1-1', '2-0']);
    expect(getEvents().find((e) => e.e === 'tier_unlocked')!.opened).toEqual(['1-1', '2-0']);

    // 跨世保留：归隐后仍可直接选历练
    useGameStore.setState({ retireStep: 'confirm' });
    st().confirmRetire();
    expect(st().tiersUnlocked).toEqual(['1-0', '1-1', '2-0']);
    useGameStore.setState({ selectedMap: 1 });
    st().selectTier(1);
    expect(st().selectedTier).toBe(1);

    // 封存：图 4 历练、图 5 永远不开
    useGameStore.setState({ tiersUnlocked: ['4-1', '5-0'] });
    expect(tierUnlocked(4, 1, st().tiersUnlocked)).toBe(false);
    expect(mapUnlocked(5, st().tiersUnlocked)).toBe(false);
  });

  it('突破总额取「离开本境界」行', () => {
    useGameStore.setState({ realm: 2 });
    expect(effBreakCost(useGameStore.getState())).toBe(3_360_000);
    useGameStore.setState({ realm: 1 });
    expect(effBreakCost(useGameStore.getState())).toBe(87_100);
    useGameStore.setState({ realm: 6 });
    expect(effBreakCost(useGameStore.getState())).toBeNull(); // 本版终点

  });

  it('在此挂机：胜后原地再打、场次累计；收手后这一场打完就停', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    useGameStore.setState({ realm: 5, route: 'shaolin', neigong: 'zhenyuegong', zhong: 10, tiersPassed: 3, clearedStages: [stageKey(1, 0, 1)] });
    const playOut = () => {
      for (let i = 0; i < 300; i++) {
        const b = useGameStore.getState().battle;
        if (!b || b.resolved) break;
        vi.setSystemTime(Date.now() + 700);
        useGameStore.getState().tick(Date.now());
      }
      return useGameStore.getState().battle!;
    };
    useGameStore.getState().idleAt(1, 0, 1);
    expect(useGameStore.getState().idle).toEqual({ map: 1, tier: 0, stage: 1, fights: 0 });
    const b1 = playOut();
    expect(b1.result.win).toBe(true);
    expect(b1.reward!.refarm).toBe(true);
    expect(b1.chainStage).toBe(1); // 挂机 → 原关
    expect(b1.chainMode).toBe('idle');
    expect(useGameStore.getState().idle!.fights).toBe(1);

    // 越过 chainAt：自动开下一场，仍是第 1 关、仍是挂机
    vi.setSystemTime(Date.now() + 1_000);
    useGameStore.getState().tick(Date.now());
    const b2 = useGameStore.getState().battle!;
    expect(b2.stage).toBe(1);
    expect(b2.mode).toBe('idle');
    expect(b2.resolved).toBe(false);

    // 收手：这一场打完不再接
    useGameStore.getState().stopIdle();
    expect(useGameStore.getState().idle).toBeNull();
    const b3 = playOut();
    expect(b3.chainStage).toBeNull();
    expect(getEvents().map((e) => e.e)).toEqual(expect.arrayContaining(['idle_start', 'idle_stop']));
    vi.useRealTimers();
  });

  it('推关：输了退回最近已通关处挂机；挂机中输了退一关继续；退无可退才停（纯函数）', () => {
    const cleared = [1, 2, 3, 4, 5, 6].map((st) => stageKey(1, 0, st));
    // 境界 1 裸属性打 1-7 必败（battle-loot/spec.md 判据 12）：推关败 → 退回第 6 关挂机
    // （第二世：前辈已传功，这场败不再是教学战败，照常退回挂机）
    useGameStore.setState({ realm: 1, run: 2, taught: true, clearedStages: cleared, idle: null });
    useGameStore.getState().challengeStage(1, 0, 7);
    const t0 = Date.now();
    for (let i = 1; i <= 400 && !(useGameStore.getState().battle?.resolved ?? false); i++) useGameStore.getState().tick(t0 + i * 700);
    const b = useGameStore.getState().battle!;
    expect(b.mode).toBe('push');
    expect(b.result.win).toBe(false);
    expect(b.chainStage).toBe(6);
    expect(b.chainMode).toBe('idle');
    expect(useGameStore.getState().idle).toEqual({ map: 1, tier: 0, stage: 6, fights: 0 });

    // 挂机中输了：退一关；第 1 关输了退无可退 → 停
    const idle6 = { map: 1 as const, tier: 0 as const, stage: 6, fights: 9 };
    expect(nextAfterBattle(idle6, { map: 1, tier: 0, stage: 6, mode: 'idle' }, false, cleared))
      .toEqual({ idle: { map: 1, tier: 0, stage: 5, fights: 9 }, chainStage: 5, chainMode: 'idle' });
    expect(nextAfterBattle({ ...idle6, stage: 1 }, { map: 1, tier: 0, stage: 1, mode: 'idle' }, false, cleared))
      .toEqual({ idle: null, chainStage: null, chainMode: null });
    // 推关胜：接着打下一关；本段打穿则在末关挂着
    expect(nextAfterBattle(null, { map: 1, tier: 0, stage: 7, mode: 'push' }, true, [...cleared, stageKey(1, 0, 7)]).chainStage).toBe(8);
    const n = trackLength(1, 0);
    const all = Array.from({ length: n }, (_, i) => stageKey(1, 0, i + 1));
    expect(nextAfterBattle(null, { map: 1, tier: 0, stage: n, mode: 'push' }, true, all))
      .toEqual({ idle: { map: 1, tier: 0, stage: n, fights: 0 }, chainStage: n, chainMode: 'idle' });
  });
});

describe('gameStore · MVP-2 natural live-test window', () => {
  beforeEach(() => {
    resetLiveTestWindowForTests();
    resetLiveTestVisitForTests();
    useGameStore.getState().hardReset();
    useGameStore.setState({ liveTestWindow: null });
    resetTelemetry();
  });

  it('starts after init in start → visit order and suppresses duplicate start/visit on this page', () => {
    useGameStore.getState().applyLiveTestSwitch(1);
    useGameStore.getState().applyLiveTestSwitch(1);
    const events = getEvents();
    expect(events.map((event) => event.e)).toEqual(['natural_window_started', 'natural_window_visit']);
    expect(events[0].window_id).toBe(events[1].window_id);
    expect(events[0].tables_version_started).toBe(TABLES_VERSION);
    expect(events[0].tables_version_current).toBe(TABLES_VERSION);
    expect(events[0].tables_version_changed).toBe(false);
  });

  it('reloads a persisted window with exactly one visit and reports table-version drift', () => {
    const record = persistLiveTestWindow('older-tables', 1234);
    resetLiveTestVisitForTests();
    useGameStore.setState({ started: false, liveTestWindow: null, offlineSettlement: null });
    useGameStore.getState().init();
    useGameStore.getState().init();
    const visits = getEvents().filter((event) => event.e === 'natural_window_visit');
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      window_id: record.windowId,
      started_at: 1234,
      tables_version_started: 'older-tables',
      tables_version_current: TABLES_VERSION,
      tables_version_changed: true,
    });
  });

  it('captures only existing objective snapshot decisions and stops in ended order', () => {
    useGameStore.setState({
      realm: 2, route: 'tangmen', neigong: 'shiguxinfa', zhong: 3, tiersPassed: 1, dantian: 3_360_000,
      clearedStages: [...m1all, stageKey(2, 0, 1)], tiersUnlocked: ['1-0', '2-0', '1-1'],
    });
    useGameStore.getState().applyLiveTestSwitch(1);
    const visit = getEvents().find((event) => event.e === 'natural_window_visit')!;
    expect(visit).toMatchObject({
      run: 1, realm: 2, route: 'tangmen', max_cleared_stage: stageKey(2, 0, 1), cleared_stage_count: m1all.length + 1,
      offline_settlement_present: false, offline_settlement_capped: null,
      decision_breakthrough: true, decision_skill: true, decision_battle: true, decision_retire: true,
    });
    useGameStore.getState().applyLiveTestSwitch(0);
    useGameStore.getState().applyLiveTestSwitch(0);
    expect(names()).toEqual(['natural_window_started', 'natural_window_visit', 'natural_window_ended']);
    expect(useGameStore.getState().liveTestWindow).toBeNull();
  });

  it('trims subjective note fields and emits nothing without an active window', () => {
    const note = {
      natural_open: true,
      open_reason: '  想起突破  ',
      settlement_understood: null,
      decision: '  升武学  ',
      next_goal: '  打 Boss  ',
      feeling: '  目标清楚  ',
    } as const;
    useGameStore.getState().recordNaturalWindowNote(note);
    expect(getEvents()).toHaveLength(0);
    useGameStore.getState().applyLiveTestSwitch(1);
    useGameStore.getState().recordNaturalWindowNote(note);
    const event = getEvents().find((item) => item.e === 'natural_window_note')!;
    expect(event).toMatchObject({
      natural_open: true, open_reason: '想起突破', settlement_understood: null,
      decision: '升武学', next_goal: '打 Boss', feeling: '目标清楚',
    });
  });
});

describe('gameStore · 受伤系统接线（injury/spec.md）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('新存档带空伤势，挂机产出不被压制', () => {
    const s = useGameStore.getState();
    expect(isHurt(s.injuries ?? freshInjuries())).toBe(false);
    expect(effIdleRate(s)).toBeCloseTo(idleNeiliPerSec(s.realm), 6);
  });

  it('带伤时挂机产出按 spec §3 压制', () => {
    useGameStore.setState({ injuries: { ...freshInjuries(), nei: { severity: 2, healAccMin: 0 } } });
    const s = useGameStore.getState();
    // 内伤·中 → 0.8125（spec §3 精确值表）
    expect(effIdleRate(s)).toBeCloseTo(idleNeiliPerSec(s.realm) * 0.8125, 6);
  });

  it('tick 推进游戏内时间会自愈（spec §5：轻伤境界 1 需 3 分钟）', () => {
    useGameStore.setState({ injuries: { ...freshInjuries(), wai: { severity: 1, healAccMin: 0 } } });
    const t0 = Date.now();
    // 分两段推进：tick 单次 dt 上限 300 秒
    useGameStore.getState().tick(t0 + 120_000);
    expect(useGameStore.getState().injuries!.wai.severity).toBe(1);  // 2 分钟未愈
    useGameStore.getState().tick(t0 + 240_000);
    expect(useGameStore.getState().injuries!.wai.severity).toBe(0);  // 满 3 分钟痊愈
  });

  it('伤势叠加进 playerBuild，且不污染路数专属字段', () => {
    const base = playerBuild({
      realm: 4, neigong: 'jingleijue', zhong: 7, tiersPassed: 0,
    });
    const hurt = playerBuild({
      realm: 4, neigong: 'jingleijue', zhong: 7, tiersPassed: 0,
      injuries: { ...freshInjuries(), nei: { severity: 3, healAccMin: 0 } },
    });
    expect(hurt.atk).toBeCloseTo(base.atk * 0.55, 6);   // 重度内伤压攻击 45%
    expect(hurt.def).toBeCloseTo(base.def, 6);
    expect(hurt.sqNeed).toBe(base.sqNeed);
  });

  it('归隐清零伤势与折寿（FRESH 展开重置）', () => {
    useGameStore.setState({
      injuries: { ...freshInjuries(), wai: { severity: 3, healAccMin: 0 } },
      lifespanLost: 15,
    });
    expect(isHurt(useGameStore.getState().injuries!)).toBe(true);
    useGameStore.getState().hardReset();
    const after = useGameStore.getState();
    expect(isHurt(after.injuries ?? freshInjuries())).toBe(false);
    expect(after.lifespanLost ?? 0).toBe(0);
  });
});

describe('gameStore · 冲穴耗内力制（design.md v4.0）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  /**
   * 把角色放到境界 2、周天缴满 N 段、丹田封顶的状态。
   * 消耗取 effBreakCost（离开本境界的总额），与 store 内部同源。
   */
  function atRealm2(chargeHighWater = 3) {
    useGameStore.setState({ started: true, realm: 2, acupointProgress: {}, chargeHighWater });
    const cost = effBreakCost(useGameStore.getState())!;
    useGameStore.setState({ dantian: cost });
    return cost;
  }

  it('真气未行至该穴时冲不动，内力分文不扣', () => {
    const cost = atRealm2(0);
    useGameStore.getState().attemptAcupoint('quchi');
    expect(useGameStore.getState().acupointProgress).toEqual({});
    expect(useGameStore.getState().dantian).toBe(cost);
  });

  it('同一条脉须按次序冲：前穴未通时后穴冲不动', () => {
    const cost = atRealm2();
    useGameStore.getState().attemptAcupoint('hegu');   // 曲池尚未通
    expect(useGameStore.getState().acupointProgress).toEqual({});
    expect(useGameStore.getState().dantian).toBe(cost);
  });

  it('冲穴成败同扣真气——失败也扣，这就是惩罚', () => {
    const cost = atRealm2();
    const N = REALMS[1].zhoutianCount!;
    const before = useGameStore.getState().dantian;
    // roll=0.99 > 曲池 90% → 必失败
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    useGameStore.getState().attemptAcupoint('quchi');
    vi.mocked(Math.random).mockRestore();

    const after = useGameStore.getState();
    expect(after.acupointProgress!.quchi).toEqual({ failCount: 1, opened: false });
    const expected = currentSegmentQuota(cost, N, 3) * 0.11;    // 当前段（末段）配额 × 11%
    expect(before - after.dantian).toBeCloseTo(expected, 6);
  });

  it('末段圆满、丹田封顶时仍冲得动——v4.0 要消灭的死锁不再复现', () => {
    // 旧实现把「已缴 N 段」直接拿去减，当前段真气恒为 0，最后一个窍穴永远冲不动。
    const cost = atRealm2();
    const N = REALMS[1].zhoutianCount!;
    const per = currentSegmentQuota(cost, N, 3) * 0.11;

    vi.spyOn(Math, 'random').mockReturnValue(0.99);   // 第一次必失败（曲池 90%）
    useGameStore.getState().attemptAcupoint('quchi');
    expect(useGameStore.getState().acupointProgress!.quchi.opened).toBe(false);
    expect(useGameStore.getState().dantian).toBeCloseTo(cost - per, 6);

    // 扣款使液面回落，但真气仍够再冲一次——持续性正是无死锁的含义
    useGameStore.getState().attemptAcupoint('quchi');
    vi.mocked(Math.random).mockRestore();
    expect(useGameStore.getState().acupointProgress!.quchi.opened).toBe(true);   // 失败累进到 100%
    expect(useGameStore.getState().dantian).toBeCloseTo(cost - per * 2, 6);      // 两次都扣了
  });

  it('突破须贯通首条经脉：通了另一条脉不顶用', () => {
    atRealm2();
    const other = REALM_ACUPOINTS[2].meridians[1].acupointIds;
    useGameStore.setState({
      acupointProgress: Object.fromEntries(other.map(id => [id, { failCount: 0, opened: true }])),
    });
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(2);    // 没突破

    // 补通首条脉 → 可突破
    const req = REALM_ACUPOINTS[2].meridians[0].acupointIds;
    useGameStore.setState({
      acupointProgress: {
        ...useGameStore.getState().acupointProgress,
        ...Object.fromEntries(req.map(id => [id, { failCount: 0, opened: true }])),
      },
    });
    useGameStore.getState().breakthrough();
    expect(useGameStore.getState().realm).toBe(3);
  });
});

describe('gameStore · 转世（reincarnation/spec.md v1.1）', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  const st = () => useGameStore.getState();
  const heavyAll = () => ({
    wai: { severity: 3 as const, healAccMin: 0 },
    nei: { severity: 3 as const, healAccMin: 0 },
    du: { severity: 3 as const, healAccMin: 0 },
  });

  it('新档：18 岁、江湖历 100 年、魂魄安稳', () => {
    expect(st().age).toBe(INIT_AGE);
    expect(st().eraStart).toBe(ERA_START);
    expect(st().soulUnsettled).toBe(false);
  });

  it('年岁随活跃时长增长：速率按历来最高境界分档', () => {
    const t0 = Date.now();
    st().tick(t0 + 60_000);
    // hardReset 与 t0 之间可能隔出几毫秒，按 3 位小数比（每毫秒约 5e-7 岁）
    expect(st().age).toBeCloseTo(INIT_AGE + ageYearsPerDay(1) / 1440, 3);
    expect(st().lifeMinutes).toBeCloseTo(1, 2);
  });

  it('观察员暂停期间不变老（与挂机产出同一冻结口径）', () => {
    useGameStore.setState({ paused: true });
    st().tick(Date.now() + 60_000);
    expect(st().age).toBe(INIT_AGE);
  });

  it('寿元将尽时再挂一会儿 → 寿终正寝：自动归隐，声望全额，来世魂魄安稳', () => {
    useGameStore.setState({ age: LIFESPAN[1] - 0.01, reputation: 7 });
    st().tick(Date.now() + 60_000);
    const s = st();
    expect(s.run).toBe(2);
    expect(s.age).toBe(INIT_AGE);
    expect(s.soulUnsettled).toBe(false);
    expect(s.retireCeremony?.cause).toBe('old');
    expect(s.retireCeremony?.deathAge).toBe(LIFESPAN[1]);
    // 江湖历从谢幕年份接着算
    expect(s.eraStart).toBeGreaterThan(ERA_START + (LIFESPAN[1] - INIT_AGE) - 0.1);
    const ev = getEvents().find((e) => e.e === 'retire_confirmed')!;
    expect(ev.kind).toBe('natural');
    expect(getEvents().some((e) => e.e === 'forced_reincarnation')).toBe(false);
  });

  it('寿元随当前境界：境界 3 活到 85 岁仍在，境界 1 早已寿终', () => {
    useGameStore.setState({ realm: 3, peakRealm: 3, age: 85 });
    st().tick(Date.now() + 1_000);
    expect(st().run).toBe(1);
    useGameStore.setState({ realm: 1, age: 85 });
    st().tick(Date.now() + 2_000);
    expect(st().retireCeremony?.cause).toBe('old');
  });

  it('重伤折寿压低寿元：境界 1 折了 15 年，55 岁即寿终', () => {
    useGameStore.setState({ age: 55.5, lifespanLost: 15 });
    st().tick(Date.now() + 1_000);
    expect(st().retireCeremony?.cause).toBe('old');
  });

  it('魂魄未稳：挂机产出 ×0.6，与伤势压制同一乘法链', () => {
    const base = effIdleRate(st());
    useGameStore.setState({ soulUnsettled: true });
    expect(effIdleRate(st())).toBeCloseTo(base * SOUL_WEAK_MULT, 10);
  });

  it('魂魄未稳不随突破解除，转世后前 10 年才解除', () => {
    const cost = effBreakCost(st())!;
    const open = { failCount: 0, opened: true };
    useGameStore.setState({
      soulUnsettled: true, dantian: cost,
      acupointProgress: { zhongfu: open, chize: open, taiyuan: open },   // 境界 1 教学脉须贯通
    });
    st().breakthrough();
    expect(st().realm).toBe(2);
    expect(st().soulUnsettled).toBe(true);
    useGameStore.setState({ age: INIT_AGE + 9.99 });
    st().tick(Date.now() + 60_000);
    expect(st().soulUnsettled).toBe(false);
  });

  it('主动归隐：年岁重置、江湖历接续、魂魄安稳，走 retire_confirmed 而非强制转世', () => {
    useGameStore.setState({
      realm: 5, clearedStages: ['m3s10'], age: 60, eraStart: 130,
      soulUnsettled: false, retireStep: 'confirm',
    });
    st().confirmRetire();
    const s = st();
    expect(s.run).toBe(2);
    expect(s.age).toBe(INIT_AGE);
    expect(s.eraStart).toBeCloseTo(130 + (60 - INIT_AGE), 6);
    expect(s.soulUnsettled).toBe(false);
    expect(s.retireCeremony?.cause).toBeNull();
    expect(getEvents().some((e) => e.e === 'retire_confirmed')).toBe(true);
    expect(getEvents().some((e) => e.e === 'forced_reincarnation')).toBe(false);
  });

  it('战死：三处重伤时再败于 Boss → 越过致死线，强制转世', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    useGameStore.setState({
      realm: 1, route: null,
      clearedStages: m1all.slice(0, M1BOSS - 1),
      injuries: heavyAll(), lifespanLost: 45,
    });
    st().challengeStage(1, 0, M1BOSS);    // 境界 1 白身挑战山贼头目，带三处重伤，必败
    for (let i = 0; i < 400; i++) {
      const b = st().battle;
      if (!b || b.resolved) break;
      vi.setSystemTime(Date.now() + 1_000);
      st().tick(Date.now());
    }
    vi.useRealTimers();
    const s = st();
    expect(s.retireCeremony?.cause).toBe('battle');
    expect(s.run).toBe(2);
    expect(s.soulUnsettled).toBe(true);
    // 伤势与折寿随转世清零
    expect(isHurt(s.injuries ?? freshInjuries())).toBe(false);
    expect(s.lifespanLost).toBe(0);
    expect(s.battle).toBeNull();
  });

  it('闭关中寿终 → 结算只算到寿终那一刻，回来直接进归隐演出', () => {
    // 境界 1、69 岁，下线 1 小时：约 32 分钟后寿终（每天约 44.6 岁）
    saveGame({ ...st(), age: LIFESPAN[1] - 1, run: 1 });
    backdateSavedAt(60 * 60);
    useGameStore.setState({ started: false });
    st().init();
    const s = st();
    expect(s.retireCeremony?.cause).toBe('old');
    expect(s.retireCeremony?.deathAge).toBe(LIFESPAN[1]);   // 按寿元封顶，不显示越界年岁
    expect(s.offlineSettlement).toBeNull();
    expect(s.run).toBe(2);
    const liveMin = (1 / ageYearsPerDay(1)) * 1440;
    expect(s.retireCeremony!.lifeMinutes).toBeCloseTo(liveMin, 0);
    // 基础声望只按活着的那段闭关算（离线 × 60%，乘区 1）
    expect(s.retireCeremony!.settle.weightedHours).toBeCloseTo((liveMin / 60) * 0.6, 2);
  });

  it('存档不丢字段：FRESH 里的每个字段都能原样存取（修复前窍穴进度 / 图鉴 / 伤势 / 折寿刷新即丢）', () => {
    const [acu] = REALM_ACUPOINTS[2].acupoints;
    useGameStore.setState({
      acupointProgress: { [acu.id]: { failCount: 2, opened: true } },
      acupointLog: [acu.id],
      injuries: { ...freshInjuries(), nei: { severity: 2, healAccMin: 1.5 } },
      lifespanLost: 15, age: 44.4, eraStart: 187, soulUnsettled: true,
    });
    st().pauseSession();   // 任一会持久化的动作都行，这里借暂停触发一次写盘
    const saved = loadGame() as Record<string, unknown>;
    expect(saved.acupointProgress).toEqual({ [acu.id]: { failCount: 2, opened: true } });
    expect(saved.acupointLog).toEqual([acu.id]);
    expect((saved.injuries as { nei: { severity: number } }).nei.severity).toBe(2);
    expect(saved.lifespanLost).toBe(15);
    expect(saved.age).toBe(44.4);
    expect(saved.eraStart).toBe(187);
    expect(saved.soulUnsettled).toBe(true);
  });
});

describe('页签已见', () => {
  it('未启动时点开页签不存档（否则会盖掉尚未载入的存档）', () => {
    saveGame({ run: 7, realm: 3 });
    useGameStore.setState({ started: false });
    useGameStore.getState().seeTab('neigong');
    expect(loadGame<{ run: number }>()!.run).toBe(7);
    useGameStore.setState({ started: true, seenTabs: [] });
    useGameStore.getState().seeTab('neigong');
    expect(useGameStore.getState().seenTabs).toEqual(['neigong']);
  });
});

describe('武学（sect-neigong/spec.md §2 / §4）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });

  it('装配槽跟境界走、只能装已拥有的；卸下无成本', () => {
    useGameStore.setState({
      realm: 2, neigong: 'jingleijue', route: 'huashan', ownedWuxue: ['liuyunjian', 'kaishanzhang', 'xiulizhen'],
      worn: { 兵器: gearOf('兵器', '剑'), 暗器: gearOf('暗器') },
    });
    const st = () => useGameStore.getState();
    st().equipWuxue('jinghongjian');            // 未拥有
    st().equipWuxue('liuyunjian');
    st().equipWuxue('kaishanzhang');
    st().equipWuxue('xiulizhen');               // 境界 2 只有 2 槽
    expect(st().equipped).toEqual(['liuyunjian', 'kaishanzhang']);
    st().unequipWuxue('liuyunjian');
    expect(st().equipped).toEqual(['kaishanzhang']);
  });

  it('市集武馆：开张后才能买、扣银两、秘籍永久保留；轻装上路八折；上乘秘籍已下架（裁决 35）', () => {
    useGameStore.setState({ realm: 2, silver: 1000, ownedRepNodes: ['qingzhuang_shanglu'] });
    const st = () => useGameStore.getState();
    st().buyShopItem('book:xingzhegun');       // 市集未开张
    expect(st().ownedWuxue).toEqual([]);
    useGameStore.setState({ marketOpen: true });
    st().buyShopItem('book:xingzhegun');       // 300 × 0.8 = 240
    expect(st().ownedWuxue).toEqual(['xingzhegun']);
    expect(st().silver).toBe(760);
    expect(st().marketSpent).toBe(240);
    st().buyShopItem('scroll:jinghongjian:4');  // 已下架
    expect(st().ownedScrolls).toEqual([]);
    st().buyShopItem('book:xingzhegun');        // 已有不重复买
    expect(st().silver).toBe(760);
  });

  it('战后累计每式熟练；条件满足按出招判顿悟，一场最多悟一式', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    useGameStore.setState({
      realm: 5, route: 'huashan', neigong: 'jingleijue', zhong: 40, tiersPassed: 3,
      ownedWuxue: ['liuyunjian'], equipped: ['liuyunjian'], formCasts: { 'liuyunjian:1': 4 }, wuxing: 1.2,
      clearedStages: m1all,
    });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.01); // 一出招就中
    useGameStore.getState().challengeStage(1, 0, trackLength(1, 0)); // 回刷 Boss：回合够多
    for (let i = 0; i < 400 && !(useGameStore.getState().battle?.resolved ?? false); i++) {
      vi.setSystemTime(Date.now() + 700);
      useGameStore.getState().tick(Date.now());
    }
    rand.mockRestore();
    vi.useRealTimers();
    const s = useGameStore.getState();
    const casts = s.battle!.result.stats.formCasts['liuyunjian:1'] ?? 0;
    expect(casts).toBeGreaterThan(0);
    expect(s.formCasts['liuyunjian:1']).toBe(4 + casts);
    expect(s.learnedForms).toEqual(['liuyunjian:2']);   // 第三式要先把第二式练到「熟练」
    expect(getEvents().some((e) => e.e === 'form_learned')).toBe(true);
  });

  it('转世：秘籍与首杀记录保留，装配与本世领悟清空、记入前世悟过，熟练带一半', () => {
    useGameStore.setState({
      realm: 3, clearedStages: [], runPlaySec: 100,
      ownedWuxue: ['liuyunjian'], equipped: ['liuyunjian'], learnedForms: ['liuyunjian:2'],
      formCasts: { 'liuyunjian:1': 25, 'liuyunjian:2': 1 }, dropsClaimed: ['1-0'], ownedScrolls: ['jinghongjian:4'],
    });
    useGameStore.setState({ retireStep: 'confirm' });
    useGameStore.getState().confirmRetire();
    const s = useGameStore.getState();
    expect(s.ownedWuxue).toEqual(['liuyunjian']);
    expect(s.equipped).toEqual([]);
    expect(s.learnedForms).toEqual([]);
    expect(s.pastLearned).toEqual(['liuyunjian:2']);
    expect(s.formCasts).toEqual({ 'liuyunjian:1': 12 });
    expect(s.dropsClaimed).toEqual(['1-0']);
    expect(s.ownedScrolls).toEqual(['jinghongjian:4']);
  });

  it('Boss 首次击杀必掉秘籍，跨世只掉一次', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    const n = trackLength(1, 0);
    useGameStore.setState({
      realm: 5, route: 'shaolin', neigong: 'zhenyuegong', zhong: 40, tiersPassed: 3,
      clearedStages: m1all.slice(0, n - 1),
    });
    const play = () => {
      for (let i = 0; i < 600 && !(useGameStore.getState().battle?.resolved ?? false); i++) {
        vi.setSystemTime(Date.now() + 700);
        useGameStore.getState().tick(Date.now());
      }
    };
    useGameStore.getState().challengeStage(1, 0, n);
    play();
    expect(useGameStore.getState().ownedWuxue).toContain('jinghongjian');
    expect(useGameStore.getState().battle!.reward!.drop).toBe('《惊鸿照影剑》');
    useGameStore.getState().challengeStage(1, 0, n);    // 回刷 Boss：不再掉
    play();
    vi.useRealTimers();
    expect(useGameStore.getState().ownedWuxue.filter((w) => w === 'jinghongjian')).toHaveLength(1);
    expect(getEvents().filter((e) => e.e === 'boss_drop')).toHaveLength(1);
  });
});

describe('门派（sect-neigong/spec.md §5）', () => {
  const st = () => useGameStore.getState();
  beforeEach(() => {
    vi.useRealTimers();
    st().hardReset();
    resetTelemetry();
  });

  it('境界 3 起拜入，一世只拜一派；转世清空门派与贡献、换得的秘籍保留', () => {
    useGameStore.setState({ realm: 2 });
    st().joinSect('shaolin');
    expect(st().sect).toBeNull();
    useGameStore.setState({ realm: 3, neigong: 'jingleijue', route: 'huashan' });
    st().joinSect('shaolin');                 // 不受路数限制
    st().joinSect('tangmen');                 // 不设叛出
    expect(st().sect).toBe('shaolin');
    useGameStore.setState({ contrib: 1000 });
    for (let i = 0; i < 7; i++) st().buySectItem('sect:luohanfumogun:1');   // 第一式残页 7 页 × 60 → 得这门武学
    expect(st().ownedWuxue).toContain('luohanfumogun');
    expect(st().contrib).toBe(1000 - 420);
    st().startSectTask('short');
    st().openRetire(); st().proceedRetire(); st().confirmRetire();
    expect(st().run).toBe(2);
    expect(st().sect).toBeNull();
    expect(st().contrib).toBe(0);
    expect(st().sectTask).toBeNull();
    expect(st().ownedWuxue).toContain('luohanfumogun');
    expect(st().pages['luohanfumogun:1']).toBe(7);
    expect(getEvents().filter((e) => e.e === 'sect_joined')).toHaveLength(1);
  });

  it('任务同时只跑一件；到点在线自动结算，离线照常计时', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    st().hardReset();
    useGameStore.setState({ realm: 3, sect: 'huashan' });
    st().startSectTask('short');
    st().startSectTask('long');
    expect(st().sectTask?.kind).toBe('short');
    vi.setSystemTime(1_000_000_000 + 2 * 3600 * 1000);
    st().tick(Date.now());
    expect(st().sectTask).toBeNull();
    expect(st().contrib).toBe(40);
    // 下线前派长差，9 小时后上线
    st().startSectTask('long');
    saveGame(st());
    vi.setSystemTime(Date.now() + 9 * 3600 * 1000);
    useGameStore.setState({ started: false });
    st().init();
    expect(st().sectTask).toBeNull();
    expect(st().contrib).toBe(160);
    vi.useRealTimers();
  });

  it('贡献商店（W2 只换残页）：第 5–7 式残页要先得这门武学、第 6 / 7 式再要前一式口诀；归真卷册要先有本派绝学内功', () => {
    useGameStore.setState({ realm: 3, sect: 'huashan', contrib: 5000 });
    st().buySectItem('sect:cangyajianjue:5');     // 未得苍崖九叠剑
    st().buySectItem('sect:juance:yuntaixinfa');  // 未得沧溟真经
    expect(st().contrib).toBe(5000);
    for (let i = 0; i < 7; i++) st().buySectItem('sect:cangyajianjue:1');
    expect(st().ownedWuxue).toEqual(['cangyajianjue']);
    st().buySectItem('sect:cangyajianjue:6');     // 要先拼齐第五式口诀
    expect(st().pages['cangyajianjue:6']).toBeUndefined();
    for (let i = 0; i < 7; i++) st().buySectItem('sect:cangyajianjue:5');
    st().buySectItem('sect:cangyajianjue:5');     // 已拼齐不再卖
    st().buySectItem('sect:cangyajianjue:6');
    st().buySectItem('sect:yuntaixinfa');
    st().buySectItem('sect:juance:yuntaixinfa');
    expect(st().pages).toEqual({ 'cangyajianjue:1': 7, 'cangyajianjue:5': 7, 'cangyajianjue:6': 1 });
    expect(st().ownedScrolls).toEqual(['juance:yuntaixinfa']);
    expect(st().ownedNeigong).toContain('yuntaixinfa');
    expect(st().contrib).toBe(5000 - 7 * 60 - 7 * 80 - 80 - 600 - 500);
    // 第五式口诀顶招式秘籍：领悟条件里「招式秘籍」已满足
    const gate = checkFormGate(WUXUE.cangyajianjue, 5, 4, 999, st().ownedScrolls.includes('cangyajianjue:5') || pagesFull(WUXUE.cangyajianjue, st().pages, 'cangyajianjue', 5), 99);
    expect(gate.scroll).toBe(true);
  });

  it('归真：有卷册才判顿悟', () => {
    const s = { neigong: 'yuntaixinfa' as const, zhong: 40, tiersPassed: 4 };
    expect(zhongGate({ ...s, ownedScrolls: [] })?.needScroll).toBe(true);
    expect(zhongGate({ ...s, ownedScrolls: ['juance:yuntaixinfa'] })?.needScroll).toBe(false);
  });

  it('本门绝学熟练阈值 ×0.8：苍崖九叠剑第一式出 5 次，拜华山即到「熟练」档（耗气 ×0.92、触发 ×1.04，倍率不变）', () => {
    const base = {
      realm: 4, neigong: 'shiguxinfa' as const, zhong: 10, ownedWuxue: ['cangyajianjue' as const], ownedScrolls: [],
      equipped: ['cangyajianjue' as const], formCasts: { 'cangyajianjue:1': 5 }, learnedForms: [], pastLearned: [],
    };
    const lo = (sect: 'huashan' | 'shaolin' | null) => buildLoadout({ ...base, sect })[0];
    expect(lo('huashan').forms[0].cost).toBe(Math.round(55 * 0.92));
    expect(lo(null).forms[0].cost).toBe(55);
    expect(lo('shaolin').forms[0].cost).toBe(55);
    expect(lo('huashan').forms[0].mult).toBeCloseTo(lo(null).forms[0].mult, 9);
    expect(lo('huashan').p).toBeCloseTo(0.25 * (1.04 + 1 + 1) / 3, 9);   // 触发加成取已领悟三式的平均
  });

  it('拜山传闻：突破入境界 2 后的下一场战斗记录说一次；解锁图 2 / 图 3 初入各说一次新派', () => {
    useGameStore.setState({ rumorPending: 1 });
    st().challengeStage(1, 0, 1);
    expect(st().battle?.rumor).toBe(1);
    expect(st().rumorPending).toBe(0);
  });

  it('九派按图出现：图 2 的三派要解锁洛阳近郊初入才拜得上；新派货架没有绝学内功与卷册', () => {
    useGameStore.setState({ realm: 3, tiersUnlocked: ['1-0'] });
    st().joinSect('wudang');
    expect(st().sect).toBeNull();
    useGameStore.setState({ tiersUnlocked: ['1-0', '2-0'] });
    st().joinSect('wudang');
    expect(st().sect).toBe('wudang');
    const shelf = sectShelfOf(st(), 'wudang');
    expect(shelf.map((it) => it.kind)).toEqual(['pages', 'pages', 'pages', 'pages']);
    expect(shelf[0]).toMatchObject({ wuxue: 'zhenwudangmoquan', form: 1, price: 60 });
    expect(sectShelfOf(st(), 'huashan').map((it) => it.kind)).toEqual(['neigong', 'pages', 'pages', 'pages', 'pages', 'pages', 'pages', 'pages', 'pages', 'juance']);
    expect(isBenmen('wudang', 'zhenwudangmoquan')).toBe(true);
    expect(isBenmen('wudang', 'cangyajianjue')).toBe(false);
  });

  it('打通图 1 初入 Boss 解锁图 2：下一场战斗说洛阳三派的传闻', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    const n = trackLength(1, 0);
    useGameStore.setState({ realm: 6, route: 'shaolin', neigong: 'zhenyuegong', zhong: 40, tiersPassed: 3, clearedStages: m1all.slice(0, n - 1), rumorPending: 0 });
    st().challengeStage(1, 0, n);
    for (let i = 0; i < 600 && !(st().battle?.resolved ?? false); i++) { vi.setSystemTime(Date.now() + 700); st().tick(Date.now()); }
    expect(st().battle!.result.win).toBe(true);
    expect(st().tiersUnlocked).toContain('2-0');
    expect(st().rumorPending).toBe(2);
    vi.useRealTimers();
  });
});

describe('gameStore · 装备与行囊（battle-loot/design.md §3）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const play = () => {
    const t0 = Date.now();
    for (let i = 1; i <= 300 && !(useGameStore.getState().battle?.resolved ?? false); i++) {
      useGameStore.getState().tick(t0 + i * 700);
    }
    return useGameStore.getState().battle!;
  };
  const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
  const mk = (slot: GearItem['slot'], grade: GearItem['grade'], sell = 10) =>
    ({ ...rollGear({ slot, grade, level: 2, clearSilver: 1 }, seq([0.3, 0.6, 0.5])), sell });

  it('传功前不掉装备；传功后每场胜利掷一次掉落，掉了进背包、记埋点、挂机计拾得', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);   // 必掉（0 < 6%）、必白；战斗全中
    useGameStore.setState({ realm: 5, route: null, neigong: null, zhong: 0, tiersPassed: 0 });
    useGameStore.getState().challengeStage(1, 0, 1);
    expect(play().reward!.gear).toBeUndefined();
    expect(useGameStore.getState().bag).toEqual([]);

    useGameStore.setState({ route: 'shaolin', neigong: 'zhenyuegong', zhong: 10, tiersPassed: 3, clearedStages: [stageKey(1, 0, 1)] });
    useGameStore.getState().idleAt(1, 0, 1);
    const b = play();
    expect(b.reward!.gear).toBeDefined();
    expect(b.reward!.gear!.grade).toBe(1);   // 入门关只出凡品 / 精良
    expect(b.reward!.gear!.level).toBe(b.enemy.x);
    const s = useGameStore.getState();
    expect(s.bag).toHaveLength(1);
    expect(s.bag[0].fresh).toBe(true);
    expect(s.idle!.loot).toBe(2);   // 装备一件 + 武学一式
    const ev = getEvents().find((e) => e.e === 'gear_dropped')!;
    expect(ev).toMatchObject({ stage: stageKey(1, 0, 1), grade: 1, sold: 0, offline: false });
  });

  it('穿戴进构筑：攻击按基础值相加再乘百分比；卸下回背包；卖出得银两；一键出售只卖上乘以下', () => {
    useGameStore.setState({ realm: 3, route: 'huashan', neigong: 'jingleijue', zhong: 5, tiersPassed: 2, silver: 100 });
    const sword = { ...mk('兵器', 3), base: { 攻击: 4 }, afx: [['atk', 5]] as GearItem['afx'] };
    const low = mk('佩饰', 1, 3);
    const mid = mk('暗器', 2, 7);
    const high = mk('衣甲', 4, 50);
    useGameStore.setState({ bag: [sword, low, mid, high] });
    const before = playerBuild(useGameStore.getState());

    useGameStore.getState().wearGear(sword.id);
    let s = useGameStore.getState();
    expect(s.worn.兵器?.id).toBe(sword.id);
    expect(s.bag.map((g) => g.id)).toEqual([low.id, mid.id, high.id]);
    expect(playerBuild(s).atk).toBeCloseTo((before.atk + 4) * 1.05, 9);
    expect(getEvents().some((e) => e.e === 'gear_equipped')).toBe(true);

    useGameStore.getState().sellGear(mid.id);
    s = useGameStore.getState();
    expect(s.silver).toBe(107);
    expect(s.bag.map((g) => g.id)).toEqual([low.id, high.id]);

    useGameStore.getState().sellGearBelow(3);
    s = useGameStore.getState();
    expect(s.silver).toBe(110);
    expect(s.bag.map((g) => g.id)).toEqual([high.id]);

    useGameStore.getState().unwearGear('兵器');
    s = useGameStore.getState();
    expect(s.worn.兵器).toBeUndefined();
    expect(s.bag.map((g) => g.id)).toEqual([high.id, sword.id]);
    expect(playerBuild(s).atk).toBeCloseTo(before.atk, 9);
    // 存档里带着行囊
    expect((loadGame() as { bag: GearItem[] }).bag).toHaveLength(2);
  });

  it('行囊满了：不比身上强的直接卖掉；比身上强的卖掉最差的腾位', () => {
    const full = Array.from({ length: 20 }, () => mk('衣甲', 1, 2));   // 20 × 4 = 80 格
    const worn = { 佩饰: mk('佩饰', 2) };
    const weak = mk('佩饰', 1, 9);
    expect(putInBag(full, worn, weak)).toEqual({ bag: full, sold: 9 });
    const strong = mk('佩饰', 3, 30);
    const r = putInBag(full, worn, strong);
    expect(r.sold).toBe(2);
    expect(r.bag).toHaveLength(20);
    expect(r.bag[19].id).toBe(strong.id);
    // 背包里全是比它好的：腾不出位，只能卖掉它自己
    const better = Array.from({ length: 20 }, () => mk('衣甲', 4, 2));
    expect(putInBag(better, {}, strong)).toEqual({ bag: better, sold: 30 });
  });

  it('转世清空行囊与穿戴（裁决 8）', () => {
    useGameStore.setState({
      realm: 5, route: 'shaolin', neigong: 'zhenyuegong', zhong: 10, tiersPassed: 3, peakRealm: 5,
      bag: [mk('佩饰', 2)], worn: { 兵器: mk('兵器', 3) },
      clearedStages: allStages().filter((e) => e.tier === 0 && e.map <= 3).map((e) => stageKey(e.map, e.tier, e.stage)),
      tiersUnlocked: ['1-0', '2-0', '3-0', '4-0'],
    });
    useGameStore.getState().openRetire();
    useGameStore.getState().proceedRetire();
    useGameStore.getState().confirmRetire();
    const s = useGameStore.getState();
    expect(s.run).toBe(2);
    expect(s.bag).toEqual([]);
    expect(s.worn).toEqual({});
  });

  it('rollDropFor：普通关 6%、精英 20%、Boss 必掉；品阶按本段位置取权重', () => {
    const normal = allStages().find((e) => e.kind === 'normal')!;
    const boss = allStages().find((e) => e.kind === 'boss')!;
    expect(rollDropFor(normal, seq([0.07]))).toBeNull();
    expect(rollDropFor(normal, seq([0.05, 0, 0, 0, 0, 0, 0]))).not.toBeNull();
    const d = rollDropFor(boss, seq([0.99, 0, 0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5]))!;
    expect(d.grade).toBe(2);   // Boss 必 +1
    expect(d.level).toBe(boss.x);
    expect(d.sell).toBe(Math.round(boss.reward.silver * 1));
    // 重打（裁决 38）：精英 / Boss 的掉落率按普通关 6% 算，品阶 +1 保留
    expect(rollDropFor(boss, seq([0.07]), true)).toBeNull();
    expect(rollDropFor(boss, seq([0.05, 0, 0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5]), true)!.grade).toBe(2);
  });
});

describe('武学掉落、书匣与兵器搭配（battle-loot/design.md §3.7 / §4）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });
  afterEach(() => { vi.restoreAllMocks(); });
  const st = () => useGameStore.getState();
  const play = () => {
    const t0 = Date.now();
    for (let i = 1; i <= 300 && !(st().battle?.resolved ?? false); i++) st().tick(t0 + i * 700);
    return st().battle!;
  };

  it('寻常整式：第一式全本即得这门武学；靠后的式先收书匣，前一式学会那一刻自动学会（逐式接续）', () => {
    const base = { ownedWuxue: [], books: [], pages: {} };
    const a = applyWuxueDrop(base, { id: 'jiyujian', k: 3, kind: 'book' });
    expect(a.ownedWuxue).toEqual([]);
    expect(a.books).toEqual(['jiyujian:3']);
    const b = applyWuxueDrop({ ...base, books: a.books }, { id: 'jiyujian', k: 1, kind: 'book' });
    expect(b.ownedWuxue).toEqual(['jiyujian']);
    // 第 3 式在匣但第 2 式未会：只会第 1 式；第 2 式一学会，第 3 式跟着会
    expect(learnedFormsOfStore({ learnedForms: [], books: b.books }, 'jiyujian')).toEqual([1]);
    expect(learnedFormsOfStore({ learnedForms: ['jiyujian:2'], books: b.books }, 'jiyujian')).toEqual([1, 2, 3]);
    // 重复全本原样保留（裁决 17）
    const c = applyWuxueDrop({ ...base, books: b.books, ownedWuxue: b.ownedWuxue }, { id: 'jiyujian', k: 3, kind: 'book' });
    expect(c.dup).toBe(true);
    expect(c.books).toEqual(b.books);
  });

  it('上乘残页：每式 5 页拼成口诀顶招式秘籍，第一式拼齐即得这门武学', () => {
    let s = { ownedWuxue: [] as string[], books: [] as string[], pages: {} as Record<string, number> };
    for (let i = 0; i < 4; i++) s = { ...s, ...applyWuxueDrop(s, { id: 'feipuduanyajian', k: 1, kind: 'page' }) };
    expect(s.ownedWuxue).toEqual([]);
    const r = applyWuxueDrop(s, { id: 'feipuduanyajian', k: 1, kind: 'page' });
    expect(r.have).toBe(5);
    expect(r.ownedWuxue).toEqual(['feipuduanyajian']);
    expect(r.dup).toBe(false);
    const more = applyWuxueDrop({ ...s, ...r }, { id: 'feipuduanyajian', k: 1, kind: 'page' });
    expect(more.dup).toBe(true);   // 拼齐后多出的残页原样留着
    expect(more.have).toBe(6);
  });

  it('rollWuxueDrop：普通关 3%、精英 10%、Boss 50%；境界 2 只出寻常全本，境界 3 起三成上乘残页，绝学不进池', () => {
    const seq = (v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
    expect(rollWuxueDrop(2, 'normal', seq([0.04]))).toBeNull();
    const book = rollWuxueDrop(2, 'normal', seq([0.02, 0.5, 0.5]))!;
    expect(book.kind).toBe('book');
    expect(WUXUE[book.id].quality).toBe('寻常');
    expect(book.k).toBeLessThanOrEqual(3);
    const page = rollWuxueDrop(3, 'boss', seq([0.4, 0.2, 0.5, 0.9]))!;
    expect(page.kind).toBe('page');
    expect(WUXUE[page.id].quality).toBe('上乘');
    expect(page.k).toBe(5);
    let x = 7; const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
    for (let i = 0; i < 2000; i++) { const d = rollWuxueDrop(5, 'boss', rng); if (d) expect(WUXUE[d.id].quality).not.toBe('绝学'); }
  });

  it('战斗胜利掷武学掉落：传功后才掉，全本记进书匣并上战报', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);   // 装备与武学都必掉；境界 2 池里只有寻常，掉第一式全本
    useGameStore.setState({ realm: 2, route: 'shaolin', neigong: 'zhenyuegong', zhong: 10, tiersPassed: 3, clearedStages: [stageKey(1, 0, 1)] });
    st().challengeStage(1, 0, 1);
    const b = play();
    const w = b.reward!.wuxue!;
    expect(w.kind).toBe('book');
    expect(w.k).toBe(1);
    expect(st().books).toEqual([fk(w.id, 1)]);
    expect(st().ownedWuxue).toEqual([w.id]);
    expect(getEvents().find((e) => e.e === 'wuxue_dropped')).toMatchObject({ wuxue: w.id, form: 1, kind: 'book', dup: false });
  });

  it('兵器搭配：器械武学要拿同类兵器、暗器武学要备暗器、肉身不挑；换兵器时不合的自动卸下', () => {
    useGameStore.setState({ realm: 5, neigong: 'jingleijue', route: 'huashan', ownedWuxue: ['liuyunjian', 'kaishanzhang', 'xiulizhen', 'pofengdao'] });
    st().equipWuxue('liuyunjian');   // 赤手：装不了剑法
    st().equipWuxue('xiulizhen');    // 没暗器
    st().equipWuxue('kaishanzhang');
    expect(st().equipped).toEqual(['kaishanzhang']);
    expect(handsOf(st())).toEqual({ weapon: null, anqi: false });

    const sword = gearOf('兵器', '剑'), saber = gearOf('兵器', '刀'), anqi = gearOf('暗器');
    useGameStore.setState({ bag: [sword, saber, anqi] });
    st().wearGear(sword.id);
    st().wearGear(anqi.id);
    st().equipWuxue('liuyunjian');
    st().equipWuxue('xiulizhen');
    st().equipWuxue('pofengdao');    // 持剑装不了刀法
    expect(st().equipped).toEqual(['kaishanzhang', 'liuyunjian', 'xiulizhen']);
    st().wearGear(saber.id);         // 换持刀：剑法卸下，暗器与肉身不动
    expect(st().equipped).toEqual(['kaishanzhang', 'xiulizhen']);
    st().equipWuxue('pofengdao');
    expect(st().equipped).toEqual(['kaishanzhang', 'xiulizhen', 'pofengdao']);
    st().unwearGear('暗器');          // 卸下暗器：暗器武学卸下
    expect(st().equipped).toEqual(['kaishanzhang', 'pofengdao']);
  });

  it('转世：书匣与残页跨世保留；第一批 66 门里名录参数都在', () => {
    useGameStore.setState({ realm: 3, books: ['jiyujian:2'], pages: { 'feipuduanyajian:1': 2 }, retireStep: 'confirm' });
    st().confirmRetire();
    expect(st().books).toEqual(['jiyujian:2']);
    expect(st().pages).toEqual({ 'feipuduanyajian:1': 2 });
    expect(Object.keys(WUXUE)).toHaveLength(66);
    expect(QUALITY_PARAMS.寻常.forms).toBe(3);
  });
});

describe('教学关、市集与黑市（battle-loot/design.md §5、裁决 20 / 31–35）', () => {
  beforeEach(() => {
    useGameStore.getState().hardReset();
    resetTelemetry();
  });
  afterEach(() => { vi.restoreAllMocks(); });
  const st = () => useGameStore.getState();
  const play = () => {
    const t0 = Date.now();
    for (let i = 1; i <= 400 && !(st().battle?.resolved ?? false); i++) st().tick(t0 + i * 700);
    return st().battle!;
  };

  it('第一世 1-7 必败，战败即遇见前辈：起身行礼后可在境界 1 选内功，开 1 个武学槽', () => {
    useGameStore.setState({ clearedStages: m1all.slice(0, 6) });
    st().challengeStage(1, 0, 7);
    const b = play();
    expect(b.result.win).toBe(false);
    expect(isTeachFailure(st())).toBe(true);
    st().dismissFailure();
    expect(st().taught).toBe(true);
    expect(getEvents().some((e) => e.e === 'elder_met')).toBe(true);
    st().selectNeigong('jingleijue');
    expect(st().neigong).toBe('jingleijue');
    expect(st().realm).toBe(1);
    expect(slotCount(1)).toBe(1);
    expect(slotCount(2)).toBe(2);
  });

  it('第二世起开局即选内功；前辈已传功跨世记住', () => {
    useGameStore.setState({ realm: 3, taught: true, neigong: 'jingleijue', route: 'huashan', retireStep: 'confirm' });
    st().confirmRetire();
    expect(st().run).toBe(2);
    expect(st().taught).toBe(true);
    expect(st().neigong).toBeNull();
    st().selectNeigong('zhenyuegong');
    expect(st().neigong).toBe('zhenyuegong');
  });

  it('市集在传功后第 8 关起首次战败时开张，跨世保留', () => {
    useGameStore.setState({ realm: 1, neigong: 'jingleijue', route: 'huashan', taught: true, clearedStages: m1all.slice(0, 7) });
    st().challengeStage(1, 0, 8);
    const b = play();
    expect(b.result.win).toBe(false);
    expect(st().marketOpen).toBe(true);
    expect(getEvents().some((e) => e.e === 'market_opened')).toBe(true);
    useGameStore.setState({ realm: 3, retireStep: 'confirm' });
    st().confirmRetire();
    expect(st().marketOpen).toBe(true);
  });

  it('兵器铺 / 衣饰铺按推关处定货：凡品 / 精良各一件，买下进行囊、计累计消费；满额那一笔解锁黑市并进演出', () => {
    useGameStore.setState({ realm: 3, neigong: 'jingleijue', route: 'huashan', marketOpen: true, silver: 100000, clearedStages: m1all.slice(0, 20) });
    const fs = frontierStageOf(st());
    expect(fs.stage).toBe(21);
    const { arms, wear } = marketGoodsOf(st());
    expect(arms).toHaveLength(10);
    expect(wear).toHaveLength(4);
    expect(arms.filter((g) => g.grade === 1)).toHaveLength(5);
    const basis = priceBasisOf(st());
    expect(basis).toBe(Math.max(...m1all.slice(0, 20).map((k) => getStage(1, 0, Number(k.slice(k.indexOf('s') + 1))).reward.silver)));
    expect(arms[0].price).toBe(basis * STALL_PRICE_MULT[1]);
    expect(arms[5].price).toBe(basis * STALL_PRICE_MULT[2]);
    const sword = arms.find((g) => g.cat === '剑' && g.grade === 1)!;
    st().buyMarketItem(sword.id);
    expect(st().bag).toHaveLength(1);
    expect(st().bag[0]).toMatchObject({ slot: '兵器', cat: '剑', grade: 1, level: fs.x, fresh: true });
    expect(st().silver).toBe(100000 - sword.price);
    expect(st().marketSpent).toBe(sword.price);
    expect(st().blackOpen).toBe(false);
    // 累计消费满额
    let guard = 0;
    const charm = wear.find((g) => g.slot === '佩饰' && g.grade === 1)!;   // 一格一件，行囊装得下 80 件
    while (!st().blackOpen && guard++ < 200) st().buyMarketItem(charm.id);
    expect(st().blackOpen).toBe(true);
    expect(st().blackIntro).toBe(true);
    expect(st().marketSpent).toBeGreaterThanOrEqual(BLACK_UNLOCK_SPENT);
    st().dismissBlackIntro();
    expect(st().blackIntro).toBe(false);
  });

  it('黑市：每轮三件蒙面货、买下才揭晓、每世有上限、连开三凡品后保底精良；转世清次数不清解锁', () => {
    useGameStore.setState({ realm: 3, neigong: 'jingleijue', route: 'huashan', marketOpen: true, blackOpen: true, silver: 10_000_000, clearedStages: m1all.slice(0, 20) });
    st().refreshBlack();
    expect(st().blackGoods).toHaveLength(3);
    expect(st().blackGoods.map((g) => g.mask.kind)).toEqual(['gear', 'gear', 'pages']);
    const day = st().blackDay;
    st().refreshBlack();   // 同一轮不换
    expect(st().blackDay).toBe(day);
    vi.spyOn(Math, 'random').mockReturnValue(0);   // 必开凡品
    const g0 = st().blackGoods[0];
    st().buyMasked(g0.id);
    expect(st().blackGoods[0].revealed).not.toBeNull();
    expect('gear' in st().blackGoods[0].revealed!).toBe(true);
    expect(st().blackBuys).toBe(1);
    expect(st().blackLowStreak).toBe(1);
    expect(st().bag).toHaveLength(1);
    st().buyMasked(g0.id);   // 已揭晓不能再买
    expect(st().blackBuys).toBe(1);
    st().buyMasked(st().blackGoods[2].id);   // 残谱：两页
    const p = (st().blackGoods[2].revealed as { pages: { id: string; k: number; n: number } }).pages;
    expect(p.n).toBe(2);
    expect(st().pages[`${p.id}:${p.k}`]).toBe(2);
    // 保底：连开三件凡品后第四件必精良以上（手工把流水推到 3）
    useGameStore.setState({ blackLowStreak: 3, blackGoods: st().blackGoods.map((g) => ({ ...g, revealed: null })), blackBuys: 0 });
    st().buyMasked(st().blackGoods[1].id);
    expect((st().blackGoods[1].revealed as { gear: GearItem }).gear.grade).toBeGreaterThanOrEqual(2);
    expect(st().blackLowStreak).toBe(0);
    // 每世十次
    useGameStore.setState({ blackBuys: BLACK_PER_LIFE, blackGoods: st().blackGoods.map((g) => ({ ...g, revealed: null })) });
    st().buyMasked(st().blackGoods[0].id);
    expect(st().blackGoods[0].revealed).toBeNull();
    useGameStore.setState({ retireStep: 'confirm' });
    st().confirmRetire();
    expect(st().blackOpen).toBe(true);
    expect(st().blackBuys).toBe(0);
  });
});
