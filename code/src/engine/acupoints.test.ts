/**
 * 窍穴 / 经脉 / 冲穴纯函数测试 —— 权威来源：docs/systems/zhoutian/design.md v4.0
 */
import { describe, expect, it } from 'vitest';
import {
  REALM_ACUPOINTS, currentSuccessRate, attemptAcupoint, basePForPos,
  breakthroughReady, totalAcupointBonus, acupointBonus, meridianBonus,
  isMeridianComplete, openedInRealm, acupointPos, requiredMeridian,
  requiredMeridianOpened, isLoosened, chongxueGate, blockingPrevAcupoint,
  neiliRatioForPos, neiliCostFor,
  FAIL_BONUS_PP, P_BASE, P_STEP, P_FLOOR, T_BASE, T_STEP, REALM_MUL,
  type AcupointState,
} from './acupoints';

const fresh = (failCount = 0): AcupointState => ({ failCount, opened: false });
/** 境界 2 手阳明：曲池（位次 1）→ 合谷（位次 2）；N=3 */
const R2 = { quchi: 'quchi', hegu: 'hegu', shaohai: 'shaohai' };
const opened = (...ids: string[]): Record<string, AcupointState> =>
  Object.fromEntries(ids.map(id => [id, { failCount: 0, opened: true }]));

describe('脉内位次 —— v4.0 一切按穴难度的来源（design.md §3.3）', () => {
  it('位次按经脉内次序，从 1 起', () => {
    expect(acupointPos(2, R2.quchi)).toBe(1);
    expect(acupointPos(2, R2.hegu)).toBe(2);
    // 另一条脉重新从 1 数，不跨脉累计
    expect(acupointPos(2, R2.shaohai)).toBe(1);
  });
  it('未接入境界或未知穴返回 0，不抛错', () => {
    expect(acupointPos(1, 'quchi')).toBe(0);
    expect(acupointPos(2, 'nonexistent')).toBe(0);
  });
});

describe('冲穴成功率（design.md §3.3：按位次递减 + 失败累进，无气势无必成）', () => {
  it('第 1/2/3 穴 = 90% / 80% / 70%', () => {
    expect(basePForPos(1)).toBeCloseTo(P_BASE, 10);
    expect(basePForPos(2)).toBeCloseTo(P_BASE - P_STEP, 10);
    expect(basePForPos(3)).toBeCloseTo(P_BASE - P_STEP * 2, 10);
  });
  it('再靠后也不低于下限 50%', () => {
    expect(basePForPos(9)).toBe(P_FLOOR);
  });
  it('同穴每失败一次 +10pp', () => {
    expect(currentSuccessRate(fresh(1), 2)).toBeCloseTo(basePForPos(2) + FAIL_BONUS_PP, 10);
    expect(currentSuccessRate(fresh(3), 3)).toBeCloseTo(basePForPos(3) + FAIL_BONUS_PP * 3, 10);
  });
  it('累进封顶 100%', () => {
    expect(currentSuccessRate(fresh(20), 3)).toBe(1);
  });
  it('v3 的「第 3 次必成」已废止：failCount=2 的第 3 穴仍会失败', () => {
    // 0.70 + 0.20 = 0.90，roll=0.95 仍落空
    expect(attemptAcupoint(fresh(2), 3, 0.95).success).toBe(false);
  });
});

describe('冲穴尝试（design.md §3.3）', () => {
  it('roll < p → 成功，failCount 不再累积', () => {
    const r = attemptAcupoint(fresh(1), 1, 0.5);
    expect(r.success).toBe(true);
    expect(r.opened).toBe(true);
    expect(r.newFailCount).toBe(1);
  });
  it('roll ≥ p → 失败，failCount+1（使下次 +10pp）', () => {
    const r = attemptAcupoint(fresh(0), 1, 0.95);   // p=0.90
    expect(r.success).toBe(false);
    expect(r.opened).toBe(false);
    expect(r.newFailCount).toBe(1);
  });
});

describe('所需真气（design.md §3.3：当前段配额 × 位次比例 × 境界乘数）', () => {
  it('境界 2 第 1/2 穴 = 11% / 16% 当前段配额', () => {
    expect(neiliRatioForPos(1, 2)).toBeCloseTo(T_BASE, 10);
    expect(neiliRatioForPos(2, 2)).toBeCloseTo(T_BASE + T_STEP, 10);
  });
  it('境界乘数 1.2^(境界−2)：同一位次越高境界越贵', () => {
    expect(neiliRatioForPos(1, 5)).toBeCloseTo(T_BASE * REALM_MUL ** 3, 10);
    expect(neiliRatioForPos(1, 5)).toBeGreaterThan(neiliRatioForPos(1, 2));
  });
  it('比例封顶 100%——松动即装得下，没有等丹田扩容的空窗', () => {
    expect(neiliRatioForPos(9, 9)).toBe(1);
  });
  it('按当前段配额折算成绝对值', () => {
    expect(neiliCostFor(2, R2.quchi, 1000)).toBeCloseTo(110, 6);
    expect(neiliCostFor(2, R2.hegu, 1000)).toBeCloseTo(160, 6);
  });
});

describe('松动 —— 周天圆满使真气行至下一穴（design.md §2）', () => {
  // 境界 2：N=3，须贯通手阳明（2 穴）→ 末 2 段依次松动（第 2、3 段）
  it('必贯通脉的第 k 穴在第 N−M+k 段圆满后松动', () => {
    expect(isLoosened(2, R2.quchi, 1, 3)).toBe(false);
    expect(isLoosened(2, R2.quchi, 2, 3)).toBe(true);
    expect(isLoosened(2, R2.hegu, 2, 3)).toBe(false);
    expect(isLoosened(2, R2.hegu, 3, 3)).toBe(true);
  });
  it('其余经脉的穴在末段圆满时一并松动', () => {
    expect(isLoosened(2, R2.shaohai, 2, 3)).toBe(false);
    expect(isLoosened(2, R2.shaohai, 3, 3)).toBe(true);
  });
  it('境界 5（N=8，督脉 3 穴）从第 6 段起依次松动', () => {
    const du = REALM_ACUPOINTS[5].meridians[0].acupointIds;
    expect(isLoosened(5, du[0], 5, 8)).toBe(false);
    expect(isLoosened(5, du[0], 6, 8)).toBe(true);
    expect(isLoosened(5, du[2], 7, 8)).toBe(false);
    expect(isLoosened(5, du[2], 8, 8)).toBe(true);
  });
});

describe('冲穴门槛（design.md §2：松动 / 循序 / 真气够）', () => {
  const base = { realm: 2, chargeHighWater: 3, zhoutianCount: 3, segmentQuota: 1000 };

  it('三条都满足 → ok', () => {
    expect(chongxueGate({ ...base, acupointId: R2.quchi, progress: {}, segmentNeili: 200 }))
      .toBe('ok');
  });
  it('真气未至 → not-loosened', () => {
    expect(chongxueGate({ ...base, chargeHighWater: 1, acupointId: R2.quchi, progress: {}, segmentNeili: 900 }))
      .toBe('not-loosened');
  });
  it('同脉前穴未通 → prev-unopened（不同脉不互相阻塞）', () => {
    expect(chongxueGate({ ...base, acupointId: R2.hegu, progress: {}, segmentNeili: 900 }))
      .toBe('prev-unopened');
    expect(chongxueGate({ ...base, acupointId: R2.shaohai, progress: {}, segmentNeili: 900 }))
      .toBe('ok');
  });
  it('当前段真气不足 → insufficient', () => {
    // 曲池要 110，只蓄了 100
    expect(chongxueGate({ ...base, acupointId: R2.quchi, progress: {}, segmentNeili: 100 }))
      .toBe('insufficient');
  });
  it('已通 → opened', () => {
    expect(chongxueGate({ ...base, acupointId: R2.quchi, progress: opened(R2.quchi), segmentNeili: 900 }))
      .toBe('opened');
  });
  it('挡路的前穴可取名，供「{前穴名} 未通」文案用', () => {
    expect(blockingPrevAcupoint(2, R2.hegu, {})?.name).toBe('曲池');
    expect(blockingPrevAcupoint(2, R2.hegu, opened(R2.quchi))).toBeNull();
  });
});

describe('突破条件 —— 首条经脉贯通（design.md §4）', () => {
  const N2 = 2800;   // 境界 2 突破消耗（content.ts）
  it('本境界须贯通的是表内首条经脉', () => {
    expect(requiredMeridian(2)?.name).toBe('手阳明');
    expect(requiredMeridian(4)?.name).toBe('任脉');
    expect(requiredMeridian(5)?.name).toBe('督脉');
    expect(requiredMeridian(1)).toBeNull();
  });
  it('丹田满 + 首脉贯通 → ready', () => {
    expect(breakthroughReady(N2, N2, 2, opened(R2.quchi, R2.hegu))).toBe(true);
  });
  it('丹田满但首脉缺一穴 → not ready', () => {
    expect(breakthroughReady(N2, N2, 2, opened(R2.quchi))).toBe(false);
  });
  it('通了别的脉不顶用——门槛只看首条脉', () => {
    const other = REALM_ACUPOINTS[2].meridians[1].acupointIds;
    expect(breakthroughReady(N2, N2, 2, opened(...other))).toBe(false);
  });
  it('丹田未满 + 首脉贯通 → not ready', () => {
    expect(breakthroughReady(N2 - 1, N2, 2, opened(R2.quchi, R2.hegu))).toBe(false);
  });
  it('未接入周天的境界只看丹田', () => {
    expect(breakthroughReady(N2, N2, 1, {})).toBe(true);
  });
  it('首脉进度读数', () => {
    expect(requiredMeridianOpened(2, opened(R2.quchi))).toBe(1);
    // 别的脉不计入首脉读数
    expect(requiredMeridianOpened(2, opened(R2.shaohai))).toBe(0);
  });
});

describe('加成计算（spec §6.3/§9）', () => {
  it('境界 2-4 单穴 +2%', () => {
    expect(acupointBonus(2)).toBe(0.02);
    expect(acupointBonus(3)).toBe(0.02);
    expect(acupointBonus(4)).toBe(0.02);
  });
  it('境界 5 单穴 +1.5%（预算比修订）', () => {
    expect(acupointBonus(5)).toBe(0.015);
  });
  it('贯通 = 单穴 × 1.5', () => {
    expect(meridianBonus(2)).toBe(0.03);
    expect(meridianBonus(5)).toBe(0.0225);
  });
  it('总加成 = 窍穴 + 贯通（加法合并）', () => {
    expect(totalAcupointBonus(4, 3, 1)).toBe(0.09);  // 3×2% + 1×3% = 9%
  });
});

describe('经脉贯通检查（spec §4.4）', () => {
  it('所有窍穴已通 → 贯通', () => {
    const m = { id: 'test', name: 'test', acupointIds: ['a', 'b'] };
    expect(isMeridianComplete(m, new Set(['a', 'b']))).toBe(true);
  });
  it('有窍穴未通 → 未贯通', () => {
    const m = { id: 'test', name: 'test', acupointIds: ['a', 'b'] };
    expect(isMeridianComplete(m, new Set(['a']))).toBe(false);
  });
});

describe('窍穴池数据完整性（spec §3）', () => {
  it('境界 2: 池 4, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[2];
    expect(d.acupoints).toHaveLength(4);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 3: 池 5, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[3];
    expect(d.acupoints).toHaveLength(5);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 4: 池 6, 经脉 2 条', () => {
    const d = REALM_ACUPOINTS[4];
    expect(d.acupoints).toHaveLength(6);
    expect(d.meridians).toHaveLength(2);
  });
  it('境界 5: 池 8, 经脉 3 条', () => {
    const d = REALM_ACUPOINTS[5];
    expect(d.acupoints).toHaveLength(8);
    expect(d.meridians).toHaveLength(3);
  });
  it('境界 1/6/7 不接入本版', () => {
    expect(REALM_ACUPOINTS[1]).toBeUndefined();
    expect(REALM_ACUPOINTS[6]).toBeUndefined();
    expect(REALM_ACUPOINTS[7]).toBeUndefined();
  });
});

describe('openedInRealm · 突破 M 条件按境界计（design.md §4，对齐 sim.py 建模）', () => {
  it('只数本境界的窍穴，不跨境界累计', () => {
    const progress: Record<string, AcupointState> = {};
    // 境界 2 全通（4 穴）
    for (const a of REALM_ACUPOINTS[2].acupoints) {
      progress[a.id] = { failCount: 0, opened: true };
    }
    expect(openedInRealm(2, progress)).toBe(4);
    // 境界 3 一个没通 —— 旧的全局累计口径会误判为 4，导致 M 形同虚设
    expect(openedInRealm(3, progress)).toBe(0);
  });

  it('未冲/冲失败的窍穴不计入', () => {
    const [a1, a2] = REALM_ACUPOINTS[3].acupoints;
    const progress: Record<string, AcupointState> = {
      [a1.id]: { failCount: 2, opened: false },
      [a2.id]: { failCount: 1, opened: true },
    };
    expect(openedInRealm(3, progress)).toBe(1);
  });

  it('未接入的境界返回 0，不抛错', () => {
    expect(openedInRealm(1, {})).toBe(0);
    expect(openedInRealm(6, {})).toBe(0);
  });

  it('窍穴 id 与位置解耦：id 不含境界/脉序编码', () => {
    for (const realm of [2, 3, 4, 5]) {
      for (const a of REALM_ACUPOINTS[realm].acupoints) {
        expect(a.id).not.toMatch(/^r\d+-[am]\d+$/);
      }
    }
  });

  it('经脉的 acupointIds 与窍穴的 meridianId 互相自洽', () => {
    for (const realm of [2, 3, 4, 5]) {
      const { acupoints, meridians } = REALM_ACUPOINTS[realm];
      for (const m of meridians) {
        for (const id of m.acupointIds) {
          expect(acupoints.find(a => a.id === id)?.meridianId).toBe(m.id);
        }
      }
      // 每个窍穴都被恰好一条经脉收录
      expect(meridians.flatMap(m => m.acupointIds).sort())
        .toEqual(acupoints.map(a => a.id).sort());
    }
  });
});
