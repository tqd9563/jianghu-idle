import { describe, expect, it } from 'vitest';
import lib from './data/roster-names.json';
import { allStages, stageKey } from './enemies';
import { ALL_POSTS, holderAt, postOfStage, stageNamesAt, type RosterKill } from './roster';
import { ERA_START } from './reincarnation';

const SEEDS = [1, 7, 42, 2026, 99_999];
const fighters = ALL_POSTS.filter((p) => p.stageKey);

describe('江湖名册：岗位', () => {
  it('每个精英与 Boss 关都是一个岗位，每家外加一个不出战的首领', () => {
    const strong = allStages().filter((e) => e.kind !== 'normal');
    expect(fighters).toHaveLength(strong.length);
    for (const e of strong) expect(postOfStage(stageKey(e.map, e.stage))).not.toBeNull();
    expect(ALL_POSTS.filter((p) => p.slot === 'head')).toHaveLength(Object.keys(lib.factions).length);
  });

  it('门户末关的岗位是第 4 个（Boss），外围两个、门户副手一个', () => {
    for (const e of allStages().filter((x) => x.kind === 'boss')) {
      expect(postOfStage(stageKey(e.map, e.stage))!.slot).toBe(3);
    }
  });
});

describe('江湖名册：推演', () => {
  it('同一个种子什么时候算都一样（D3），换种子人名就换', () => {
    const a = stageNamesAt(7, [], ERA_START);
    expect(stageNamesAt(7, [], ERA_START)).toEqual(a);
    const b = stageNamesAt(8, [], ERA_START);
    const same = [...a].filter(([k, v]) => b.get(k) === v).length;
    expect(same).toBeLessThan(a.size * 0.1);
  });

  it('被击败的在任者到下一世必换；没被击败的同一人照坐（任期跨过下一世时）', () => {
    for (const seed of SEEDS) {
      const life2 = ERA_START + 60;
      for (const post of fighters) {
        const before = holderAt(seed, [], post, ERA_START);
        const kill: RosterKill = { post: post.id, year: ERA_START, end: life2 };
        const after = holderAt(seed, [kill], post, life2);
        expect(after.term).toBeGreaterThan(before.term);
        if (before.end > life2) {
          // 本该坐到下一世之后的人：被击败就在下一世出生年离任，不击败照坐
          expect(after.start).toBe(life2);
          expect(after.term).toBe(before.term + 1);
          expect(holderAt(seed, [], post, life2).term).toBe(before.term);
        }
      }
    }
  });

  it('没人打也会自然更替：三百年里每个岗位都换过人，任期合理', () => {
    for (const seed of SEEDS) {
      for (const post of ALL_POSTS) {
        const t = holderAt(seed, [], post, ERA_START + 300);
        expect(t.term).toBeGreaterThan(0);
        expect(t.end - t.start).toBeGreaterThanOrEqual(3);
        expect(t.end - t.start).toBeLessThanOrEqual(60);
      }
    }
  });

  it('击败只影响那一个岗位', () => {
    const post = fighters[10];
    const life2 = ERA_START + 50;
    const plain = stageNamesAt(42, [], life2);
    const hit = stageNamesAt(42, [{ post: post.id, year: ERA_START, end: life2 }], life2);
    const changed = [...plain].filter(([k, v]) => hit.get(k) !== v).map(([k]) => k);
    expect(changed.length).toBeLessThanOrEqual(1);
  });
});

describe('江湖名册：起名', () => {
  const black = new Set(lib.blacklist);
  it('不撞黑名单、同一家同一世里不重名；绰号带书名号括起', () => {
    for (const seed of SEEDS) {
      for (const year of [ERA_START, ERA_START + 400, ERA_START + 2000]) {
        const byFaction = new Map<string, string[]>();
        for (const post of ALL_POSTS) {
          const { person } = holderAt(seed, [], post, year);
          expect(black.has(person.name)).toBe(false);
          expect(black.has(person.realName)).toBe(false);
          const list = byFaction.get(post.faction) ?? [];
          list.push(person.realName);
          byFaction.set(post.faction, list);
        }
        for (const [, names] of byFaction) expect(new Set(names).size).toBe(names.length);
      }
    }
  });

  it('草莽每个岗位都有绰号；门派副手只有姓名，镇守与 Boss 带号；佛门道门是法名道号', () => {
    const names = stageNamesAt(2026, [], ERA_START);
    const nameOf = (faction: string, slot: number) => names.get(fighters.find((p) => p.faction === faction && p.slot === slot)!.stageKey!)!;
    expect(nameOf('蒿里寨', 0)).toMatch(/^「.+」/);
    expect(nameOf('苍崖派', 0)).not.toMatch(/「/);
    expect(nameOf('苍崖派', 3)).toMatch(/^「.+」/);
    expect(nameOf('乾元观', 3)).toMatch(/子$/);
    expect(nameOf('夜阑风雨楼', 3)).toBe('「立秋」');
    expect(nameOf('雁门秦氏', 3)).toMatch(/^秦/);
  });
});
