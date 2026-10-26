/**
 * 单线关卡表完整性（living-jianghu/design.md §2.2；数据由 export_stage_line.py 生成）。
 */
import { describe, expect, it } from 'vitest';
import { fight } from './combat';
import { buildLoadout, playerBuild, qiMaxOf } from '../store/gameStore';
import { GIFT_WUXUE_OPTIONS } from './wuxue';
import {
  allStages, bandPos, enemyStatsAt, getStage, isChapterBoss, MAP_IDS, mapDef, parseStageKey, stageKey, TEACH_X, trackLength,
  unlocksAfterMap, VOLUMES,
} from './enemies';

const lcg = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

describe('单线关卡表', () => {
  it('十卷 66 张图（赶路 10、据点 56）、1,049 关、精英 84、Boss 28（design.md §2.7）', () => {
    expect(VOLUMES).toHaveLength(10);
    expect(MAP_IDS).toHaveLength(66);
    expect(MAP_IDS.filter((m) => mapDef(m).layer === 'road')).toHaveLength(10);
    const all = allStages();
    expect(all).toHaveLength(1049);
    expect(all.filter((e) => e.kind === 'elite')).toHaveLength(84);
    expect(all.filter((e) => e.kind === 'boss')).toHaveLength(28);
  });

  it('每卷一张赶路图打头，其后每章外围、门户各一张；卷一一章、其余三章', () => {
    for (const v of VOLUMES) {
      const layers = v.maps.map((m) => mapDef(m).layer);
      expect(layers[0]).toBe('road');
      expect(layers.slice(1)).toEqual(Array.from({ length: v.factions.length }, () => ['outer', 'gate']).flat());
      expect(v.factions.length).toBe(v.no === 1 ? 1 : 3);
    }
  });

  it('据点图中段一名副手；外围末关镇守、门户末关 Boss；赶路图不设岗位；普通关不带标签', () => {
    for (const m of MAP_IDS) {
      const d = mapDef(m);
      const n = trackLength(m);
      const kinds = Array.from({ length: n }, (_, i) => getStage(m, i + 1).kind);
      if (d.layer === 'road') { expect(kinds.every((k) => k === 'normal')).toBe(true); continue; }
      expect(kinds[Math.floor((n + 1) / 2) - 1]).toBe('elite');
      expect(kinds[n - 1]).toBe(d.layer === 'outer' ? 'elite' : 'boss');
      expect(kinds.filter((k) => k !== 'normal')).toHaveLength(2);
      expect(isChapterBoss(m, n)).toBe(d.layer === 'gate');
    }
    for (const e of allStages()) {
      if (e.kind === 'normal') expect(e.tags).toEqual([]);
      else expect(e.tags.length).toBeGreaterThan(0);
    }
    const strong = allStages().filter((e) => e.kind !== 'normal');
    expect(new Set(strong.map((e) => e.name)).size).toBe(strong.length);   // 岗位称呼不重复
  });

  it('同一卷并排各章同高：各家外围、门户的关卡当量逐关相同', () => {
    for (const v of VOLUMES.filter((x) => x.factions.length > 1)) {
      const outers = v.maps.filter((m) => mapDef(m).layer === 'outer');
      const xs = (m: number) => Array.from({ length: trackLength(m) }, (_, i) => getStage(m, i + 1).x);
      for (const o of outers.slice(1)) expect(xs(o)).toEqual(xs(outers[0]));
    }
  });

  it('普通关沿主线当量单调不降；各境界末卷门户 Boss 推荐境界 +1，卷十门户为收官 Boss', () => {
    const main = VOLUMES.flatMap((v) => v.maps.slice(0, 3));
    const xs = main.flatMap((m) => Array.from({ length: trackLength(m) }, (_, i) => getStage(m, i + 1)).filter((e) => e.kind === 'normal').map((e) => e.x!));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
    const gateBoss = (v: number) => { const g = VOLUMES[v - 1].maps[2]; return getStage(g, trackLength(g)); };
    for (const [v, realm] of [[4, 3], [6, 4], [8, 5], [10, 6]] as const) expect(gateBoss(v).recommendedRealm).toBe(realm);
    expect(gateBoss(10).final).toBe(true);
    expect(gateBoss(9).final).toBe(false);
  });

  it('开放次序：赶路 → 本卷各家外围 → 同章门户 → 下一卷赶路', () => {
    const v2 = VOLUMES[1].maps;
    expect(unlocksAfterMap(v2[0])).toEqual([v2[1], v2[3], v2[5]]);
    expect(unlocksAfterMap(v2[1])).toEqual([v2[2]]);
    expect(unlocksAfterMap(v2[4])).toEqual([VOLUMES[2].maps[0]]);
    expect(unlocksAfterMap(VOLUMES[9].maps[2])).toEqual([]);
  });

  it('装备品阶位置按境界段：段首 0、段末 1', () => {
    expect(bandPos(VOLUMES[1].maps[0], 1)).toBeGreaterThan(0);
    expect(bandPos(VOLUMES[3].maps[2], 19)).toBeCloseTo(1, 1);
    expect(bandPos(VOLUMES[4].maps[0], 1)).toBeCloseTo(0, 5);
  });

  it('关卡不掉内力；敌人属性由当量换算', () => {
    const e = getStage(5, 1);
    expect(e.reward.neili).toBe(0);
    const st = enemyStatsAt(e.x!, e.tags);
    expect(e.hp).toBeCloseTo(st.hp, 9);
    expect(e.defK).toBeCloseTo(st.defK, 9);
  });

  it('卷一赶路图前 6 关是入门关：境界 1 未选内功的裸属性实战胜率 ≥ 90%，第 7 关起要境界 2', () => {
    const bare = playerBuild({ realm: 1, neigong: null, zhong: 0, tiersPassed: 0, injuries: undefined });
    for (let st = 1; st <= 6; st++) {
      const e = getStage(1, st);
      expect(e.recommendedRealm).toBe(1);
      let wins = 0;
      for (let i = 0; i < 400; i++) if (fight(bare, e, { mode: 'rng' }).win) wins++;
      expect(wins / 400).toBeGreaterThanOrEqual(0.9);
    }
    expect(getStage(1, 7).recommendedRealm).toBe(1);
  });

  it('传功缓坡（卷一赶路图第 7–11 关）：每关 +0.15；刚传功的百川诀 + 前辈所授任一门打第 7 关胜率 ≥ 90%，裸属性打教学战强度全败；其后蒿里寨从境界 2 段起点铺起', () => {
    for (let st = 7; st <= 11; st++) {
      expect(getStage(1, st).recommendedRealm).toBe(1);
      expect(getStage(1, st).x).toBeCloseTo(2 + (st - 7) * 0.15, 4);
    }
    expect(trackLength(1)).toBe(11);
    expect(getStage(2, 1).recommendedRealm).toBe(2);
    expect(getStage(2, 1).x).toBeCloseTo(TEACH_X, 4);
    for (const gift of GIFT_WUXUE_OPTIONS) {
      const taught = { realm: 1, neigong: 'jingleijue' as const, zhong: 0, tiersPassed: 0, injuries: undefined,
        ownedWuxue: [gift], equipped: [gift], formCasts: {}, pages: [] };
      const b = playerBuild(taught);
      const rng = lcg(7);   // 固定种子、2000 场：胜率贴着 90% 时，400 场的随机波动（约 ±1.5 pp）会让用例时过时不过
      let wins = 0;
      for (let i = 0; i < 2000; i++) {
        if (fight(b, getStage(1, 7), { mode: 'rng', rng, loadout: buildLoadout(taught), qiMax: qiMaxOf(taught) }).win) wins++;
      }
      expect(wins / 2000, gift).toBeGreaterThanOrEqual(0.9);
    }
    const bare = playerBuild({ realm: 1, neigong: null, zhong: 0, tiersPassed: 0, injuries: undefined });
    const teach = { ...getStage(1, 7), ...enemyStatsAt(TEACH_X) };
    for (let i = 0; i < 400; i++) expect(fight(bare, teach, { mode: 'rng' }).win).toBe(false);
  });

  it('关卡键可往返解析', () => {
    expect(parseStageKey(stageKey(33, 12))).toEqual({ map: 33, stage: 12 });
    expect(parseStageKey('m1t0s8')).toBeNull();
    expect(parseStageKey('m99s1')).toBeNull();
  });
});
