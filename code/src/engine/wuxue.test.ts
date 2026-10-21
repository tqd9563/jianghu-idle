/**
 * 武学名录与新规则（wuxue-catalog/design.md、battle-loot/spec.md §3）：读表、特效四档、熟练新口径、触发求和、兵器搭配
 */
import { describe, expect, it } from 'vitest';
import { fight, makeBuild, type CombatSkill } from './combat';
import { getStage, trackLength } from './enemies';
import { FORM_NAMES } from './formNames';
import {
  BIG_OF, EFFECT_TAG, QUALITY_PARAMS, TRIGGER_CAP, WUXUE, WUXUE_IDS, effectText, effectValue, formBaseCost, formCd, formCost, formMult,
  usableWith,
} from './wuxue';

const seeded = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

describe('名录读表', () => {
  it('第一批 66 门：寻常 36 / 上乘 18 / 绝学 12，每门五项参数齐全、都有式名与特点标签', () => {
    expect(WUXUE_IDS).toHaveLength(66);
    const q = { 寻常: 0, 上乘: 0, 绝学: 0 };
    for (const id of WUXUE_IDS) {
      const d = WUXUE[id];
      q[d.quality]++;
      expect(d.mult0).toBeGreaterThanOrEqual(1);
      expect(d.cost).toBeGreaterThan(0);
      expect(d.p).toBeGreaterThan(0);
      expect(d.cd).toBeGreaterThanOrEqual(1);
      expect(EFFECT_TAG[d.effect]).toBeDefined();
      expect(BIG_OF[d.cat]).toBeDefined();
      expect(FORM_NAMES[id]).toHaveLength(QUALITY_PARAMS[d.quality].forms);
    }
    expect(q).toEqual({ 寻常: 36, 上乘: 18, 绝学: 12 });
    expect(WUXUE.liuyunjian.name).toBe('流云剑法');
    expect(WUXUE.xiangmochufa).toMatchObject({ name: '金刚降魔杵', cat: '棍', signature: true, source: '少林' });
    expect(WUXUE.tianhedaoxuandao.source).toBe('崆峒');
  });

  it('特效四档：寻常 Ⅰ→Ⅱ、上乘 Ⅰ→Ⅲ、绝学 Ⅱ→Ⅳ，中间插值；独门为 0', () => {
    const qp = WUXUE.qingpingjian;   // 寻常 · 运劲 0.12/0.16/0.20/0.25
    expect([1, 2, 3].map((k) => effectValue(qp, k))).toEqual([0.12, 0.14, 0.16]);
    const fp = WUXUE.feipuduanyajian;   // 上乘 · 运劲
    expect([1, 3, 5].map((k) => effectValue(fp, k))).toEqual([0.12, 0.16, 0.2]);
    const th = WUXUE.tianhedaoxuandao;  // 绝学 · 透劲 0.25/0.35/0.45/0.55
    expect([1, 7].map((k) => effectValue(th, k))).toEqual([0.35, 0.55]);
    const qm = WUXUE.qimeigun;   // 寻常 · 轻身 16/24/32/40：整数列四舍五入
    expect([1, 2, 3].map((k) => effectValue(qm, k))).toEqual([16, 20, 24]);
    expect(effectValue(WUXUE.luoxingjian, 3)).toBe(0);
    expect(effectText(qp, 1)).toBe('3 回合攻击 +12%');
    expect(effectText(WUXUE.xiulizhen, 1)).toBe('叠毒 +1 层');
    expect(effectText(WUXUE.xiulizhen, 3)).toBe('叠毒 +1 层 · 25% 再 +1');
  });

  it('裁决 45：各式耗气按倍比递增、熟练只减耗气、冷却不随熟练变', () => {
    const d = WUXUE.songtaojian;   // 寻常 cost 15 cd 1 · 倍比 1.3
    expect(formMult(d, 1, false)).toBeCloseTo(1.79, 9);
    expect(formMult(d, 3, true)).toBeCloseTo((1.79 + 0.16) * 1.1, 9);   // 倍率台阶 0.08 / 式（裁决 45）
    expect([1, 2, 3].map((k) => formBaseCost(d, k))).toEqual([15, 20, 25]);
    expect([0, 1, 2, 3].map((t) => formCost(d, 1, t))).toEqual([15, 14, 13, 11]);
    expect(formCost(d, 3, 3)).toBe(19);
    expect(formCd(d)).toBe(1);
    expect(formCd(WUXUE.kaibeidao)).toBe(3);
  });
  it('兵器搭配：器械要同类兵器，暗器要暗器，肉身不挑', () => {
    expect(usableWith(WUXUE.liuyunjian, { weapon: '剑', anqi: false })).toBe(true);
    expect(usableWith(WUXUE.liuyunjian, { weapon: '刀', anqi: true })).toBe(false);
    expect(usableWith(WUXUE.xiulizhen, { weapon: null, anqi: true })).toBe(true);
    expect(usableWith(WUXUE.xiulizhen, { weapon: '剑', anqi: false })).toBe(false);
    expect(usableWith(WUXUE.kaishanzhang, { weapon: null, anqi: false })).toBe(true);
  });
});

describe('战斗：触发求和与新特效', () => {
  const enemy = getStage(3, 0, 20);
  const build = makeBuild('shaolin', 4, 40, 3);
  const sk = (id: string, effect: CombatSkill['forms'][number]['effect'], fx: number, p = 0.25, cost = 25, cd = 2): CombatSkill => ({
    id, name: id, p, forms: [{ key: `${id}:1`, name: '第一式', mult: 1.3, effect, fx, cost, cd }],
  });

  it('总触发率 = Σ 各门几率，封顶 75%；p 为 0 永不出招', () => {
    // 打不死也不还手的靶子：跑满 50 回合，出招率才有统计意义
    const dummy = { ...getStage(3, 0, trackLength(3, 0)), hp: 1e12, atk: 0, tags: [] as never[] };
    const castRate = (loadout: CombatSkill[], seed: number) => {
      const r = fight(build, dummy, { mode: 'rng', rng: seeded(seed), loadout, qiMax: 10000 });
      expect(r.rounds).toBe(50);
      return r.stats.casts / r.rounds;
    };
    expect(castRate([sk('a', null, 0, 0)], 1)).toBe(0);
    // 五门高触发、冷却 1：总率封顶 0.75（多种子平均）
    const five = ['a', 'b', 'c', 'd', 'e'].map((n) => sk(n, null, 0, 0.33, 1, 1));
    const avg = [1, 2, 3, 4, 5, 6].reduce((a, s) => a + castRate(five, s), 0) / 6;
    expect(avg).toBeGreaterThan(0.6);
    expect(avg).toBeLessThanOrEqual(TRIGGER_CAP + 0.1);
  });

  it('封穴让敌人跳过一次行动；运劲 / 破绽持续三回合；连击追加一次普攻；回元回真气', () => {
    const seal = fight(build, enemy, { mode: 'rng', rng: seeded(2), loadout: [sk('s', '封穴', 1)], qiMax: 500 });
    expect(seal.turns.some((t) => t.kind === 'sealed')).toBe(true);
    const sealedRounds = new Set(seal.turns.filter((t) => t.kind === 'sealed').map((t) => t.rd));
    for (const t of seal.turns) if (t.side === 'enemy' && t.kind === 'attack') expect(sealedRounds.has(t.rd)).toBe(false);

    const combo = fight(build, enemy, { mode: 'rng', rng: seeded(3), loadout: [sk('c', '连击', 1)], qiMax: 500 });
    const casts = combo.turns.filter((t) => t.kind === 'cast' && !t.missed).length;
    expect(combo.turns.filter((t) => t.kind === 'followup')).toHaveLength(casts);

    const yj = fight(build, enemy, { mode: 'rng', rng: seeded(4), loadout: [sk('y', '运劲', 0.25)], qiMax: 500 });
    expect(yj.turns.filter((t) => t.kind === 'cast' && t.fx === '运劲').length).toBeGreaterThan(0);
    const plain = fight(build, enemy, { mode: 'rng', rng: seeded(4), loadout: [sk('y', null, 0)], qiMax: 500 });
    expect(yj.stats.dmgDealt).toBeGreaterThan(plain.stats.dmgDealt);

    const hy = fight(build, enemy, { mode: 'rng', rng: seeded(5), loadout: [sk('h', '回元', 40, 0.25, 50, 1)], qiMax: 60 });
    const none = fight(build, enemy, { mode: 'rng', rng: seeded(5), loadout: [sk('h', null, 0, 0.25, 50, 1)], qiMax: 60 });
    expect(hy.stats.casts).toBeGreaterThan(none.stats.casts);
  });
});
