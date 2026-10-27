/**
 * 修炼面板纯视图模型测试 —— 权威：docs/systems/zhoutian/spec.md §4、design.md §3–§4
 */
import { describe, expect, it } from 'vitest';
import { buildSceneModel, cultLayout, defaultSelection, moonArc, moonLitPath, type SceneInput } from './cultivationSceneModel';
import { REALM_ACUPOINTS } from '../engine/acupoints';

const at = (o: Partial<SceneInput> = {}): SceneInput => ({
  // 总额 7,000 分 3 段、公比 2：各段 1,000 / 2,000 / 4,000，累计 1,000 / 3,000 / 7,000
  realm: 2, dantian: 0, breakCost: 7000, chargeHighWater: 0, acupointProgress: {}, ...o,
});

describe('修炼面板模型 · 周天与月相', () => {
  it('境界圆满（无突破消耗）返回 null，不渲染面板', () => {
    expect(buildSceneModel(at({ breakCost: null }))).toBeNull();
  });

  it('月相数 = 本境界周天数，三态随已缴段推进', () => {
    // 6 段、总额 63,000：各段 1,000 × 2^(i−1)；缴满两段（3,000）+ 第三段一半（2,000）
    const m = buildSceneModel(at({ realm: 4, breakCost: 63000, dantian: 5000 }))!;
    expect(m.zhoutianCount).toBe(6);
    const arc = moonArc(m.zhoutianCount, m.segmentsFull, m.currentSegmentPct, 128);
    expect(arc).toHaveLength(6);
    expect(arc.map(x => (x.lit >= 1 ? 'full' : x.lit > 0 ? 'waxing' : 'new'))).toEqual(
      ['full', 'full', 'waxing', 'new', 'new', 'new']
    );
  });

  it('月相受光区：新月无路径、满月为整圆、上下弦两侧对称', () => {
    expect(moonLitPath(0)).toBe('');
    expect(moonLitPath(1)).toContain('A 100 100 0 1 1');
    expect(moonLitPath(0.25)).toContain('A 50 100 0 0 0');
    expect(moonLitPath(0.75)).toContain('A 50 100 0 0 1');
  });

  it('挂满一段后月相进位、本段归零', () => {
    const m = buildSceneModel(at({ dantian: 1000 }))!;
    expect(m.segmentsFull).toBe(1);
    expect(m.currentSegmentPct).toBeCloseTo(0, 5);
    expect(moonArc(3, m.segmentsFull, m.currentSegmentPct, 128)[0].lit).toBe(1);
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
    // 当前段（第 3 段）配额 4,000，曲池要 11% = 440
    const m = buildSceneModel(at({ chargeHighWater: 2, dantian: 3000 + 500 }))!;
    const [first, second] = m.meridians[0].stars;
    expect(first.state).toBe('actionable');
    expect(second.gate).toBe('not-loosened');     // 第 3 段才松动
    // 另一条脉要等末段
    expect(m.meridians[1].stars[0].gate).toBe('not-loosened');
  });

  it('松动了但当前段真气不够 → 墨星，且原因是 insufficient', () => {
    // 第 2 段圆满、当前段只蓄了 1 点：曲池要当前段配额 4,000 × 11% = 440
    const m = buildSceneModel(at({ chargeHighWater: 2, dantian: 3000 + 1 }))!;
    const star = m.meridians[0].stars[0];
    expect(star.state).toBe('dim');
    expect(star.gate).toBe('insufficient');
    expect(star.neiliCost).toBeCloseTo(4000 * 0.11, 6);
  });

  it('前穴未通时给出挡路穴名，供「{前穴名} 未通」文案用', () => {
    const m = buildSceneModel(at({ chargeHighWater: 3, dantian: 7000 }))!;
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

  it('每个境界的窍穴都落在身上、彼此不挤在一起，路线依次穿过本脉各穴', () => {
    for (const realm of [1, 2, 3, 4, 5]) {
      const m = buildSceneModel(at({ realm, breakCost: 21000 }))!;
      const stars = m.meridians.flatMap(x => x.stars);
      expect(stars).toHaveLength(REALM_ACUPOINTS[realm].acupoints.length);
      for (const a of stars) for (const b of stars) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(28);
      }
      for (const mer of m.meridians) {
        const idx = mer.stars.map(st => mer.route.findIndex(([x, y]) => x === st.x && y === st.y));
        expect(idx.every(i => i >= 0)).toBe(true);
        expect([...idx].sort((p, q) => p - q)).toEqual(idx);
      }
    }
  });

  it('经脉亮段：通到哪穴亮到哪，贯通则整条亮', () => {
    const [m1] = REALM_ACUPOINTS[3].meridians;
    const op = (ids: string[]) => Object.fromEntries(ids.map(id => [id, { failCount: 0, opened: true }]));
    const none = buildSceneModel(at({ realm: 3, breakCost: 5000 }))!.meridians[0];
    expect(none.litRoute).toHaveLength(0);
    const one = buildSceneModel(at({ realm: 3, breakCost: 5000, acupointProgress: op(m1.acupointIds.slice(0, 1)) }))!.meridians[0];
    expect(one.litRoute.at(-1)).toEqual([one.stars[0].x, one.stars[0].y]);
    const all = buildSceneModel(at({ realm: 3, breakCost: 5000, acupointProgress: op(m1.acupointIds) }))!.meridians[0];
    expect(all.litRoute).toEqual(all.route);
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

describe('修炼面板模型 · 进度与默认选中', () => {
  it('丹田满时 segmentsFull 抵满额、段进度归零——渲染层据此走「圆满」而非「第 N 转 0%」', () => {
    const full = buildSceneModel(at({ dantian: 7000, chargeHighWater: 3 }))!;
    expect(full.segmentsFull).toBe(full.zhoutianCount);
    expect(full.currentSegmentPct).toBe(0);
    expect(full.totalPct).toBe(1);
    const midway = buildSceneModel(at({ dantian: 3500 }))!;
    expect(midway.segmentsFull).toBeLessThan(midway.zhoutianCount);
  });

  it('默认选中破境那条脉上可冲的穴；都不可冲时落在破境脉上第一个未通', () => {
    const idle = buildSceneModel(at())!;
    expect(defaultSelection(idle)).toBe(REALM_ACUPOINTS[2].meridians[0].acupointIds[0]);
    const ready = buildSceneModel(at({ chargeHighWater: 2, dantian: 3500 }))!;
    expect(defaultSelection(ready)).toBe('quchi');
  });
});

describe('修炼页版面', () => {
  it('宽舞台：人物整身在画里，月在人与题跋之间且不压字', () => {
    const L = cultLayout(1032, 900);
    expect(L.artLeft + 0.15 * L.artW).toBeGreaterThan(0);
    expect(L.moon.x + L.moon.d / 2).toBeLessThan(1032 - 40 - L.text.w);
  });
  it('窄舞台：月挪到题跋上方，题跋在月下', () => {
    const L = cultLayout(750, 865);
    expect(L.text.top).toBeGreaterThan(L.moon.y + L.moon.d / 2);
  });
});
