import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fight, makeBuild, type TurnEvent } from './combat';
import { getStage } from './enemies';
import { FORM_NAMES } from './formNames';
import { FORM_LINES, allTemplates, fill, foeKind, narrateTurn, type NarrCtx, type Seg } from './narration';
import { QUALITY_PARAMS, WUXUE, WUXUE_IDS, formKey } from './wuxue';

const text = (segs: Seg[]) => segs.map((s) => s.v).join('');
const DOC = resolve(process.cwd(), '../docs/rules/copy/battle-narration.md');

const ctx: NarrCtx = {
  enemy: { name: '山道野狼', kind: 'normal', tags: [] },
  route: 'huashan', neigongName: '惊雷诀', sqNeed: 5, poisonCap: 8,
};
const turn = (over: Partial<TurnEvent>): TurnEvent => ({
  rd: 3, side: 'player', kind: 'attack', text: '', dmg: 12,
  phpPct: 1, ehpPct: 1, pSq: 2, pShield: 0, ePoison: 3, pQi: 50, ...over,
});

describe('招式名与每式句子', () => {
  it('14 门武学每一式都有式名与专属句子，式数与品质一致', () => {
    expect(WUXUE_IDS).toHaveLength(14);
    for (const id of WUXUE_IDS) {
      const n = QUALITY_PARAMS[WUXUE[id].quality].forms;
      expect(FORM_NAMES[id], id).toHaveLength(n);
      expect(FORM_LINES[id], id).toHaveLength(n);
      for (let k = 1; k <= n; k++) {
        const segs = narrateTurn(turn({ kind: 'cast', form: formKey(id, k), dmg: 30 }), ctx);
        expect(segs.some((s) => s.k === 'sk' && s.v === FORM_NAMES[id][k - 1]), `${id}:${k}`).toBe(true);
        expect(text(segs)).toContain('30');
      }
    }
  });

  it('式名全局不重复', () => {
    const all = Object.values(FORM_NAMES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('事件映射', () => {
  const kinds: Partial<TurnEvent>[] = [
    { kind: 'attack' }, { kind: 'attack', side: 'enemy' }, { kind: 'attack', side: 'enemy', absorb: 5 },
    { kind: 'attack', side: 'enemy', absorb: 9, dmg: 0 },
    { kind: 'crit' }, { kind: 'miss' }, { kind: 'miss', side: 'enemy' },
    { kind: 'cast', form: 'liuyunjian:1', crit: true }, { kind: 'cast', form: 'kaishanzhang:1', missed: true, dmg: 0 },
    { kind: 'cast', form: 'qianjibiao:2', detonate: 40 },
    { kind: 'burst' }, { kind: 'poison_apply', rd: 0 }, { kind: 'poison_tick' }, { kind: 'poison_burst' },
    { kind: 'thorns_to_player', side: 'enemy' }, { kind: 'thorns_to_enemy' }, { kind: 'enemy_poison_tick', side: 'enemy' },
    { kind: 'purify', side: 'enemy' }, { kind: 'enrage', side: 'enemy' }, { kind: 'victory', side: 'end' },
    { kind: 'defeat', side: 'end' },
  ];
  const allKinds: TurnEvent['kind'][] = ['attack', 'cast', 'miss', 'crit', 'burst', 'poison_apply', 'poison_tick',
    'poison_burst', 'thorns_to_player', 'thorns_to_enemy', 'enemy_poison_tick', 'purify', 'enrage', 'defeat', 'victory'];

  it('每种事件都有句子，且不留未填占位', () => {
    expect(new Set(kinds.map((k) => k.kind))).toEqual(new Set(allKinds));
    for (const route of ['huashan', 'shaolin', 'tangmen', null] as const) {
      for (const name of ['村口恶犬', '拦路泼皮', '「快刀」刘七']) {
        for (const k of kinds) {
          const s = text(narrateTurn(turn(k), { ...ctx, route, enemy: { ...ctx.enemy, name } }));
          expect(s.length, `${route} ${name} ${k.kind}`).toBeGreaterThan(4);
          expect(s).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('暴击数字标成暴击色，普通伤害标成加粗', () => {
    expect(narrateTurn(turn({ kind: 'crit' }), ctx).some((s) => s.k === 'cr' && s.v === '12')).toBe(true);
    expect(narrateTurn(turn({ kind: 'attack' }), ctx).some((s) => s.k === 'dm' && s.v === '12')).toBe(true);
  });

  it('牵机镖引爆时带出毒伤数字', () => {
    expect(text(narrateTurn(turn({ kind: 'cast', form: 'qianjibiao:2', detonate: 40 }), ctx))).toContain('40');
  });
});

describe('确定性', () => {
  it('同一输入永远同一输出；不同回合可换变体', () => {
    const t = turn({ kind: 'attack', side: 'enemy' });
    expect(narrateTurn(t, ctx)).toEqual(narrateTurn(t, ctx));
    const variants = new Set([1, 2, 3].map((rd) => text(narrateTurn(turn({ kind: 'attack', side: 'enemy', rd }), ctx))));
    expect(variants.size).toBe(3);
  });

  it('整场战斗重放文字一致', () => {
    const seed = () => { let x = 42; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
    const e = getStage(1, 0, 5);
    const b = makeBuild('huashan', 2, 3, 0);
    const loadout = [{ id: 'liuyunjian', name: '流云剑', cost: 25, cd: 2, forms: [
      { key: 'liuyunjian:1', name: '第一式', mult: 1.3, effect: '必暴' as const },
      { key: 'liuyunjian:2', name: '第二式', mult: 1.34, effect: null },
    ] }];
    const run = () => fight(b, e, { mode: 'rng', rng: seed(), loadout, qiMax: 100 }).turns
      .map((t) => text(narrateTurn(t, { ...ctx, enemy: e })));
    const a = run();
    expect(run()).toEqual(a);
    expect(a.length).toBeGreaterThan(2);
  });
});

describe('敌人类型', () => {
  it('按名字与精英 / Boss 推断', () => {
    expect(foeKind({ name: '村口恶犬', kind: 'normal' })).toBe('beast');
    expect(foeKind({ name: '拦路泼皮', kind: 'normal' })).toBe('bandit');
    expect(foeKind({ name: '「钻山豹」侯四', kind: 'normal' })).toBe('master');
    expect(foeKind({ name: '古道剑客', kind: 'normal' })).toBe('master');
    expect(foeKind({ name: '黑风寨主', kind: 'boss' })).toBe('master');
  });
});

describe('冻结文档', () => {
  const doc = readFileSync(DOC, 'utf8');
  it('每条模板逐字出现在 battle-narration.md', () => {
    const missing = allTemplates().filter((t) => !doc.includes(t));
    expect(missing).toEqual([]);
  });
  it('每个式名出现在文档', () => {
    const missing = Object.values(FORM_NAMES).flat().filter((n) => !doc.includes(n));
    expect(missing).toEqual([]);
  });
  it('模板只用合法占位、不含禁用词', () => {
    for (const t of allTemplates()) {
      expect(text(fill(t, { foe: '甲', form: '乙', gong: '丙', dmg: 1, n: 1, cap: 1, shield: 1, det: 1 })), t).not.toMatch(/[{}]/);
      expect(t).not.toMatch(/归隐|前沿/);
    }
  });
});
