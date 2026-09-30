/**
 * 转世演出（盘点即演出，规格书 §8.6-1/2）：定稿原型 docs/design/ui-overhaul-prototype.html `#d-retire`（jh-ceremony.dusk）。
 * 「随魂而去 / 随身而散」两栏看清得失，「就此转世」直接确认；结算构成放进声望大字的悬停。
 * 全部玩家可见文案逐字取自 docs/rules/copy/retire.md v2.3 §2（单源）。
 */
import { getStage, mapName, TIER_NAMES, trackLength, type MapId, type TierId } from '../engine/enemies';
import { SECTS } from '../engine/sect';
import { deepestBoss, settleRetire, suhuiTotal } from '../engine/prestige';
import { retireKind, useGameStore } from '../store/gameStore';
import { RetireHint } from '../components/RetireHint';
import { fmtBig } from '../fmt';
import { INIT_AGE, lifespanCap, outlivesADay } from '../engine/reincarnation';

/** 深浅（难度 × 10 + 图序）→「图 · 难度 的 Boss 名」 */
function bossName(depth: number): string {
  const map = (depth % 10) as MapId;
  const tier = Math.floor(depth / 10) as TierId;
  return `${mapName(map)} · ${TIER_NAMES[tier]}的${getStage(map, tier, trackLength(map, tier)).name}`;
}

/** 「就此转世」：演出即盘点，直接走完 store 的两步（preview → confirm → 结算） */
function commitRetire() {
  const st = useGameStore.getState();
  if (st.retireStep === 'preview') st.proceedRetire();
  useGameStore.getState().confirmRetire();
}

export function RetireFlow() {
  const s = useGameStore();
  if (retireKind(s) === null || s.retireStep === null) return null;
  const settle = settleRetire({
    weightedHours: s.lifeWeightedHours ?? 0,
    clearedStages: s.clearedStages,
    deepestBossEver: s.deepestBossEver ?? 0,
    fameThisLife: s.fameThisLife ?? 0,
  });
  const target = Math.max(s.deepestBossEver ?? 0, deepestBoss(s.clearedStages));

  // 寿元提示（retire.md §2.3）：剩余寿元够再活一天才显示——撑不到下次上线时，此时转世正是时候
  const age = s.age ?? INIT_AGE;
  const lost = s.lifespanLost ?? 0;
  const yearsLeft = Math.floor(lifespanCap(s.realm, lost) - age);
  const warnLifespan = outlivesADay(age, s.realm, lost, s.peakRealm ?? 1);

  // 结算构成悬停（retire.md §2.1）
  const tip = [
    `基础声望 ${fmtBig(settle.base)}（本世挂机加权 ${settle.weightedHours.toFixed(1)} 小时，闭关按六成计）`,
    target === 0 ? '× 1.0 尚未击败任何 Boss'
      : settle.frontReached ? `× ${settle.frontMult.toFixed(1)} 再败${bossName(target)} · 历来最深`
        : `× 1.0 今天还没再败${bossName(target)}`,
    ...(settle.fameThisLife > 0 ? [`名号与经脉 +${fmtBig(settle.fameThisLife)} 已随战随得，入账在先`] : []),
    `现有声望 ${fmtBig(s.reputation)}`,
  ].join('<br>');

  return (
    <div className="jh-ceremony dusk" role="dialog" aria-label="转世">
      <div>
        <div className="kick">转 世</div>
        <h2 className="mid">此生至此</h2>
        <div className="d">皮囊散去，不灭功法载魂而行，来世再入江湖</div>
        <div className="ledger3">
          <div>
            <div className="lh g">随魂而去</div>
            <div className="big jh-dotted" data-tip={tip}>+{fmtBig(settle.total)}<small>声望</small></div>
            <p>
              修行感悟 {s.ganwuLevel ?? 0} 级 · 宿慧 +{suhuiTotal(s.peakRealm ?? 1).toFixed(1)}×<br />
              内功 {(s.ownedNeigong ?? []).length} 部 · 传承 {s.ownedRepNodes.length} 件<br />
              名号与通关印记
            </p>
            <RetireHint />
          </div>
          <div className="lost">
            <div className="lh l">随身而散</div>
            <p>
              境界回到江湖新丁<br />
              内功重数清零<br />
              各图通关进度<br />
              内力 {fmtBig(s.dantian)} · 银两 {fmtBig(s.silver)}
              {s.sect && <><br />{SECTS[s.sect].name}贡献 {fmtBig(s.contrib ?? 0)}</>}
            </p>
          </div>
        </div>
        {warnLifespan && (
          <p className="warn">寿元尚有 {yearsLeft} 年。此时转世，这一世的修为就此散去——活得越久，这一世爬得越高。</p>
        )}
        <div className="acts">
          <button type="button" className="jh-btn quiet" onClick={s.cancelRetire}>再闯一阵</button>
          <button type="button" className="jh-btn" onClick={commitRetire}>就此转世</button>
        </div>
      </div>
    </div>
  );
}
