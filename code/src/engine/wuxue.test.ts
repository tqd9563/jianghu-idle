/**
 * 武学名录与新规则（wuxue-catalog/design.md、battle-loot/spec.md §3）：读表、特效四档、熟练新口径、触发求和、兵器搭配
 */
import { describe, expect, it } from 'vitest';
import { fight, makeBuild, type CombatSkill } from './combat';
import { FORM_NAMES } from './formNames';
import {
  BIG_OF, EFFECT_TAG, QUALITY_PARAMS, TRIGGER_CAP, WUXUE, WUXUE_IDS, effectText, effectValue, COST_GROWTH, MULT_GROWTH, formBaseCost, formCd, formCost, formMult,
  usableWith,
} from './wuxue';
import { legacyLength, legacyStage } from './legacyStage.testutil';

const seeded = (seed: number) => { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

describe('名录读表', () => {
  it('第一批 66 门 + 第三批门派前置 18 门：寻常 36 / 上乘 21 / 绝学 27，每门五项参数齐全、都有式名与特点标签', () => {
    expect(WUXUE_IDS).toHaveLength(84);
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
    expect(q).toEqual({ 寻常: 36, 上乘: 21, 绝学: 27 });
    expect(WUXUE.liuyunjian.name).toBe('流云剑法');
    // 三门改名 id 不变（living-jianghu/design.md §2.6 改名表）
    expect(WUXUE.xiangmochufa).toMatchObject({ name: '不周擎天棍', cat: '棍', signature: true, source: '擎天门' });
    expect(WUXUE.lianhualuodigun).toMatchObject({ name: '万岳镇川棍', source: '擎天门' });
    expect(WUXUE.tianhedaoxuandao).toMatchObject({ name: '烈日熔金刀', source: '鸣沙教' });
    // 海潮吞月掌提为绝学；三门镇宗上乘来路是本家
    expect(WUXUE.haichaotunyuezhang).toMatchObject({ quality: '绝学', source: '蜃海教' });
    expect(WUXUE.wuducuanxinzhang).toMatchObject({ quality: '上乘', source: '北邙门' });
    expect(WUXUE.mantianxingdoubiao.source).toBe('天工坊');
    expect(WUXUE.lenglinzhaoguzhi.source).toBe('碧磷洞');
  });

  it('批注：每门一联，寻常四字、上乘与绝学五字', () => {
    for (const id of WUXUE_IDS) {
      const d = WUXUE[id];
      const [a, b, ...rest] = d.epigraph.split('，');
      expect(rest, d.name).toHaveLength(0);
      expect([a.length, b.length], d.name).toEqual(d.quality === '寻常' ? [4, 4] : [5, 5]);
    }
    expect(WUXUE.luoxingjian.epigraph).toBe('星垂沧海夜，剑落暮潮寒');
  });

  it('特效四档 × 类型系数（裁决 46）：寻常 Ⅰ→Ⅱ、上乘 Ⅰ→Ⅲ、绝学 Ⅱ→Ⅳ，中间插值后乘系数；几率类封顶；独门为 0', () => {
    const qm = WUXUE.qimeigun;   // 寻常 · 折中 ×1 · 轻身 16/24/32/40：整数列四舍五入
    expect(qm.ek).toBe(1);
    expect([1, 2, 3].map((k) => effectValue(qm, k))).toEqual([16, 20, 24]);
    // 回元回的是真气点数：sim 尺度取整后 × QI_SCALE（裁决 48）
    expect([1, 2, 3].map((k) => effectValue({ quality: '寻常', effect: '回元' }, k))).toEqual([160, 200, 240]);
    const qp = WUXUE.qingpingjian;   // 寻常 · 折中且倍率低 ×1.25 · 运劲 0.12/0.16/0.20/0.25
    expect(qp.ek).toBe(1.25);
    expect([1, 2, 3].map((k) => effectValue(qp, k))).toEqual([0.15, 0.175, 0.2]);
    const fp = WUXUE.feipuduanyajian;   // 上乘 · 重击 ×0.5 · 运劲
    expect(fp.type).toBe('重击');
    expect([1, 3, 5].map((k) => effectValue(fp, k))).toEqual([0.06, 0.08, 0.1]);
    const kb = WUXUE.kaibeidao;   // 寻常 · 双强 ×1.5 · 凝眸
    expect(kb.type).toBe('双强');
    expect(effectValue(kb, 1)).toBeCloseTo(0.18, 9);
    expect(effectValue({ quality: '绝学', effect: '连击', ek: 1.5 }, 7)).toBe(1);   // 0.8 × 1.5 封顶 100%
    expect(effectValue(WUXUE.luoxingjian, 3)).toBe(0);
    expect(effectText(qp, 1)).toBe('3 回合攻击 +15%');
    expect(effectText(WUXUE.xiulizhen, 1)).toBe('叠毒 +1 层');
    expect(effectText(WUXUE.xiulizhen, 3)).toBe('叠毒 +1 层 · 25% 再 +1');
  });

  it('裁决 45 / 46：倍率每式约 ×1.12（按门浮动、每步至少 +4%、首末式不动）、基础耗气每式 ×1.15、熟练只减耗气、冷却不随熟练变', () => {
    expect(MULT_GROWTH).toBe(1.12);
    expect(COST_GROWTH).toBe(1.15);
    for (const id of WUXUE_IDS) {
      const w = WUXUE[id], n = QUALITY_PARAMS[w.quality].forms;
      expect(w.mults).toHaveLength(n);
      expect(w.mults[0]).toBeCloseTo(w.mult0, 9);
      expect(w.mults[n - 1]).toBeCloseTo(w.mult0 * 1.12 ** (n - 1), 1);
      for (let k = 1; k < n; k++) expect(w.mults[k] / w.mults[k - 1], `${id} 第${k + 1}式`).toBeGreaterThan(1.035);
    }
    const d = WUXUE.songtaojian;   // 寻常 · 名录 cost 19（游戏内 ×10）· cd 1
    expect(formMult(d, 1, false)).toBeCloseTo(d.mult0, 9);
    expect(formMult(d, 2, true)).toBeCloseTo(d.mults[1] * 1.1, 9);
    expect([1, 2, 3].map((k) => formBaseCost(d, k))).toEqual([190, 220, 250]);
    expect([0, 1, 2, 3].map((t) => formCost(d, 1, t))).toEqual([190, 170, 160, 140]);
    expect(formCost(d, 3, 3)).toBe(190);
    expect(formCd(d)).toBe(1);
    expect(formCd(WUXUE.kaibeidao)).toBe(3);
  });

  it('裁决 46：高品质的式倍率与耗气普遍高于低品质；三个品质都有重击 / 折中 / 双强', () => {
    const by = (q: string) => WUXUE_IDS.map((id) => WUXUE[id]).filter((d) => d.quality === q && !d.signature);
    for (const q of ['寻常', '上乘', '绝学']) expect(new Set(by(q).map((d) => d.type))).toEqual(new Set(['重击', '折中', '双强']));
    const share = (lo: string, hi: string, f: (d: typeof WUXUE[keyof typeof WUXUE]) => number) => {
      let n = 0, w = 0;
      for (const a of by(lo)) for (const b of by(hi)) { n++; if (f(b) > f(a)) w++; }
      return w / n;
    };
    for (const [lo, hi] of [['寻常', '上乘'], ['上乘', '绝学']]) {
      expect(share(lo, hi, (d) => d.mult0)).toBeGreaterThan(0.8);   // 寻常为前期平衡上调过倍率，与上乘的首式约 85% 分得开
      expect(share(lo, hi, (d) => d.cost)).toBeGreaterThan(0.9);
    }
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
  const enemy = legacyStage(3, 0, 20);
  const build = makeBuild('shaolin', 4, 40, 3);
  const sk = (id: string, effect: CombatSkill['forms'][number]['effect'], fx: number, p = 0.25, cost = 25, cd = 2): CombatSkill => ({
    id, name: id, p, forms: [{ key: `${id}:1`, name: '第一式', mult: 1.3, effect, fx, cost, cd }],
  });

  it('总触发率 = Σ 各门几率，封顶 75%；p 为 0 永不出招', () => {
    // 打不死也不还手的靶子：跑满 50 回合，出招率才有统计意义
    const dummy = { ...legacyStage(3, 0, legacyLength(3, 0)), hp: 1e12, atk: 0, tags: [] as never[] };
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

    // 真气数按 QI_SCALE 放大（普攻回 200）：上限 600、耗气 500、回元 400
    const hy = fight(build, enemy, { mode: 'rng', rng: seeded(5), loadout: [sk('h', '回元', 400, 0.25, 500, 1)], qiMax: 600 });
    const none = fight(build, enemy, { mode: 'rng', rng: seeded(5), loadout: [sk('h', null, 0, 0.25, 500, 1)], qiMax: 600 });
    expect(hy.stats.casts).toBeGreaterThan(none.stats.casts);
  });
});
