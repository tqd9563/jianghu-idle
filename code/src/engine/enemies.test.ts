/**
 * 长线关卡表完整性（content.md §2.0 v2.3；数据由 export_stage_table.py 生成）。
 */
import { describe, expect, it } from 'vitest';
import { fight } from './combat';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';
import { GIFT_WUXUE_OPTIONS } from './wuxue';
import {
  allStages, enemyStatsAt, getStage, isSealed, MAP_IDS, parseStageKey, stageKey, TEACH_X, TIERS, trackLength,
} from './enemies';

describe('长线关卡表', () => {
  it('开放 9 条前沿、共 318 关（一图一难度 40 关上下：境界 2 段关距 0.14、传功缓坡 5 关；其余前沿 30–38 关）；图 3 绝境、图 4 历练 / 绝境、图 5 全部封存', () => {
    const open = MAP_IDS.flatMap((m) => TIERS.filter((t) => !isSealed(m, t)).map((t) => `${m}-${t}`));
    expect(open).toEqual(['1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '4-0']);
    expect(allStages()).toHaveLength(318);
    expect(trackLength(5, 0)).toBe(0);
  });

  it('每条前沿以 Boss 收尾，中段没有别的 Boss（多天一世后图 1 初入的头目取消）', () => {
    for (const m of MAP_IDS) {
      for (const t of TIERS) {
        const n = trackLength(m, t);
        if (n === 0) continue;
        expect(getStage(m, t, n).kind).toBe('boss');
        const midBosses = Array.from({ length: n - 1 }, (_, i) => getStage(m, t, i + 1)).filter((e) => e.kind === 'boss');
        expect(midBosses.length).toBe(0);
      }
    }
  });

  it('精英每 8 关一个、带机制标签、有名号；普通关不带标签', () => {
    for (const e of allStages()) {
      if (e.kind === 'elite') {
        expect(e.tags.length).toBeGreaterThan(0);
        expect(e.name).toMatch(/^「.+」/);
      }
      if (e.kind === 'normal') expect(e.tags).toEqual([]);
    }
    const elites = allStages().filter((e) => e.kind === 'elite');
    expect(elites.length).toBe(35);
    expect(new Set(elites.map((e) => e.name)).size).toBe(elites.length);   // 名号不重复
  });

  it('关卡不掉内力；敌人属性由当量换算', () => {
    const e = getStage(2, 1, 1);
    expect(e.reward.neili).toBe(0);
    const st = enemyStatsAt(e.x!, e.tags);
    expect(e.hp).toBeCloseTo(st.hp, 9);
    expect(e.defK).toBeCloseTo(st.defK, 9);
  });

  it('图 1 初入前 6 关是入门关：境界 1 未选内功的裸属性实战胜率 ≥ 90%，第 7 关起要境界 2', () => {
    const bare = playerBuild({ realm: 1, neigong: null, zhong: 0, tiersPassed: 0, injuries: undefined });
    for (let st = 1; st <= 6; st++) {
      const e = getStage(1, 0, st);
      expect(e.recommendedRealm).toBe(1);
      let wins = 0;
      for (let i = 0; i < 400; i++) if (fight(bare, e, { mode: 'rng' }).win) wins++;
      expect(wins / 400).toBeGreaterThanOrEqual(0.9);
    }
    expect(getStage(1, 0, 7).recommendedRealm).toBe(1);
  });

  it('传功缓坡（第 7–11 关）：每关 +0.15；刚传功的百川诀 + 前辈所授任一门打第 7 关胜率 ≥ 90%，裸属性打教学战强度全败；第 12 关起要境界 2', () => {
    for (let st = 7; st <= 11; st++) {
      expect(getStage(1, 0, st).recommendedRealm).toBe(1);
      expect(getStage(1, 0, st).x).toBeCloseTo(2 + (st - 7) * 0.15, 4);
    }
    expect(getStage(1, 0, 12).recommendedRealm).toBe(2);
    expect(getStage(1, 0, 12).x).toBeCloseTo(TEACH_X, 4);
    for (const gift of GIFT_WUXUE_OPTIONS) {
      const taught = { realm: 1, neigong: 'jingleijue' as const, zhong: 0, tiersPassed: 0, injuries: undefined,
        ownedWuxue: [gift], equipped: [gift], formCasts: {}, pages: [] };
      const b = playerBuild(taught);
      let wins = 0;
      for (let i = 0; i < 400; i++) {
        if (fight(b, getStage(1, 0, 7), { mode: 'rng', loadout: buildLoadout(taught), qiMax: qiMaxOf(taught) }).win) wins++;
      }
      expect(wins / 400, gift).toBeGreaterThanOrEqual(0.9);
    }
    const bare = playerBuild({ realm: 1, neigong: null, zhong: 0, tiersPassed: 0, injuries: undefined });
    const teach = { ...getStage(1, 0, 7), ...enemyStatsAt(TEACH_X) };
    for (let i = 0; i < 400; i++) expect(fight(bare, teach, { mode: 'rng' }).win).toBe(false);
  });

  it('关卡键可往返解析', () => {
    expect(parseStageKey(stageKey(3, 1, 12))).toEqual({ map: 3, tier: 1, stage: 12 });
    expect(parseStageKey('m1s8')).toBeNull();
  });
});
