/**
 * 归隐流程：三栏预览 → 二次确认（规格书 §8.6-1/2 硬性要求）
 * 全部玩家可见文案逐字取自 docs/rules/copy/retire.md v2.0 §2/§3（冻结，不得改写）。
 */
import { getStage, MAP_STAGE_COUNT, type MapId } from '../engine/enemies';
import { deepestBoss, settleRetire, suhuiTotal } from '../engine/prestige';
import { retireKind, useGameStore } from '../store/gameStore';
import { RetireHint } from '../components/RetireHint';
import { fmtBig } from '../fmt';

/** 深浅 → 该图 Boss 名（本版深浅 = 图序，三档难度随第 5 步接入） */
const bossName = (depth: number) => getStage(depth as MapId, MAP_STAGE_COUNT[depth as MapId]).name;

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

  if (s.retireStep === 'confirm') {
    return (
      <div className="modal-backdrop open">
        <div className="modal" role="dialog" aria-label="归隐二次确认">
          <div className="modal-head"><span className="serif">就此归隐？</span></div>
          <div className="modal-body">
            <p className="retire-confirm-text">
              这一段江湖就到此为止：境界、武学、通关进度与所有资源都会散去。
              只有声望、修行感悟、宿慧、传承和你留下的江湖记录，随你归来。此去无回头。
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={s.confirmRetire}>挂剑，归隐</button>
              <button className="btn ghost" onClick={s.cancelRetire}>再闯一阵</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal wide" role="dialog" aria-label="归隐盘点">
        <div className="modal-head">
          <span className="serif">归隐盘点</span>
          <span className="modal-sub">看清得失，再做决定</span>
        </div>
        <div className="modal-body">
          <div className="retire-cols">
            <div className="rcol gain">
              <div className="rcol-head">你将获得</div>
              <div className="rline">
                <span>基础声望<small className="why">本世乘区加权 {settle.weightedHours.toFixed(1)} 小时（闭关按六成计）</small></span>
                <span className="v">{fmtBig(settle.base)}</span>
              </div>
              <div className={`rline${settle.frontReached ? '' : ' na'}`}>
                <span>
                  打到自己的前沿
                  <small className="why">
                    {target === 0 ? '尚未击败任何 Boss'
                      : settle.frontReached ? `再败${bossName(target)} · 历来最深`
                        : `今天还没再败${bossName(target)}`}
                  </small>
                </span>
                <span className="v">×{settle.frontMult.toFixed(1)}</span>
              </div>
              {settle.fameThisLife > 0 && (
                <div className="rline na">
                  <span>名号与经脉<small className="why">已随战随得，入账在先</small></span>
                  <span className="v">+{fmtBig(settle.fameThisLife)}</span>
                </div>
              )}
              <div className="rline total">
                <span>本次归隐声望</span><span className="v gold">+{fmtBig(settle.total)}</span>
              </div>
            </div>
            <div className="rcol lose">
              <div className="rcol-head">你将失去</div>
              <div className="rline"><span>境界</span><span className="v">回到「江湖新丁」</span></div>
              <div className="rline"><span>武学</span><span className="v">全部重置</span></div>
              <div className="rline"><span>路线</span><span className="v">重新选择</span></div>
              <div className="rline"><span>通关进度</span><span className="v">各图重推</span></div>
              <div className="rline"><span>内力</span><span className="v">{fmtBig(s.dantian)}　散去</span></div>
              <div className="rline"><span>银两</span><span className="v">{fmtBig(s.silver)}　散去</span></div>
              <div className="rline"><span>阅历</span><span className="v">{fmtBig(s.xp)}　散去</span></div>
            </div>
            <div className="rcol keep">
              <div className="rcol-head">你将保留</div>
              <div className="rline"><span>声望</span><span className="v">现有 {fmtBig(s.reputation)} + 本次 {fmtBig(settle.total)}</span></div>
              <div className="rline"><span>修行感悟</span><span className="v">{s.ganwuLevel ?? 0} 级</span></div>
              <div className="rline"><span>宿慧</span><span className="v">+{suhuiTotal(s.peakRealm ?? 1).toFixed(1)}×</span></div>
              <div className="rline"><span>传承</span><span className="v">已购 {s.ownedRepNodes.length} 件，永久生效</span></div>
              <div className="rline"><span>江湖记录</span><span className="v">名号与通关印记</span></div>
              <RetireHint />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={s.proceedRetire}>决意归隐</button>
            <button className="btn ghost" onClick={s.cancelRetire}>返回江湖</button>
          </div>
        </div>
      </div>
    </div>
  );
}
