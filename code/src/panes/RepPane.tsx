/**
 * 声望阁 —— 挂机倍率、修行感悟、宿慧、五件传承（economy.md v2.2 §2–§4）；转世后的落地页（§8.6-4）。
 * 结构按定稿原型 docs/design/ui-overhaul-prototype.html「声望阁」`#p-rep`；文案逐字取自 docs/rules/copy/retire.md v2.3 §5。
 */
import { REALMS } from '../engine/content';
import { GANWU_GAIN, REP_NODES, SUHUI, ganwuAffordable, ganwuPrice, suhuiTotal } from '../engine/prestige';
import { currentMult, useGameStore } from '../store/gameStore';
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
  const multTip = `基础 1<br>+ 宿慧 ${suhui.toFixed(1)}×<br>+ 修行感悟 ${ganwu.toFixed(1)}×<br>三项相加即挂机产出倍率`;

  return (
    <>
      <header className="jh-head">
        <div>
          <h1>声望阁</h1>
          <div className="sub">持有 <b>{fmtBig(s.reputation)}</b> 声望</div>
        </div>
        <div className="jh-mult">
          <div className="v jh-dotted" data-tip={multTip}>{currentMult(s).toFixed(1)}×</div>
          <div className="k">挂机产出</div>
        </div>
      </header>

      {s.repTotal > 0 && s.ownedRepNodes.length === 0 && lv === 0 && (
        <p className="jh-guide">你的声望可以换成传承，让下一世更快更远——先挑一件带走。</p>
      )}

      <div className="jh-grid2">
        <section className="jh-card">
          <div className="head">
            <span className="serif">修行感悟</span>
            <small data-tip="侠名在外，江湖自有人奉上资粮。价格每级 +10 声望，和每一世转世拿到的声望一起往上涨。">永久 · 转世不散</small>
          </div>
          <div className="jh-gw">
            <span className="lv">{lv}<small>级</small></span>
            <span className="info">每级挂机产出 +0.2× · 当前 <b>+{ganwu.toFixed(1)}×</b></span>
          </div>
          <div className="jh-gw-btns">
            <button type="button" className="jh-btn" disabled={!canOne} onClick={() => s.buyGanwu('one')}>
              传承一级
              <small>{canOne ? `${fmtBig(nextPrice)} 声望` : `还差 ${fmtBig(Math.ceil(nextPrice - s.reputation))}`}</small>
            </button>
            <button type="button" className="jh-btn quiet" disabled={all.levels < 2} onClick={() => s.buyGanwu('all')}>
              尽数传承
              <small>{all.levels < 2 ? '至少够两级时可用' : `${all.levels} 级 · ${fmtBig(all.cost)} 声望`}</small>
            </button>
          </div>
        </section>

        <section className="jh-card">
          <div className="head">
            <span className="serif">宿慧</span>
            <small data-tip="不耗声望。散功重修，然剑意不灭——身体忘了的，神魂记得。">首达境界自得</small>
          </div>
          <div className="jh-suhui">
            {Object.entries(SUHUI).map(([realm, v]) => {
              const got = Number(realm) <= peak;
              return (
                <div key={realm} className={`r${got ? '' : ' no'}`}>
                  <span>首达 {REALMS[Number(realm) - 1].name}</span>
                  <b>{got ? `+${v.toFixed(1)}×` : `+${v.toFixed(1)}× · 未至`}</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="jh-card jh-card-gap">
        <div className="head"><span className="serif">传承</span><small>一次购得，永久生效</small></div>
        <div className="jh-rows">
          {REP_NODES.map((n) => {
            const owned = s.ownedRepNodes.includes(n.id);
            const short = Math.ceil(n.price - s.reputation);
            return (
              <div key={n.id} className={`jh-row${owned ? ' done' : ''}`}>
                <div className="t"><span className="serif">{n.name}</span><span className="jh-tag">{n.type}</span></div>
                <div className="d">{n.desc}</div>
                <div className="a">
                  {owned ? <span className="price ok">已传承</span> : (
                    <span className="jh-buy">
                      <button type="button" className="jh-btn2" disabled={short > 0} onClick={() => s.buyRepNode(n.id)}>
                        {fmtBig(n.price)} 声望
                      </button>
                      {short > 0 && <small>还差 {fmtBig(short)}</small>}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
