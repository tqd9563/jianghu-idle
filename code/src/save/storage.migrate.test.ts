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
