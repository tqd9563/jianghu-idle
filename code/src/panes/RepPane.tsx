/**
 * 声望阁 —— 8 个永久节点（声望经济表 §2 v1.1）；归隐落地页（§8.6-4：30 秒内兑现首购）。
 * 界面与节点卡文案逐字取自 docs/mvp0/copy/retire.md §5（冻结）。
 */
import { REP_NODES } from '../engine/prestige';
import { useGameStore } from '../store/gameStore';
import { ShopCategory } from '../components/ShopCategory';

export function RepPane() {
  const s = useGameStore();

  return (
    <div className="pane-wrap wide">
      <section className="panel">
        <div className="panel-head">
          声望阁 <span className="sub">归隐者的传承</span>
          <span className="rep-balance">声望 <b>{s.reputation}</b></span>
        </div>
        <div className="panel-body">
          {s.repTotal > 0 && s.ownedRepNodes.length === 0 && (
            <div className="rep-guide">
              你的声望可以换成传承，让下一轮更快更远——先挑一件带走。
            </div>
          )}
          <div className="rep-grid">
            {REP_NODES.map((n) => {
              const owned = s.ownedRepNodes.includes(n.id);
              const affordable = s.reputation >= n.price;
              return (
                <div key={n.id} className={`rep-node${owned ? ' owned' : ''}`}>
                  <div className="rn-head">
                    <span className="rn-name serif">{n.name}</span>
                    {owned ? <span className="rn-owned">已传承</span> : <span className="rn-type">{n.type}</span>}
                  </div>
                  <div className="rn-desc">{n.desc}</div>
                  {!owned && (
                    <div className="rn-foot">
                      <button
                        className={affordable ? 'btn small' : 'btn small ghost'}
                        disabled={!affordable}
                        onClick={() => s.buyRepNode(n.id)}
                      >
                        {affordable ? `传承（${n.price} 声望）` : '声望不足'}
                      </button>
                      {!affordable && <div className="rn-lack">还差 {n.price - s.reputation}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ShopCategory />
        </div>
      </section>
    </div>
  );
}
