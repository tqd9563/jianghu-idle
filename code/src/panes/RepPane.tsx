/**
 * 声望阁 —— 乘区账、修行感悟、宿慧、五件传承（economy.md v2.2 §2–§4）；归隐落地页（§8.6-4）。
 * 结构按获批原型 docs/design/longline-prototype.html §2；文案逐字取自 docs/rules/copy/retire.md v2.0 §5（冻结）。
 */
import { REALMS } from '../engine/content';
import { GANWU_GAIN, REP_NODES, SUHUI, ganwuAffordable, ganwuPrice, suhuiTotal } from '../engine/prestige';
import { currentMult, useGameStore } from '../store/gameStore';
import { ShopCategory } from '../components/ShopCategory';
import { fmtBig } from '../fmt';

export function RepPane() {
  const s = useGameStore();
  const lv = s.ganwuLevel ?? 0;
  const peak = s.peakRealm ?? 1;
  const suhui = suhuiTotal(peak);
  const ganwu = GANWU_GAIN * lv;
  const nextPrice = ganwuPrice(lv + 1);
  const canOne = s.reputation >= nextPrice;
  const all = ganwuAffordable(lv, s.reputation);

  return (
    <div className="pane-wrap wide">
      <section className="panel">
        <div className="panel-head">
          声望阁 <span className="sub">归隐者的传承</span>
          <span className="rep-balance">声望 <b>{fmtBig(s.reputation)}</b></span>
        </div>
        <div className="panel-body">
          {s.repTotal > 0 && s.ownedRepNodes.length === 0 && lv === 0 && (
            <div className="rep-guide">
              你的声望可以换成传承，让下一世更快更远——先挑一件带走。
            </div>
          )}
          <div className="rep-ledger">
            <span className="k">挂机产出乘区</span>
            <span>基础 <b>1</b></span><span className="op">+</span>
            <span>宿慧 <b>{suhui.toFixed(1)}×</b></span><span className="op">+</span>
            <span>修行感悟 <b>{ganwu.toFixed(1)}×</b></span><span className="op">=</span>
            <span className="total"><b>{currentMult(s).toFixed(1)}×</b></span>
          </div>

          <div className="rep-top">
            <div className="rep-card ganwu">
              <div className="rc-head">
                <span className="rc-name serif">修行感悟</span>
                <span className="rc-sub">无限级 · 每级挂机产出 +0.2×</span>
                <span className="rc-corner">永久 · 归隐不散</span>
              </div>
              <div className="gw-row">
                <span className="gw-lv">{lv}<small>级</small></span>
                <span className="gw-eff">当前 <b>+{ganwu.toFixed(1)}×</b></span>
                <span className="gw-eff">下一级 <b>{fmtBig(nextPrice)}</b> 声望</span>
              </div>
              <div className="gw-buy">
                <button className="btn" disabled={!canOne} onClick={() => s.buyGanwu('one')}>
                  传承一级
                  <span className="btn-sub">{canOne ? `${fmtBig(nextPrice)} 声望` : `还差 ${fmtBig(nextPrice - s.reputation)}`}</span>
                </button>
                <button className="btn ghost" disabled={all.levels < 2} onClick={() => s.buyGanwu('all')}>
                  尽数传承
                  <span className="btn-sub">{all.levels < 2 ? '至少够两级时可用' : `${all.levels} 级 · ${fmtBig(all.cost)} 声望`}</span>
                </button>
              </div>
              <div className="rc-desc">侠名在外，江湖自有人奉上资粮。价格每级 +10 声望，和每天归隐拿到的声望一起往上涨。</div>
            </div>

            <div className="rep-card">
              <div className="rc-head">
                <span className="rc-name serif">宿慧</span>
                <span className="rc-corner">首达境界自得 · 不耗声望</span>
              </div>
              <div className="suhui-list">
                {Object.entries(SUHUI).map(([realm, v]) => {
                  const got = Number(realm) <= peak;
                  return (
                    <div key={realm} className={`suhui-row${got ? '' : ' pending'}`}>
                      首达 {REALMS[Number(realm) - 1].name}
                      <b>{got ? `+${v.toFixed(1)}×` : `+${v.toFixed(1)}× · 未至`}</b>
                    </div>
                  );
                })}
              </div>
              <div className="rc-desc">散功重修，然剑意不灭——身体忘了的，神魂记得。</div>
            </div>
          </div>

          <div className="rep-subhead">传承</div>
          <div className="rep-grid qol">
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
                        {affordable ? `传承（${fmtBig(n.price)} 声望）` : '声望不足'}
                      </button>
                      {!affordable && <div className="rn-lack">还差 {fmtBig(n.price - s.reputation)}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="cap-note">旧梦重温、快速入门、江湖熟路三件已废止，不再陈列。</div>
          <ShopCategory />
        </div>
      </section>
    </div>
  );
}
