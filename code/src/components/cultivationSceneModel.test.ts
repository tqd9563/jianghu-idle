/**
 * 修炼面板纯视图模型测试 —— 权威：docs/systems/zhoutian/spec.md §4、design.md §3–§4
 */
import { describe, expect, it } from 'vitest';
import { buildSceneModel, type SceneInput } from './cultivationSceneModel';
import { REALM_ACUPOINTS } from '../engine/acupoints';

const at = (o: Partial<SceneInput> = {}): SceneInput => ({
  realm: 2, dantian: 0, breakCost: 2800, chargeHighWater: 0, acupointProgress: {}, ...o,
});

describe('修炼面板模型 · 周天与液面', () => {
  it('境界圆满（无突破消耗）返回 null，不渲染面板', () => {
    expect(buildSceneModel(at({ breakCost: null }))).toBeNull();
  });

  it('月相数 = 本境界周天数，三态随已缴段推进', () => {
    const m = buildSceneModel(at({ realm: 4, breakCost: 10000, dantian: 10000 / 6 * 2.5 }))!;
    expect(m.zhoutianCount).toBe(6);
    expect(m.moons).toHaveLength(6);
    expect(m.moons.map(x => x.phase)).toEqual(
      ['full', 'full', 'waxing', 'new', 'new', 'new']
    );
  });

  it('液面留空随段进度单调下降，且留出上下呼吸空间', () => {
    const empty = (pct: number) =>
      buildSceneModel(at({ dantian: 2800 / 3 * pct }))!.emptyPct;
    expect(empty(0)).toBeCloseTo(92, 5);          // 空池不贴顶
    // 注意 pct=1 会进位到下一段、段内归零，故取逼近值
    expect(empty(0.99)).toBeGreaterThan(6);       // 满池不贴底
    expect(empty(0.99)).toBeLessThan(8);
    expect(empty(0.5)).toBeLessThan(empty(0.2));  // 单调
  });

  it('挂满一段后液面归零、月相进位', () => {
    const m = buildSceneModel(at({ dantian: 2800 / 3 }))!;
    expect(m.segmentsFull).toBe(1);
    expect(m.currentSegmentPct).toBeCloseTo(0, 5);
    expect(m.moons[0].phase).toBe('full');
  });
});

describe('修炼面板模型 · 星曜三态与经脉', () => {
  it('真气未至时全为墨星（design.md §2 松动）', () => {
    const dim = buildSceneModel(at())!;
    expect(dim.meridians.flatMap(m => m.stars).every(s => s.state === 'dim')).toBe(true);
    expect(dim.meridians[0].stars[0].gate).toBe('not-loosened');
  });

  it('松动 + 真气够 → 首穴转朱砂；同脉后穴仍被「循序而行」挡住', () => {
    // 境界 2：N=3、须贯通手阳明（2 穴）→ 第 2 段圆满松动首穴
    const m = buildSceneModel(at({ chargeHighWater: 2, dantian: 2800 / 3 * 2 + 400 }))!;
    const [first, second] = m.meridians[0].stars;
    expect(first.state).toBe('actionable');
    expect(second.gate).toBe('not-loosened');     // 第 3 段才松动
    // 另一条脉要等末段
    expect(m.meridians[1].stars[0].gate).toBe('not-loosened');
  });

  it('松动了但当前段真气不够 → 墨星，且原因是 insufficient', () => {
    // 第 2 段圆满、当前段只蓄了 1 点：曲池要 2800/3×11% ≈ 103
    const m = buildSceneModel(at({ chargeHighWater: 2, dantian: 2800 / 3 * 2 + 1 }))!;
    const star = m.meridians[0].stars[0];
    expect(star.state).toBe('dim');
    expect(star.gate).toBe('insufficient');
    expect(star.neiliCost).toBeCloseTo(2800 / 3 * 0.11, 6);
  });

  it('前穴未通时给出挡路穴名，供「{前穴名} 未通」文案用', () => {
    const m = buildSceneModel(at({ chargeHighWater: 3, dantian: 2800 }))!;
    const second = m.meridians[0].stars[1];
    expect(second.gate).toBe('prev-unopened');
    expect(second.blockedBy).toBe('曲池');
  });

  it('已通窍穴恒为金星，不因机会归零而回落', () => {
    const [a] = REALM_ACUPOINTS[2].acupoints;
    const m = buildSceneModel(at({ acupointProgress: { [a.id]: { failCount: 0, opened: true } } }))!;
    const star = m.meridians.flatMap(x => x.stars).find(s => s.id === a.id)!;
    expect(star.state).toBe('opened');
  });

  it('一条经脉全通才点亮贯通', () => {
    const m1 = REALM_ACUPOINTS[2].meridians[0];
    const partial = buildSceneModel(at({
      acupointProgress: { [m1.acupointIds[0]]: { failCount: 0, opened: true } },
    }))!;
    expect(partial.meridians[0].through).toBe(false);
    const full = buildSceneModel(at({
      acupointProgress: Object.fromEntries(
        m1.acupointIds.map(id => [id, { failCount: 0, opened: true }])
      ),
    }))!;
    expect(full.meridians[0].through).toBe(true);
  });

  it('境界 5 的三条经脉各有独立星官扇区，星曜不重叠', () => {
    const m = buildSceneModel(at({ realm: 5, breakCost: 21000 }))!;
    expect(m.meridians).toHaveLength(3);
    const pts = m.meridians.flatMap(x => x.stars).map(s => `${s.x.toFixed(0)},${s.y.toFixed(0)}`);
    expect(new Set(pts).size).toBe(8);
  });

  it('openedThisRealm 按境界计，不把别的境界的穴算进来', () => {
    const r2 = REALM_ACUPOINTS[2].acupoints[0];
    const m = buildSceneModel(at({
      realm: 3, breakCost: 5000,
      acupointProgress: { [r2.id]: { failCount: 0, opened: true } },
    }))!;
    expect(m.openedThisRealm).toBe(0);
  });

  it('突破门槛读数只看首条经脉（design.md §4）', () => {
    const [m1, m2] = REALM_ACUPOINTS[2].meridians;
    const m = buildSceneModel(at({
      acupointProgress: Object.fromEntries(
        m2.acupointIds.map(id => [id, { failCount: 0, opened: true }])
      ),
    }))!;
    expect(m.requiredMeridianName).toBe(m1.name);
    expect(m.requiredMeridianSize).toBe(m1.acupointIds.length);
    // 通的是另一条脉，首脉读数仍为 0
    expect(m.requiredMeridianOpened).toBe(0);
    expect(m.openedThisRealm).toBe(m2.acupointIds.length);
  });
});

describe('修炼面板模型 · 氛围绑定', () => {
  it('罡气仅炉火纯青（境界 4）起显影', () => {
    expect(buildSceneModel(at({ realm: 3, breakCost: 5000 }))!.auraOpacity).toBe(0);
    expect(buildSceneModel(at({ realm: 4, breakCost: 10000 }))!.auraOpacity).toBeGreaterThan(0);
  });

  it('丹田满时 segmentsFull 抵满额、段进度归零——渲染层据此走「圆满」而非「第 N 转 0%」', () => {
    const full = buildSceneModel(at({ dantian: 2800, chargeHighWater: 3 }))!;
    expect(full.segmentsFull).toBe(full.zhoutianCount);   // 三周天全满
    expect(full.currentSegmentPct).toBe(0);               // 段进度为 0，但含义是「已满」不是「刚起步」
    // 未满时才是真正的「第 N 转 x%」
    const midway = buildSceneModel(at({ dantian: 2800 * 0.5 }))!;
    expect(midway.segmentsFull).toBeLessThan(midway.zhoutianCount);
  });

  it('气流随境界与段进度加快（周期变短）', () => {
    const slow = buildSceneModel(at({ realm: 2 }))!.qiSpeedSec;
    const fast = buildSceneModel(at({ realm: 5, breakCost: 21000 }))!.qiSpeedSec;
    expect(fast).toBeLessThan(slow);
  });
});
