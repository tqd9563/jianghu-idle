/**
 * 存档迁移测试 —— v2→v3 窍穴 id 由位置编码改为穴位拼音。
 * 迁移链路此前是死代码（gameStore 直接调 loadGame，绕过 migrate），本测试锁死它被真正调用。
 */
import { describe, expect, it } from 'vitest';
import { migrate, SAVE_VERSION } from './storage';
import { allStages, stageKey, trackLength, VOLUMES } from '../engine/enemies';
import { isBossKey, isEliteKey } from '../engine/prestige';

/** v18 之前的用例只迁到 v17：v18 改写关卡键（卷章图关），另有专门用例 */
const V17 = 17;
import { learnedFormsOf as learnedFormsOfStore } from '../store/gameStore';
import { REALM_ACUPOINTS } from '../engine/acupoints';

describe('存档迁移 v2 → v3：窍穴 id 重写', () => {
  it('acupointProgress 的键被换成新 id，进度值原样保留', () => {
    const out = migrate(
      { acupointProgress: { 'r2-a11': { failCount: 2, opened: true } } },
      2, V17
    );
    expect(out.acupointProgress).toEqual({ quchi: { failCount: 2, opened: true } });
  });

  it('acupointLog 的元素被换成新 id 并去重', () => {
    const out = migrate(
      { acupointLog: ['r5-a31', 'r5-a32', 'r5-a31'] },
      2, V17
    );
    expect(out.acupointLog).toEqual(['wushu', 'weidao']);
  });

  it('映射不到的键原样保留——宁可留孤儿键也不静默吞掉玩家进度', () => {
    const out = migrate(
      { acupointProgress: { 'unknown-id': { failCount: 0, opened: true } } },
      2, V17
    );
    expect(out.acupointProgress).toHaveProperty('unknown-id');
  });

  it('已是 v3 的存档不再二次迁移', () => {
    const v3 = { acupointProgress: { quchi: { failCount: 0, opened: true } } };
    expect(migrate(v3, 3, V17)).toEqual(v3);
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
      ] }, 2, V17
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
    }, 13, 14);
    const ramp = Array.from({ length: 15 }, (_, i) => `m1t0s${7 + i}`);
    expect(out.clearedStages).toEqual(['m1t0s1', 'm1t0s6', 'm1t0s22', 'm1t0s45', 'm2t0s7', ...ramp]);
    expect(out.attempts).toEqual({ m1t0s23: 2, m1t0s3: 1 });
    expect(out.fameClaimed).toEqual(['stage:m1t0s25', 'stage:m2t0s4']);
    expect(out.idle).toEqual({ map: 1, tier: 0, stage: 45, fights: 9 });
  });

  it('还在入门关的存档不补缓坡', () => {
    const out = migrate({ clearedStages: ['m1t0s1', 'm1t0s2'], idle: { map: 1, tier: 0, stage: 2, fights: 0 } }, 13, 14);
    expect(out.clearedStages).toEqual(['m1t0s1', 'm1t0s2']);
    expect(out.idle).toEqual({ map: 1, tier: 0, stage: 2, fights: 0 });
  });
});

describe('存档迁移 v14 → v15：图 1 初入 101 → 40 关，旧关号按当量折算', () => {
  it('入门关不动；缓坡三关折一关、主段 14 关折 5 关、Boss 101 → 40；折到同一关的去重、次数相加', () => {
    const out = migrate({
      clearedStages: ['m1t0s1', 'm1t0s6', 'm1t0s7', 'm1t0s9', 'm1t0s10', 'm1t0s21', 'm1t0s22', 'm1t0s35', 'm1t0s36', 'm1t0s100', 'm1t0s101', 'm2t0s7'],
      attempts: { m1t0s22: 2, m1t0s23: 3, m1t0s3: 1 },
      fameClaimed: ['stage:m1t0s25', 'stage:m1t0s101', 'stage:m2t0s4'],
      idle: { map: 1, tier: 0, stage: 64, fights: 9 },
    }, 14, V17);
    expect(out.clearedStages).toEqual(['m1t0s1', 'm1t0s6', 'm1t0s7', 'm1t0s8', 'm1t0s11', 'm1t0s12', 'm1t0s16', 'm1t0s17', 'm1t0s39', 'm1t0s40', 'm2t0s7']);
    expect(out.attempts).toEqual({ m1t0s12: 5, m1t0s3: 1 });
    expect(out.fameClaimed).toEqual(['stage:m1t0s13', 'stage:m1t0s40', 'stage:m2t0s4']);
    expect(out.idle).toEqual({ map: 1, tier: 0, stage: 27, fights: 9 });
  });

  it('旧存档全通 1–101 折算后恰好是新表 1–40 连续通关', () => {
    const all = Array.from({ length: 101 }, (_, i) => `m1t0s${i + 1}`);
    const out = migrate({ clearedStages: all }, 14, V17);
    expect(out.clearedStages).toEqual(Array.from({ length: 40 }, (_, i) => `m1t0s${i + 1}`));
  });
});

describe('存档迁移 v6 → v7：图 1 初入补入门关，原关卡编号顺延 6', () => {
  it('按关卡键记的字段都顺延，其它前沿不动', () => {
    const out = migrate({
      clearedStages: ['m1t0s1', 'm1t0s2', 'm1t1s1'],
      attempts: { m1t0s3: 4, m2t0s1: 1 },
      refarmKey: 'm1t0s2',
      fameClaimed: ['stage:m1t0s4', 'meridian:shoutaiyin'],
    }, 6, 14);
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
    const out = migrate({ autoAdvance: true, refarmKey: 'm1t0s8', refarmCount: 3, refarmAt: 12, silver: 5 } as Record<string, unknown>, 8, V17);
    expect(out).toEqual({ silver: 5 });
  });

  it('没打过图 1 初入的存档不补入门关；缺的字段不补 undefined', () => {
    const out = migrate({ clearedStages: [] as string[] }, 6, V17);
    expect(out.clearedStages).toEqual([]);
    expect(Object.keys(out)).toEqual(['clearedStages']);
  });

  it('已是 v7 的存档不再二次迁移', () => {
    const v7 = { clearedStages: ['m1t0s1'] };
    expect(migrate(v7, 7, V17)).toEqual(v7);
  });
});

describe('存档迁移 v7 → v8：门径并入内功（sect-neigong/spec.md §6.2）', () => {
  it('路线 → 同路数寻常内功，武学等级 → 重数，台阶按重数视为已过，门径字段删除', () => {
    const out = migrate({
      route: 'tangmen', skillLevel: 5, ownedMechNodes: ['tm1', 'tm2'], mechXpInvested: 120,
      switchCount: 1, xp: 189,
    } as Record<string, unknown>, 7, V17);
    expect(out).toMatchObject({
      neigong: 'shiguxinfa', zhong: 5, tiersPassed: 2, dunwuSec: 0, wuxing: 1, xp: 189,
      ownedNeigong: ['jingleijue', 'zhenyuegong', 'shiguxinfa'],
    });
    for (const k of ['skillLevel', 'ownedMechNodes', 'mechXpInvested', 'switchCount']) expect(out).not.toHaveProperty(k);
  });

  it('境界 1 未择路：不选内功、重数为零', () => {
    const out = migrate({ route: null, skillLevel: 0 } as Record<string, unknown>, 7, V17);
    expect(out).toMatchObject({ neigong: null, zhong: 0, tiersPassed: 0 });
  });

  it('集齐的真传补偿同路数上乘内功；残页与遗篇丢弃', () => {
    const out = migrate({
      route: 'huashan', skillLevel: 12,
      collectedPages: ['true_jinglei_page_1'], completedBooks: ['true_jinglei', 'legacy_intro'], shopPurchasesThisRun: 1,
    } as Record<string, unknown>, 7, V17);
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
    } as Record<string, unknown>, 12, V17) as Record<string, unknown>;
    expect(out.ownedWuxue).toEqual(['jinghongjian', 'liuyunjian', 'jiyujian']);
    expect([...(out.pages as string[])].sort()).toEqual([
      'feipuduanyajian:3', 'jinghongjian:1', 'jinghongjian:2', 'jinghongjian:3', 'jinghongjian:4', 'jinghongjian:5',
    ]);
    expect(out.ownedScrolls).toEqual(['juance:yuntaixinfa']);
    for (const k of ['books', 'learnedForms', 'pastLearned']) expect(out).not.toHaveProperty(k);
  });
});

describe('v15 → v16（熟练阈值重标，issue #79）', () => {
  it('每式出招数按新旧圆满之比放大、向上取整：旧档已圆满的式照旧圆满，接上的下一式不收回', () => {
    const before = { ownedWuxue: ['liuyunjian', 'jinghongjian', 'cangyajianjue'], pages: ['jinghongjian:1', 'jinghongjian:2', 'cangyajianjue:1', 'cangyajianjue:2'],
      formCasts: { 'liuyunjian:1': 25, 'liuyunjian:2': 3, 'jinghongjian:1': 28, 'cangyajianjue:1': 32, 'cangyajianjue:2': 1, 'weizhi:1': 2 } };
    const out = migrate(before as Record<string, unknown>, 15, V17) as typeof before;
    expect(out.formCasts).toEqual({ 'liuyunjian:1': 250, 'liuyunjian:2': 30, 'jinghongjian:1': 300, 'cangyajianjue:1': 350, 'cangyajianjue:2': 11, 'weizhi:1': 20 });
    expect(learnedFormsOfStore(out, 'liuyunjian')).toEqual([1, 2]);
    expect(learnedFormsOfStore(out, 'jinghongjian')).toEqual([1, 2]);
    expect(learnedFormsOfStore(out, 'cangyajianjue')).toEqual([1, 2]);
    expect(migrate({ realm: 2 }, 15, V17)).toEqual({ realm: 2 });
  });
});

describe('v16 → v17（真气 ×10）', () => {
  it('行囊、身上、挂机小结、黑市揭晓货里的蕴气词条都 ×10，其它词条与字段不动', () => {
    const item = (afx: [string, number][]) => ({ id: 'g', slot: '佩饰', name: '青玉佩', base: { 闪避: 3 }, afx, sell: 1, fresh: false });
    const before = {
      realm: 3,
      bag: [item([['qi', 5], ['crit', 2]])],
      worn: { 衣甲: item([['hp', 3], ['qi', 4]]) },
      idle: { map: 1, tier: 0, stage: 3, fights: 2, sess: { best: item([['qi', 6]]) } },
      blackGoods: [{ id: 'b', revealed: { gear: item([['qi', 3]]) } }, { id: 'c', revealed: null }],
    };
    const out = migrate(before as Record<string, unknown>, 16, V17) as typeof before;
    expect(out.bag[0].afx).toEqual([['qi', 50], ['crit', 2]]);
    expect(out.worn.衣甲.afx).toEqual([['hp', 3], ['qi', 40]]);
    expect(out.idle.sess.best.afx).toEqual([['qi', 60]]);
    expect(out.blackGoods[0].revealed!.gear.afx).toEqual([['qi', 30]]);
    expect(out.blackGoods[1]).toEqual({ id: 'c', revealed: null });
    expect(out.realm).toBe(3);
    expect(migrate(out as Record<string, unknown>, 17, V17)).toEqual(out);
  });
});

describe('v17 → v18：卷章图关，按当量折算进度与首杀', () => {
  it('版本号升到 18', () => {
    expect(SAVE_VERSION).toBe(18);
  });

  it('旧图 1 初入全通：新表卷一整卷与卷二之后当量不超过旧 Boss 的关依次记为已过，开放次序连贯', () => {
    const old = Array.from({ length: 40 }, (_, i) => `m1t0s${i + 1}`);
    const out = migrate({ clearedStages: old, tiersUnlocked: ['1-0', '2-0', '1-1'] } as Record<string, unknown>, 17, 18) as Record<string, unknown>;
    const cleared = out.clearedStages as string[];
    for (const m of VOLUMES[0].maps) for (let st = 1; st <= trackLength(m); st++) expect(cleared).toContain(stageKey(m, st));
    // 已过关卡在每张图里从第 1 关连续
    const byMap = new Map<number, number[]>();
    for (const k of cleared) { const [m, st] = k.slice(1).split('s').map(Number); byMap.set(m, [...(byMap.get(m) ?? []), st]); }
    for (const sts of byMap.values()) expect(sts).toEqual(Array.from({ length: sts.length }, (_, i) => i + 1));
    expect(out.tiersUnlocked).toBeUndefined();
    const opened = out.mapsUnlocked as number[];
    expect(opened[0]).toBe(1);
    expect(opened).toContain(VOLUMES[1].maps[0]);
  });

  it('首杀：每个旧精英 / Boss 首杀换成新表同类关卡，计数不变；经脉键原样', () => {
    const fame = ['stage:m1t0s8', 'stage:m1t0s16', 'stage:m1t0s40', 'stage:m2t0s37', 'meridian:shoutaiyin'];
    const out = migrate({ fameClaimed: fame } as Record<string, unknown>, 17, 18) as Record<string, unknown>;
    const f = out.fameClaimed as string[];
    expect(f).toHaveLength(5);
    expect(f).toContain('meridian:shoutaiyin');
    const stages = f.filter((k) => k.startsWith('stage:')).map((k) => k.slice(6));
    expect(stages.filter((k) => isEliteKey(k))).toHaveLength(2);
    expect(stages.filter((k) => isBossKey(k))).toHaveLength(2);
    expect(new Set(stages).size).toBe(4);
    const pool = new Set(allStages().map((e) => stageKey(e.map, e.stage)));
    for (const k of stages) expect(pool.has(k)).toBe(true);
  });

  it('历来最深 Boss、Boss 必掉记录按境界段换成卷；挂机换到已过关卡；尝试次数清空', () => {
    const out = migrate({
      deepestBossEver: 11, dropsClaimed: ['1-0', '2-0', '1-1'],
      clearedStages: Array.from({ length: 12 }, (_, i) => `m1t0s${i + 1}`),
      idle: { map: 1, tier: 0, stage: 10, fights: 4 }, attempts: { m1t0s13: 2 },
    } as Record<string, unknown>, 17, 18) as Record<string, unknown>;
    expect(out.deepestBossEver).toBe(6);
    expect(out.dropsClaimed).toEqual(['v4', 'v6', 'v5']);
    expect(out.idle).toEqual({ map: 1, stage: 10, fights: 4 });
    expect(out.attempts).toEqual({});
  });

  it('全新存档（没打过任何关）迁移后只开卷一赶路图', () => {
    const out = migrate({ clearedStages: [], tiersUnlocked: ['1-0'], fameClaimed: [] } as Record<string, unknown>, 17, 18) as Record<string, unknown>;
    expect(out.clearedStages).toEqual([]);
    expect(out.mapsUnlocked).toEqual([1]);
  });
});
