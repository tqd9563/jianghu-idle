/**
 * 受伤系统测试 —— 对照 docs/systems/injury/spec.md 的数值表与 sim 标定值。
 * spec 改动时本文件必须同步，否则规格与实现漂移。
 */
import { describe, it, expect } from 'vitest';
import {
  freshInjuries, inflict, heal, healTimeNeededMin, idleOutputMultiplier,
  applyInjuriesToBuild, injuryFromBattle, injuryKindFor, worstInjury, hurtCount,
  healRealmFactor, lifespanLossOf, isHurt,
  IDLE_FLOOR, LIFESPAN_LOSS_HEAVY, PYRRHIC_HP_PCT,
  type Injuries,
} from './injury';
import { makeBuild } from './combat';
import type { EnemyDef } from './enemies';

const withSev = (partial: Partial<Record<'wai' | 'nei' | 'du', number>>): Injuries => {
  const inj = freshInjuries();
  for (const [k, v] of Object.entries(partial)) {
    inj[k as 'wai'] = { severity: v as 0 | 1 | 2 | 3, healAccMin: 0 };
  }
  return inj;
};

const enemy = (over: Partial<EnemyDef>): EnemyDef => ({
  map: 1, stage: 1, name: 'x', hp: 100, atk: 10, def: 5, hit: 100, dodge: 10,
  tags: [], kind: 'normal', recommendedRealm: 1,
  reward: { neili: 0, silver: 0, xp: 0 }, ...over,
});

describe('挂机产出压制（spec §3 导出表，逐值对照）', () => {
  // spec §3 表的精确值 = 1 − 压制值 × idleWeight（表中百分数为其显示舍入）
  const cases: Array<['wai' | 'nei' | 'du', number, number]> = [
    ['nei', 1, 0.925], ['nei', 2, 0.8125], ['nei', 3, 0.6625],
    ['du', 1, 0.955], ['du', 2, 0.8875], ['du', 3, 0.7975],
    ['wai', 1, 0.975], ['wai', 2, 0.9375], ['wai', 3, 0.8875],
  ];
  it.each(cases)('%s 严重度 %i → 产出 %f', (id, sev, expected) => {
    expect(idleOutputMultiplier(withSev({ [id]: sev }))).toBeCloseTo(expected, 6);
  });

  it('无伤时不打折', () => {
    expect(idleOutputMultiplier(freshInjuries())).toBe(1);
  });

  it('多伤乘法叠加（spec §3 公式）', () => {
    const m = idleOutputMultiplier(withSev({ nei: 2, wai: 1, du: 1 }));
    expect(m).toBeCloseTo(0.8125 * 0.975 * 0.955, 6);
  });

  it('三重伤并存 ≈ 46.9%，地板未触发（spec §3 边界参考）', () => {
    expect(idleOutputMultiplier(withSev({ wai: 3, nei: 3, du: 3 })))
      .toBeCloseTo(0.6625 * 0.7975 * 0.8875, 6);
  });

  it('产出乘数永不低于地板', () => {
    expect(idleOutputMultiplier(withSev({ wai: 3, nei: 3, du: 3 }))).toBeGreaterThanOrEqual(IDLE_FLOOR);
  });
});

describe('战力压制叠加到 Build（spec §1/§2）', () => {
  const base = makeBuild('huashan', 4, 7, 2);

  it('无伤时返回原 Build（同一引用）', () => {
    expect(applyInjuriesToBuild(base, freshInjuries())).toBe(base);
  });

  it('外伤压防御与血上限，血按 ×0.66', () => {
    const b = applyInjuriesToBuild(base, withSev({ wai: 2 }));
    expect(b.def).toBeCloseTo(base.def * 0.75, 6);
    expect(b.hp).toBeCloseTo(base.hp * (1 - 0.25 * 0.66), 6);
    expect(b.atk).toBe(base.atk);
  });

  it('内伤只压攻击', () => {
    const b = applyInjuriesToBuild(base, withSev({ nei: 3 }));
    expect(b.atk).toBeCloseTo(base.atk * 0.55, 6);
    expect(b.def).toBe(base.def);
  });

  it('毒伤压命中与闪避', () => {
    const b = applyInjuriesToBuild(base, withSev({ du: 1 }));
    expect(b.hit).toBeCloseTo(base.hit * 0.9, 6);
    expect(b.dodge).toBeCloseTo(base.dodge * 0.9, 6);
  });

  it('不改动路线专属字段（不越界污染 fight 口径）', () => {
    const b = applyInjuriesToBuild(base, withSev({ wai: 3, nei: 3, du: 3 }));
    expect(b.sqNeed).toBe(base.sqNeed);
    expect(b.poison).toEqual(base.poison);
    expect(b.route).toBe(base.route);
  });
});

describe('严重度升降（spec §4 单轴）', () => {
  it('逐档升：轻→中→重', () => {
    let inj = freshInjuries();
    inj = inflict(inj, 'wai').injuries;
    expect(inj.wai.severity).toBe(1);
    inj = inflict(inj, 'wai').injuries;
    expect(inj.wai.severity).toBe(2);
    const r = inflict(inj, 'wai');
    expect(r.injuries.wai.severity).toBe(3);
    expect(r.becameHeavy).toBe(true);
    expect(r.lifespanLost).toBe(LIFESPAN_LOSS_HEAVY);
  });

  it('重度再受创 → 越致死线', () => {
    const r = inflict(withSev({ wai: 3 }), 'wai');
    expect(r.lethal).toBe(true);
  });

  it('只有升入重度才折寿，轻中不折（spec §6）', () => {
    expect(inflict(freshInjuries(), 'nei').lifespanLost).toBe(0);
    expect(inflict(withSev({ nei: 1 }), 'nei').lifespanLost).toBe(0);
    expect(inflict(withSev({ nei: 2 }), 'nei').lifespanLost).toBe(LIFESPAN_LOSS_HEAVY);
  });

  it('lifespanLossOf 与 spec §6 表一致', () => {
    expect(lifespanLossOf(0)).toBe(0);
    expect(lifespanLossOf(1)).toBe(0);
    expect(lifespanLossOf(2)).toBe(0);
    expect(lifespanLossOf(3)).toBe(LIFESPAN_LOSS_HEAVY);
  });

  it('各伤型独立升降，互不影响', () => {
    const inj = inflict(withSev({ wai: 2 }), 'nei').injuries;
    expect(inj.wai.severity).toBe(2);
    expect(inj.nei.severity).toBe(1);
    expect(inj.du.severity).toBe(0);
  });
});

describe('自愈（spec §5）', () => {
  it('境界系数：境界 1 为 1.0，随境界递减，下限 0.5', () => {
    expect(healRealmFactor(1)).toBe(1);
    expect(healRealmFactor(5)).toBeCloseTo(0.8, 6);
    expect(healRealmFactor(30)).toBe(0.5);
  });

  it('轻伤攒够 3 分钟痊愈（境界 1）', () => {
    expect(heal(withSev({ wai: 1 }), 2.9, 1).wai.severity).toBe(1);
    expect(heal(withSev({ wai: 1 }), 3, 1).wai.severity).toBe(0);
  });

  it('自愈逐档回落，不一步到底', () => {
    const inj = heal(withSev({ nei: 3 }), 20, 1);
    expect(inj.nei.severity).toBe(2);
  });

  it('重度养到痊愈需 20+8+3 分钟', () => {
    expect(healTimeNeededMin(withSev({ nei: 3 }), 1)).toBeCloseTo(31, 6);
    expect(heal(withSev({ nei: 3 }), 31, 1).nei.severity).toBe(0);
  });

  it('高境界自愈更快', () => {
    expect(healTimeNeededMin(withSev({ wai: 1 }), 5)).toBeLessThan(
      healTimeNeededMin(withSev({ wai: 1 }), 1));
  });

  it('零时长与无伤是安全的 no-op', () => {
    const inj = withSev({ wai: 1 });
    expect(heal(inj, 0, 1)).toBe(inj);
    expect(isHurt(heal(freshInjuries(), 100, 1))).toBe(false);
  });
});

describe('获取判定（spec §4）', () => {
  const boss = enemy({ kind: 'boss' });
  const elite = enemy({ kind: 'elite', tags: ['高闪'] });
  const poisonElite = enemy({ kind: 'elite', tags: ['毒'] });
  const normal = enemy({ kind: 'normal' });

  it('普通关无论胜败都不产伤', () => {
    expect(injuryFromBattle(normal, false, 0)).toBeNull();
    expect(injuryFromBattle(normal, true, 0.01)).toBeNull();
  });

  it('硬仗失败必受伤', () => {
    expect(injuryFromBattle(boss, false, 0)).toBe('wai');
    expect(injuryFromBattle(elite, false, 0)).toBe('nei');
  });

  it('硬仗惨胜（余血 < 25%）受伤，高血通关不受伤', () => {
    expect(injuryFromBattle(boss, true, 0.24)).toBe('wai');
    expect(injuryFromBattle(boss, true, PYRRHIC_HP_PCT)).toBeNull();
    expect(injuryFromBattle(boss, true, 0.9)).toBeNull();
  });

  it('伤型归属：毒标签优先于 Boss/精英', () => {
    expect(injuryKindFor(poisonElite)).toBe('du');
    expect(injuryKindFor(enemy({ kind: 'boss', tags: ['毒'] }))).toBe('du');
    expect(injuryKindFor(boss)).toBe('wai');
    expect(injuryKindFor(elite)).toBe('nei');
  });
});

describe('UI 辅助（顶栏指示器）', () => {
  it('无伤时无最重项', () => {
    expect(worstInjury(freshInjuries())).toBeNull();
    expect(hurtCount(freshInjuries())).toBe(0);
  });

  it('取严重度最高的一处，并数出总处数', () => {
    const inj = withSev({ wai: 1, nei: 2, du: 1 });
    expect(worstInjury(inj)).toEqual({ id: 'nei', severity: 2 });
    expect(hurtCount(inj)).toBe(3);
  });
});
