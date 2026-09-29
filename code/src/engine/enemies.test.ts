/**
 * 长线关卡表完整性（content.md §2.0 v2.3；数据由 export_stage_table.py 生成）。
 */
import { describe, expect, it } from 'vitest';
import {
  allStages, enemyStatsAt, getStage, isSealed, MAP_IDS, parseStageKey, stageKey, TIERS, trackLength,
} from './enemies';

describe('长线关卡表', () => {
  it('开放 9 条前沿、共 137 关；图 3 绝境、图 4 历练 / 绝境、图 5 全部封存', () => {
    const open = MAP_IDS.flatMap((m) => TIERS.filter((t) => !isSealed(m, t)).map((t) => `${m}-${t}`));
    expect(open).toEqual(['1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '4-0']);
    expect(allStages()).toHaveLength(137);
    expect(trackLength(5, 0)).toBe(0);
  });

  it('每条前沿以 Boss 收尾；图 1 初入中段另有一个头目', () => {
    for (const m of MAP_IDS) {
      for (const t of TIERS) {
        const n = trackLength(m, t);
        if (n === 0) continue;
        expect(getStage(m, t, n).kind).toBe('boss');
        const midBosses = Array.from({ length: n - 1 }, (_, i) => getStage(m, t, i + 1)).filter((e) => e.kind === 'boss');
        expect(midBosses.length).toBe(m === 1 && t === 0 ? 1 : 0);
      }
    }
  });

  it('精英每 4 关一个、带机制标签、有名号；普通关不带标签', () => {
    for (const e of allStages()) {
      if (e.kind === 'elite') {
        expect(e.tags.length).toBeGreaterThan(0);
        expect(e.name).toMatch(/^「.+」/);
      }
      if (e.kind === 'normal') expect(e.tags).toEqual([]);
    }
    const elites = allStages().filter((e) => e.kind === 'elite');
    expect(elites.length).toBeGreaterThanOrEqual(25);
    expect(new Set(elites.map((e) => e.name)).size).toBe(elites.length);   // 名号不重复
  });

  it('关卡不掉内力；敌人属性由当量换算', () => {
    const e = getStage(2, 1, 1);
    expect(e.reward.neili).toBe(0);
    const st = enemyStatsAt(e.x!, e.tags);
    expect(e.hp).toBeCloseTo(st.hp, 9);
    expect(e.defK).toBeCloseTo(st.defK, 9);
  });

  it('关卡键可往返解析', () => {
    expect(parseStageKey(stageKey(3, 1, 12))).toEqual({ map: 3, tier: 1, stage: 12 });
    expect(parseStageKey('m1s8')).toBeNull();
  });
});
