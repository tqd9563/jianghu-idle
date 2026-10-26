/**
 * 测试辅助：旧用例按「图 × 难度 × 关」点名某一关，是为了拿到那个强度的敌人。
 * 卷章图关改造后按冻结的 v17 关卡表查出那一关的当量，换成新表里同类、当量最接近的一关。
 */
import legacy from '../save/legacy/v17-stages.json';
import { allStages, getStage, stageKey, type EnemyDef } from './enemies';

const V17 = legacy as unknown as Record<string, [string, number][]>;
const KIND: Record<string, EnemyDef['kind']> = { n: 'normal', e: 'elite', b: 'boss' };

/** 旧表 (图, 难度, 关) → 新表里同类、当量最接近的一关 */
export function legacyStage(map: number, tier: number, stage: number): EnemyDef {
  const row = V17[`${map}-${tier}`]?.[stage - 1];
  if (!row) throw new Error(`no v17 stage ${map}-${tier}-${stage}`);
  const [k, x] = row;
  const best = allStages().filter((e) => e.kind === KIND[k])
    .sort((a, b) => Math.abs((a.x ?? 0) - x) - Math.abs((b.x ?? 0) - x))[0];
  return getStage(best.map, best.stage);
}

/** 同上，返回新关卡键 */
export const legacyKey = (map: number, tier: number, stage: number) => {
  const e = legacyStage(map, tier, stage);
  return stageKey(e.map, e.stage);
};

/** 旧表某条前沿的关数 */
export const legacyLength = (map: number, tier: number) => V17[`${map}-${tier}`]?.length ?? 0;
