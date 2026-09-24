/**
 * 归隐结算演出（规格书 §8.6-3）：声望入账的峰终庆典 + 本轮总结；关闭后落地声望阁（§8.6-4）。
 * 文案模板逐字取自 docs/rules/copy/retire.md §4（冻结）。
 */
import { useGameStore } from '../store/gameStore';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const cnOrd = (n: number) => (n < CN.length ? CN[n] : String(n));

export function RetireCeremony({ onDone }: { onDone: () => void }) {
  const s = useGameStore();
  const c = s.retireCeremony;
  if (!c) return null;
  const minutes = Math.round(c.durationSec / 60);
  // {S} = 本轮 kind ∈ {elite, boss} 的首通计数（retire-copy §4 变量定义）
  const strongFoes = c.settle.milestones.filter((m) => m.achieved).length + c.settle.eliteKills;
  // {最远足迹} 措辞映射（retire-copy §4）
  const boss3 = c.settle.milestones[2].achieved;
  const footprint = boss3
    ? '踏平黑风寨，走完了华山古道'
    : c.maxMap === 3 ? '走到了华山古道'
      : c.maxMap === 2 ? '一路走到了洛阳近郊'
        : '足迹停在村外小径';

  return (
    <div className="modal-backdrop open ceremony">
      <div className="modal ceremony-card" role="dialog" aria-label="归隐结算">
        {/* 强制转世只在两处与主动归隐分岔：卡顶死因、声望后的来世交代（原型 §3；文案 copy/reincarnation.md §3） */}
        {c.cause && (
          <div className="ceremony-cause">
            <b>{c.deathAge}</b> 岁 · {c.cause === 'old' ? '寿终' : '重伤不治'}
          </div>
        )}
        <div className="ceremony-title serif">你的第{cnOrd(c.runEnded)}段江湖</div>
        <div className="ceremony-sum">
          历时 {minutes} 分钟，击败了 {strongFoes} 个强敌，{footprint}。
        </div>
        <div className="ceremony-rep">
          <span className="label">江湖会记得你</span>
          <span className="value gold serif">声望 +{c.settle.total}</span>
          {c.cause && <span className="full">全额入账</span>}
        </div>
        {c.cause && (
          <div className="soul-note">
            <div className="t"><span className="serif">魂魄未稳</span></div>
            <div>仓促离世，魂魄受了创。来世首次突破之前，修炼只得六成。</div>
          </div>
        )}
        <button className="btn" onClick={onDone}>{c.cause ? '转世 · 再入江湖' : '进入声望阁'}</button>
      </div>
    </div>
  );
}
