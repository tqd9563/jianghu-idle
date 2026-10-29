/**
 * 门派数据与数值（sect-overhaul/design.md §3–§5，spec.md §2–§4）：二十一家表的自洽、地位门槛、差事收益、货架价格。
 */
import { describe, expect, it } from 'vitest';
import { AFFIX_POOL } from './gear';
import { NEIGONG } from './neigong';
import { WUXUE } from './wuxue';
import {
  RANK_THRESHOLDS, SECTS, SECT_IDS, SECT_VOLS, joinWord, rankOf, rumorOf, sectShelf, sectTaskGain, sectsInVol,
} from './sect';

describe('二十一家总表', () => {
  it('每卷的门派与舆图一致；大派三档内功、中小派两档；兼修四家；装备词条在该部位的词条池里', () => {
    expect(SECT_IDS).toHaveLength(21);
    expect(SECT_VOLS.flatMap(sectsInVol)).toEqual(SECT_IDS);
    expect(sectsInVol(2)).toEqual(['cangya', 'qianfan', 'qianshe']);
    const extra: string[] = [];
    for (const id of SECT_IDS) {
      const d = SECTS[id];
      expect(d.ranks, id).toHaveLength(6);
      expect(d.errands.map((e) => e.name.length), id).toEqual([4, 4, 4, 4, 4, 4]);
      expect(!!d.neigong.peak, id).toBe(d.size === '大');
      expect(NEIGONG[d.neigong.entry], id).toMatchObject({ quality: '寻常', route: d.route, sect: id });
      expect(NEIGONG[d.neigong.adv!], id).toMatchObject({ quality: '上乘', route: d.route, sect: id });
      if (d.neigong.peak) expect(NEIGONG[d.neigong.peak], id).toMatchObject({ quality: '绝学', route: d.route, sect: id });
      if (d.neigong.extra) {
        extra.push(id);
        expect(NEIGONG[d.neigong.extra.id].route, id).not.toBe(d.route);
        expect(NEIGONG[d.neigong.extra.id].quality, id).toBe(d.neigong.extra.rank === 1 ? '寻常' : '上乘');
      }
      for (const w of d.juexue) expect(WUXUE[w].source, w).toBe(d.name);
      for (const g of d.gear) {
        expect(AFFIX_POOL[g.slot], g.id).toContain(g.affix);
        expect(g.name.length, g.id).toBeGreaterThanOrEqual(3);
      }
    }
    expect(extra).toEqual(['cangya', 'qianyan', 'qianyuan', 'zhangyue']);
    expect(joinWord(SECTS.qianfan.kind)).toBe('入伙');
    expect(joinWord(SECTS.hengjiang.kind)).toBe('入伙');
    expect(joinWord(SECTS.cangya.kind)).toBe('拜入');
  });

  it('传闻：卷二说广开山门，其它卷说该地区与门派名', () => {
    expect(rumorOf(2)).toBe('苍崖派、千帆帮、千蛇窟广开山门，修为至小有所成者，可往拜山。');
    expect(rumorOf(3)).toContain('江南');
    expect(rumorOf(3)).toContain('千岩寺、花影坊');
  });
});

describe('地位与差事（spec §2 §3）', () => {
  it('门槛 0 / 250 / 650 / 1300 / 2300 / 3900；地位按累计贡献', () => {
    expect(RANK_THRESHOLDS).toEqual([0, 250, 650, 1300, 2300, 3900]);
    expect([0, 249, 250, 649, 650, 3899, 3900, 99999].map(rankOf)).toEqual([1, 1, 2, 2, 3, 5, 6, 6]);
  });

  it('六档差事：2 小时 40 / 64 / 100 / 160 / 260 / 400，8 小时七五折', () => {
    expect(([1, 2, 3, 4, 5, 6] as const).map((t) => sectTaskGain(t, 2))).toEqual([40, 64, 100, 160, 260, 400]);
    expect(([1, 2, 3, 4, 5, 6] as const).map((t) => sectTaskGain(t, 8))).toEqual([120, 192, 300, 480, 780, 1200]);
  });
});

describe('货架（spec §4）', () => {
  it('苍崖派：按地位陈列，价格照表；寻常 / 上乘取主修类目下挂机来路的前两门', () => {
    const shelf = sectShelf('cangya');
    const by = (rank: number) => shelf.filter((it) => it.rank === rank).map((it) => [it.kind, it.id, it.price]);
    expect(by(1)).toEqual([
      ['wuxue', 'sect:qingpingjian:book', 100], ['wuxue', 'sect:songtaojian:book', 100], ['neigong', 'sect:jingleijue', 200],
    ]);
    expect(by(2)).toEqual([
      ['pages', 'sect:feipuduanyajian:1', 160], ['pages', 'sect:feipuduanyajian:2', 80], ['pages', 'sect:feipuduanyajian:3', 80],
      ['pages', 'sect:feipuduanyajian:4', 80], ['pages', 'sect:feipuduanyajian:5', 80], ['gear', 'sect:gear:cangya-low', 480],
    ]);
    expect(by(3)).toEqual([['neigong', 'sect:leimingjianjing', 1000], ['neigong', 'sect:feiquanjue', 1000]]);
    expect(by(4).map((r) => r[2])).toEqual([800, 400, 400, 400, 600, 600, 600, 800, 400, 400, 400, 600, 600, 600]);
    expect(by(5)).toEqual([['neigong', 'sect:yuntaixinfa', 1950], ['gear', 'sect:gear:cangya-high', 1300], ['juance', 'sect:juance:yuntaixinfa', 1300]]);
    expect(shelf.map((it) => it.id)).toEqual([...new Set(shelf.map((it) => it.id))]);
  });

  it('千岩寺的兼修入门与本门入门同在一级', () => {
    expect(sectShelf('qianyan').filter((it) => it.rank === 1 && it.kind === 'neigong').map((it) => it.neigong)).toEqual(['zhenyuegong', 'wuzhuxinfa']);
  });
});
