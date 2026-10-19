/**
 * 存档迁移测试 —— v2→v3 窍穴 id 由位置编码改为穴位拼音。
 * 迁移链路此前是死代码（gameStore 直接调 loadGame，绕过 migrate），本测试锁死它被真正调用。
 */
import { describe, expect, it } from 'vitest';
import { migrate, SAVE_VERSION } from './storage';
import { REALM_ACUPOINTS } from '../engine/acupoints';

describe('存档迁移 v2 → v3：窍穴 id 重写', () => {
  it('acupointProgress 的键被换成新 id，进度值原样保留', () => {
    const out = migrate(
      { acupointProgress: { 'r2-a11': { failCount: 2, opened: true } } },
      2, SAVE_VERSION
    );
    expect(out.acupointProgress).toEqual({ quchi: { failCount: 2, opened: true } });
  });

  it('acupointLog 的元素被换成新 id 并去重', () => {
    const out = migrate(
      { acupointLog: ['r5-a31', 'r5-a32', 'r5-a31'] },
      2, SAVE_VERSION
    );
    expect(out.acupointLog).toEqual(['wushu', 'weidao']);
  });

  it('映射不到的键原样保留——宁可留孤儿键也不静默吞掉玩家进度', () => {
    const out = migrate(
      { acupointProgress: { 'unknown-id': { failCount: 0, opened: true } } },
      2, SAVE_VERSION
    );
    expect(out.acupointProgress).toHaveProperty('unknown-id');
  });

  it('已是 v3 的存档不再二次迁移', () => {
    const v3 = { acupointProgress: { quchi: { failCount: 0, opened: true } } };
    expect(migrate(v3, 3, SAVE_VERSION)).toEqual(v3);
  });

  it('迁移后的每个 id 都能在当前窍穴表里找到（映射表无笔误）', () => {
    const allNewIds = new Set(
      [2, 3, 4, 5].flatMap(r => REALM_ACUPOINTS[r].acupoints.map(a => a.id))
    );
    const migrated = migrate(
      { acupointLog: [
        'r2-a11','r2-a12','r2-a21','r2-a22',
        'r3-a11','r3-a12','r3-a13','r3-a21','r3-a22',
        'r4-a11','r4-a12','r4-a13','r4-a21','r4-a22','r4-a23',
        'r5-a11','r5-a12','r5-a13','r5-a21','r5-a22','r5-a23','r5-a31','r5-a32',
      ] }, 2, SAVE_VERSION
    );
    expect(migrated.acupointLog).toHaveLength(23);
    for (const id of migrated.acupointLog!) expect(allNewIds.has(id)).toBe(true);
  });
});

describe('存档迁移 v13 → v14：入门关之后补 15 关传功缓坡', () => {
  it('第 7 关起顺延 15，入门关不动；过了旧第 7 关的补上缓坡；挂机关跟着顺延', () => {
    const out = migrate({
      clearedStages: ['m1t0s1', 'm1t0s6', 'm1t0s7', 'm1t0s30', 'm2t0s7'],
      attempts: { m1t0s8: 2, m1t0s3: 1 },
      fameClaimed: ['stage:m1t0s10', 'stage:m2t0s4'],
      idle: { map: 1, tier: 0, stage: 30, fights: 9 },
    }, 13, SAVE_VERSION);
    const ramp = Array.from({ length: 15 }, (_, i) => `m1t0s${7 + i}`);
    expect(out.clearedStages).toEqual(['m1t0s1', 'm1t0s6', 'm1t0s22', 'm1t0s45', 'm2t0s7', ...ramp]);
    expect(out.attempts).toEqual({ m1t0s23: 2, m1t0s3: 1 });
    expect(out.fameClaimed).toEqual(['stage:m1t0s25', 'stage:m2t0s4']);
    expect(out.idle).toEqual({ map: 1, tier: 0, stage: 45, fights: 9 });
  });

  it('还在入门关的存档不补缓坡', () => {
    const out = migrate({ clearedStages: ['m1t0s1', 'm1t0s2'], idle: { map: 1, tier: 0, stage: 2, fights: 0 } }, 13, SAVE_VERSION);
    expect(out.clearedStages).toEqual(['m1t0s1', 'm1t0s2']);
    expect(out.idle).toEqual({ map: 1, tier: 0, stage: 2, fights: 0 });
  });
});

describe('存档迁移 v6 → v7：图 1 初入补入门关，原关卡编号顺延 6', () => {
  it('按关卡键记的字段都顺延，其它前沿不动', () => {
    const out = migrate({
      clearedStages: ['m1t0s1', 'm1t0s2', 'm1t1s1'],
      attempts: { m1t0s3: 4, m2t0s1: 1 },
      refarmKey: 'm1t0s2',
      fameClaimed: ['stage:m1t0s4', 'meridian:shoutaiyin'],
    }, 6, SAVE_VERSION);
    // v7 顺延 6 关后，v14 再把第 7 关起顺延 15 关、补上传功缓坡
    const ramp = Array.from({ length: 15 }, (_, i) => `m1t0s${7 + i}`);
    expect(out.clearedStages).toEqual([
      'm1t0s1', 'm1t0s2', 'm1t0s3', 'm1t0s4', 'm1t0s5', 'm1t0s6', 'm1t0s22', 'm1t0s23', 'm1t1s1', ...ramp,
    ]);
    expect(out.attempts).toEqual({ m1t0s24: 4, m2t0s1: 1 });
    expect(out.refarmKey).toBeUndefined();   // v9 废止回刷衰减字段，顺延后再删
    expect(out.fameClaimed).toEqual(['stage:m1t0s25', 'meridian:shoutaiyin']);
  });

  it('v8 → v9：自动连战开关与回刷衰减三字段删掉，其它不动；idle 不补', () => {
    const out = migrate({ autoAdvance: true, refarmKey: 'm1t0s8', refarmCount: 3, refarmAt: 12, silver: 5 } as Record<string, unknown>, 8, SAVE_VERSION);
    expect(out).toEqual({ silver: 5 });
  });

  it('没打过图 1 初入的存档不补入门关；缺的字段不补 undefined', () => {
    const out = migrate({ clearedStages: [] as string[] }, 6, SAVE_VERSION);
    expect(out.clearedStages).toEqual([]);
    expect(Object.keys(out)).toEqual(['clearedStages']);
  });

  it('已是 v7 的存档不再二次迁移', () => {
    const v7 = { clearedStages: ['m1t0s1'] };
    expect(migrate(v7, 7, SAVE_VERSION)).toEqual(v7);
  });
});

describe('存档迁移 v7 → v8：门径并入内功（sect-neigong/spec.md §6.2）', () => {
  it('路线 → 同路数寻常内功，武学等级 → 重数，台阶按重数视为已过，门径字段删除', () => {
    const out = migrate({
      route: 'tangmen', skillLevel: 5, ownedMechNodes: ['tm1', 'tm2'], mechXpInvested: 120,
      switchCount: 1, xp: 189,
    } as Record<string, unknown>, 7, SAVE_VERSION);
    expect(out).toMatchObject({
      neigong: 'shiguxinfa', zhong: 5, tiersPassed: 2, dunwuSec: 0, wuxing: 1, xp: 189,
      ownedNeigong: ['jingleijue', 'zhenyuegong', 'shiguxinfa'],
    });
    for (const k of ['skillLevel', 'ownedMechNodes', 'mechXpInvested', 'switchCount']) expect(out).not.toHaveProperty(k);
  });

  it('境界 1 未择路：不选内功、重数为零', () => {
    const out = migrate({ route: null, skillLevel: 0 } as Record<string, unknown>, 7, SAVE_VERSION);
    expect(out).toMatchObject({ neigong: null, zhong: 0, tiersPassed: 0 });
  });

  it('集齐的真传补偿同路数上乘内功；残页与遗篇丢弃', () => {
    const out = migrate({
      route: 'huashan', skillLevel: 12,
      collectedPages: ['true_jinglei_page_1'], completedBooks: ['true_jinglei', 'legacy_intro'], shopPurchasesThisRun: 1,
    } as Record<string, unknown>, 7, SAVE_VERSION);
    expect(out.ownedNeigong).toEqual(['jingleijue', 'zhenyuegong', 'shiguxinfa', 'leimingjianjing']);
    expect(out.tiersPassed).toBe(3);
    for (const k of ['collectedPages', 'completedBooks', 'shopPurchasesThisRun']) expect(out).not.toHaveProperty(k);
  });
});

describe('v9 → v10（实装四：传功与市集）', () => {
  it('已过境界 1 或已有内功的旧存档视为已传功、市集已开张；境界 1 未选内功的照旧要先遇前辈', () => {
    const a = migrate({ realm: 3, neigong: 'jingleijue', run: 1 } as never, 9, 10) as { taught: boolean; marketOpen: boolean };
    expect(a).toMatchObject({ taught: true, marketOpen: true });
    const b = migrate({ realm: 2, neigong: null, run: 1 } as never, 9, 10) as { taught: boolean; marketOpen: boolean };
    expect(b).toMatchObject({ taught: true, marketOpen: false });
    const c = migrate({ realm: 1, neigong: null, run: 1 } as never, 9, 10) as { taught: boolean; marketOpen: boolean };
    expect(c).toMatchObject({ taught: false, marketOpen: false });
  });
});

describe('v12 → v13（武学一式一页）', () => {
  it('攒过的残页、旧秘籍自带的式、本世已悟的式都算得了那一页；寻常全本并入整门；顿悟记录作废', () => {
    const out = migrate({
      ownedWuxue: ['jinghongjian', 'liuyunjian'],
      books: ['jiyujian:2'],
      pages: { 'feipuduanyajian:3': 2, 'feipuduanyajian:1': 0, 'jinghongjian:4': 5 },
      learnedForms: ['jinghongjian:3'], pastLearned: ['liuyunjian:2'],
      ownedScrolls: ['jinghongjian:5', 'juance:yuntaixinfa'],
    } as Record<string, unknown>, 12, SAVE_VERSION) as Record<string, unknown>;
    expect(out.ownedWuxue).toEqual(['jinghongjian', 'liuyunjian', 'jiyujian']);
    expect([...(out.pages as string[])].sort()).toEqual([
      'feipuduanyajian:3', 'jinghongjian:1', 'jinghongjian:2', 'jinghongjian:3', 'jinghongjian:4', 'jinghongjian:5',
    ]);
    expect(out.ownedScrolls).toEqual(['juance:yuntaixinfa']);
    for (const k of ['books', 'learnedForms', 'pastLearned']) expect(out).not.toHaveProperty(k);
  });
});
