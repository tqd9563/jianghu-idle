import { describe, expect, it } from 'vitest';
import {
  ACHV, ACHV_MAP, achvCount, achvEffText, achvTier, achvVal, bumpAchv, catDmgBonus, equippedCats, winCounts,
} from './achievements';
import { allStages, stageKey, trackLength, VOLUMES } from './enemies';

/** 第 v 卷第 c 章的章末 Boss 名号键 */
const boss = (v: number, c = 1) => { const g = VOLUMES[v - 1].maps[2 * c]; return `stage:${stageKey(g, trackLength(g))}`; };
const elites = allStages().filter((e) => e.kind === 'elite').map((e) => `stage:${stageKey(e.map, e.stage)}`);

describe('侠名录（prestige-shop/design.md §2c）', () => {
  it('二十二条线，三层门槛递增、三层值递增', () => {
    expect(ACHV).toHaveLength(22);
    for (const a of ACHV) {
      expect(a.th[0]).toBeLessThan(a.th[1]);
      expect(a.th[1]).toBeLessThan(a.th[2]);
      expect(a.val[0]).toBeLessThan(a.val[1]);
      expect(a.val[1]).toBeLessThan(a.val[2]);
    }
  });

  it('推导计量：头目 / 精英 / 经脉读 fameClaimed，转世读 run，阅历读收得武学门数', () => {
    const s = {
      fameClaimed: [boss(1), boss(2), elites[0], elites[1], 'meridian:shoutaiyin'],
      run: 7, ownedWuxue: ['liuyunjian', 'qingpingjian'] as never[],
    };
    expect(achvCount(s, 'boss')).toBe(2);
    expect(achvCount(s, 'elite')).toBe(2);
    expect(achvCount(s, 'jingmai')).toBe(1);
    expect(achvCount(s, 'zhuanshi')).toBe(6);
    expect(achvCount(s, 'yueli')).toBe(2);
    expect(achvTier(s, 'boss')).toBe(0);   // 头目第一层要 8 个（卷章图关后重标）
    expect(achvTier({ ...s, fameClaimed: [1, 2, 3, 4, 5, 6, 7, 8].map((v) => boss(v)) }, 'boss')).toBe(1);
    expect(achvTier(s, 'zhuanshi')).toBe(1);
  });

  it('层与值：未点亮为 0；到门槛即升层', () => {
    const th = ACHV_MAP.jian.th;
    expect(achvVal({ achv: { jian: th[0] - 1 } }, 'jian')).toBe(0);
    expect(achvVal({ achv: { jian: th[0] } }, 'jian')).toBe(0.10);
    expect(achvVal({ achv: { jian: th[2] } }, 'jian')).toBe(0.30);
    expect(catDmgBonus({ achv: { jian: th[1] } }, '剑')).toBe(0.20);
    expect(catDmgBonus({ achv: { jian: th[1] } }, '刀')).toBe(0);
  });

  it('退出购买的旧传承至少给对应成就一层：武道笔记 / 师门指引 → 招式，破关心得 → 头目', () => {
    expect(achvTier({ retiredNodes: ['poguan_xinde'] }, 'boss')).toBe(1);
    expect(achvTier({ retiredNodes: ['shimen_zhiyin'] }, 'zhaoshi')).toBe(1);
    expect(achvTier({ retiredNodes: ['poguan_xinde'] }, 'zhaoshi')).toBe(0);
  });

  it('累加计数返回跨过的层；胜场按装配武学的类目去重各记一场', () => {
    const th = ACHV_MAP.zhanbai.th[0];
    const r = bumpAchv({ achv: { zhanbai: th - 1 } }, { zhanbai: 1 });
    expect(r.achv.zhanbai).toBe(th);
    expect(r.ups).toEqual([{ id: 'zhanbai', tier: 1 }]);
    expect(bumpAchv({ achv: {} }, { zhanbai: 1 }).ups).toEqual([]);
    expect(equippedCats(['liuyunjian', 'qingpingjian'])).toEqual(['剑']);
    expect(winCounts(['liuyunjian', 'qingpingjian'], 3)).toEqual({ jian: 3 });
  });

  it('效果文案：比例写百分数，件 / 次写整数', () => {
    expect(achvEffText(ACHV_MAP.dao, 2)).toBe('刀法伤害 +20%');
    expect(achvEffText(ACHV_MAP.heishi, 1)).toBe('蒙面货每世 +2 件');
    expect(achvEffText(ACHV_MAP.chongxue, 3)).toBe('冲穴耗内力 −6%');
  });
});
