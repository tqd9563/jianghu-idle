/**
 * 归隐流程：三栏预览 → 二次确认（规格书 §8.6-1/2 硬性要求）
 * 全部玩家可见文案逐字取自 docs/rules/copy/retire.md §2/§3/§6（冻结，不得改写）。
 */
import { settleRetire } from '../engine/prestige';
import { retireKind, useGameStore } from '../store/gameStore';
import { RetireHint } from '../components/RetireHint';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export function RetireFlow() {
  const s = useGameStore();
  const kind = retireKind(s);
  if (kind === null || s.retireStep === null) return null;
  const settle = settleRetire(kind, s.clearedStages, s.runPlaySec);

  if (s.retireStep === 'confirm') {
    return (
      <div className="modal-backdrop open">
        <div className="modal" role="dialog" aria-label="归隐二次确认">
          <div className="modal-head"><span className="serif">就此归隐？</span></div>
          <div className="modal-body">
            <p className="retire-confirm-text">
              这一段江湖就到此为止：境界、武学、地图进度与所有资源都会散去。
              只有声望、已购节点和你留下的江湖记录，随你归来。此去无回头。
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
              {settle.milestones.map((m) => (
                <div key={m.boss} className={`rline${m.achieved ? '' : ' na'}`}>
                  <span>{m.achieved ? `击败${m.boss}` : `${m.boss}未败`}</span>
                  <span className="v">+{m.achieved ? m.value : 0}</span>
                </div>
              ))}
              <div className="rline subtotal">
                <span>基础声望</span><span className="v">{settle.base}</span>
              </div>
              <div className={`rline${settle.eliteKills > 0 ? '' : ' na'}`}>
                <span>精英首杀 ×{settle.eliteKills}</span>
                <span className="v">+{settle.eliteKills * 4}%</span>
              </div>
              <div className={`rline${settle.fullClear ? '' : ' na'}`}>
                <span>{settle.fullClear ? '五图全通' : '五图未全通'}</span>
                <span className="v">+{settle.fullClear ? 10 : 0}%</span>
              </div>
              {/* 加成触顶时显式说明，避免分项之和（可达 +58%）与实际生效值对不上（retire-copy §7.1） */}
              {settle.perfPct >= 0.30 && settle.eliteKills * 4 + (settle.fullClear ? 10 : 0) > 30 && (
                <div className="rline subtotal">
                  <span>表现加成封顶</span><span className="v">+30%</span>
                </div>
              )}
              {settle.discount < 1 && (
                <>
                  <div className="rline penalty">
                    <span>未竟折算</span><span className="v">×60%</span>
                  </div>
                  <div className="rline-note">击败黑风寨主可获得全额声望</div>
                </>
              )}
              {settle.timePenalty < 1 && (
                <div className="rline penalty">
                  <span>轮时过短</span>
                  <span className="v">×{Math.round(settle.timePenalty * 100) / 100}</span>
                </div>
              )}
              <div className="rline total">
                <span>本次归隐声望</span><span className="v gold">+{settle.total}</span>
              </div>
            </div>
            <div className="rcol lose">
              <div className="rcol-head">你将失去</div>
              <div className="rline"><span>境界</span><span className="v">回到「江湖新丁」</span></div>
              <div className="rline"><span>地图</span><span className="v">回到「村外小径」</span></div>
              <div className="rline"><span>武学</span><span className="v">全部重置</span></div>
              <div className="rline"><span>路线</span><span className="v">重新选择</span></div>
              <div className="rline"><span>内力</span><span className="v">{fmt(s.dantian)}　散去</span></div>
              <div className="rline"><span>银两</span><span className="v">{fmt(s.silver)}　散去</span></div>
              <div className="rline"><span>阅历</span><span className="v">{fmt(s.xp)}　散去</span></div>
            </div>
            <div className="rcol keep">
              <div className="rcol-head">你将保留</div>
              <div className="rline"><span>声望</span><span className="v">现有 {fmt(s.reputation)} + 本次 {settle.total}</span></div>
              <div className="rline"><span>声望节点</span><span className="v">已购 {s.ownedRepNodes.length} 个，永久生效</span></div>
              <div className="rline"><span>江湖记录</span><span className="v">Boss 首破与通关印记</span></div>
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
