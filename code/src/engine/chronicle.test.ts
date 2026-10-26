import { describe, expect, it } from 'vitest';
import {
  causeLine, jianghuLines, lifeChronicle, lifeIdentity, lifeLines, makeHao, newLife, predecessorNote, wakeLines, JIANGHU_PER_LIFE,
  type LifeRec,
} from './chronicle';
import { postById, type RosterKill } from './roster';

const SEED = 20261026;

describe('每世姓名与籍贯', () => {
  it('同一种子同一世永远同一个人；第一世固定泰安男子', () => {
    expect(lifeIdentity(SEED, 3)).toEqual(lifeIdentity(SEED, 3));
    const first = lifeIdentity(SEED, 1);
    expect(first.origin).toBe('泰安');
    expect(first.female).toBe(false);
  });
  it('约四分之一的世是女子', () => {
    const n = 400;
    let f = 0;
    for (let run = 2; run < n + 2; run++) if (lifeIdentity(SEED, run).female) f++;
    expect(f / n).toBeGreaterThan(0.17);
    expect(f / n).toBeLessThan(0.33);
  });
});

describe('名号', () => {
  it('打穿门户是「意象 + 兵器」，以弱胜强带身份', () => {
    expect(makeHao(SEED, 1, '剑', false, 'gate')).toMatch(/^.{2}剑$/);
    expect(makeHao(SEED, 1, '剑', false, 'upset')).toMatch(/^.剑(浪子|狂客|行者)$/);
    expect(makeHao(SEED, 2, '拳', true, 'upset')).toMatch(/拳(娘子|夫人|观音)$/);
  });
});

describe('玩家的事', () => {
  const rec: LifeRec = {
    ...newLife(SEED, 1, 100), name: '周伯安', hao: '流云剑',
    events: [
      { k: 'beat', y: 101.3, post: '蒿里寨#0', map: 2, who: '「独眼」胡三' },
      { k: 'beat', y: 105.8, post: '蒿里寨#3', map: 3, who: '「铁头」陶老六', hao: '流云剑' },
      { k: 'sect', y: 110.2, sect: '华山' },
      { k: 'sect', y: 111.2, sect: '丐帮' },
      { k: 'realm', y: 130.5, realm: 5 },
      { k: 'realm', y: 120.5, realm: 3 },
    ],
    end: { year: 146, age: 64, cause: 'old', place: '泰安' },
  };
  it('套句式：入世、破寨、得名号、拜入、入帮、高境界、卒', () => {
    const t = lifeLines(rec).map((l) => l.text);
    expect(t).toEqual([
      '泰安少年周伯安，年十八，始入江湖。',
      '周伯安破蒿里寨野狐渡，头目「独眼」胡三败走。',
      '周伯安破蒿里寨乱石隘，大当家「铁头」陶老六伏诛。江湖始称「流云剑周伯安」。',
      '流云剑周伯安投华山门下。',
      '流云剑周伯安入丐帮。',
      '流云剑周伯安跻身一流高手之列，名动一方。',
      '流云剑周伯安卒于泰安，年六十四。',
    ]);
  });
  it('正派外围写「过……外客试炼」「让位闭关」', () => {
    const r = { ...rec, events: [{ k: 'beat' as const, y: 102, post: '苍崖派#1', map: 5, who: '严孤舟' }], end: undefined };
    expect(lifeLines(r)[1].text).toBe('周伯安过苍崖派外客试炼，苍崖剑坊管事严孤舟让位闭关。');
  });
});

describe('江湖的事', () => {
  it('只记到过的卷，一世至多 JIANGHU_PER_LIFE 条，按年先后', () => {
    const only1 = jianghuLines(SEED, [], 100, 400, [1]);
    expect(only1.every((l) => l.text.startsWith('蒿里寨'))).toBe(true);
    const all = jianghuLines(SEED, [], 100, 400, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(all.length).toBe(JIANGHU_PER_LIFE);
    expect(all.map((l) => l.y)).toEqual([...all.map((l) => l.y)].sort((a, b) => a - b));
  });
  it('被击败的人下一世开局换人，排在最前，带墨金标记', () => {
    const kills: RosterKill[] = [{ post: '蒿里寨#0', year: 100, end: 105, at: 101 }];
    const ls = jianghuLines(SEED, kills, 105, 190, [1]);
    expect(ls[0].y).toBe(105);
    expect(ls[0].mark).toBeTruthy();
    expect(ls[0].text).toMatch(/^蒿里寨头目.+败后为寨中所弃，.+夺了头目之位。$/);
  });
  it('佛门首领写「圆寂」', () => {
    const ls = jianghuLines(SEED, [], 100, 600, [3], 50).filter((l) => l.text.startsWith('千岩寺方丈'));
    expect(ls.length).toBeGreaterThan(0);
    expect(ls.every((l) => /圆寂|退隐/.test(l.text))).toBe(true);
  });
  it('编年把两类事按年混排，新的在前', () => {
    const rec = { ...newLife(SEED, 1, 100), vols: [1, 2] };
    const ls = lifeChronicle(SEED, [], rec, 200);
    expect(ls.at(-1)!.text).toMatch(/始入江湖/);
    expect(ls.map((l) => l.y)).toEqual([...ls.map((l) => l.y)].sort((a, b) => b - a));
  });
});

describe('醒来、进章因由、前世留痕', () => {
  const kills: RosterKill[] = [{ post: '蒿里寨#3', year: 100, end: 120, at: 110 }];
  const prev: LifeRec = { ...newLife(SEED, 1, 100), name: '陆青', hao: '快剑', vols: [1, 2], end: { year: 120, age: 38, cause: 'old', place: '洛阳' } };
  it('第一行写上一世的人，至多四行', () => {
    const ls = wakeLines(SEED, kills, prev, 120);
    expect(ls[0].text).toBe('「快剑」陆青卒于洛阳，其名已入中州说书人的旧话。');
    expect(ls.length).toBeLessThanOrEqual(4);
    expect(ls[1].mark).toBeTruthy();
    const plain = wakeLines(SEED, kills, { ...prev, hao: undefined }, 120);
    expect(plain[0].text).toBe('陆青卒于洛阳，江湖上已少有人提起。');
  });
  it('进章因由：赶路按图名、外围按势力，前世打穿过门户的追加一句；门户图没有', () => {
    expect(causeLine(SEED, [], 1, 100)).toBe('泰山脚下的古道荒废已久，夜里常有野狗毛贼出没。');
    expect(causeLine(SEED, [], 3, 100)).toBeNull();
    expect(causeLine(SEED, kills, 2, 150)).toMatch(/寨中至今忌惮当年那人。$/);
    const head = causeLine(SEED, [], 5, 100)!;
    expect(head).toMatch(/^苍崖派今岁开山门广纳外客，掌门.+亲定试剑之期。$/);
    expect(head).not.toContain('{head}');
  });
  it('守关人的前任被击败过：写明败于谁', () => {
    const post = postById('蒿里寨#3')!;
    expect(predecessorNote(SEED, kills, [prev], post, 120)).toMatch(/^前任.+，败于快剑陆青之手$/);
    expect(predecessorNote(SEED, [], [prev], post, 101)).toBeNull();
  });
});
