/**
 * 前尘 —— 底蕴（修行感悟 + 八条属性，可反复购买）与机缘（十四件一次性）；转世后的落地页（§8.6-4）。
 * 结构按定稿原型 docs/design/prestige-shop-prototype.html；设计 docs/systems/prestige-shop/design.md §5；
 * 文案逐字取自 docs/rules/copy/retire.md v2.4 §5。侠名录（成就）随实装二接入。
 */
import { REALMS } from '../engine/content';
import {
  DIYUN, GANWU_GAIN, REP_NODES, SUHUI, diyunCum, diyunGainAt, diyunPrice, freshDiyun, ganwuPrice,
} from '../engine/prestige';
import { currentMult, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

export type RepSub = 'diyun' | 'jiyuan';

const TIP_GANWU = '侠名在外，江湖自有人奉上资粮。价格每级 +8.5 声望，和每一世转世拿到的声望一起往上涨。';
const TIP_DIYUN = '散功重修，根骨不失——打熬出来的底子随神魂带到来世。';

const pct = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, '')}%`;
const pts = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, '')} 点`;

export function RepPane({ sub, onSub }: { sub: RepSub; onSub: (s: RepSub) => void }) {
  const s = useGameStore();
  const lv = s.ganwuLevel ?? 0;
  const peak = s.peakRealm ?? 1;
  const diyun = { ...freshDiyun(), ...(s.diyun ?? {}) };
  const ganwu = GANWU_GAIN * lv;
  const nextPrice = ganwuPrice(lv + 1);
  const canGanwu = s.reputation >= nextPrice;
  const suhuiLines = Object.entries(SUHUI).map(([realm, v]) => Number(realm) <= peak
    ? `+ 宿慧 · 首达${REALMS[Number(realm) - 1].name} ${v.toFixed(1)}×`
    : `<span class="l">宿慧 · 首达${REALMS[Number(realm) - 1].name} ${v.toFixed(1)}× · 未至</span>`).join('<br>');
  const multTip = `基础 1<br>${suhuiLines}<br>+ 修行感悟 ${ganwu.toFixed(1)}×<br><span class="l">相加即挂机产出倍率</span>`;
  const nothingBought = lv === 0 && Object.values(diyun).every((n) => n === 0) && s.ownedRepNodes.length === 0;

  return (
    <>
      <header className="jh-head">
        <div>
          <h1>前尘</h1>
          <div className="sub">持有 <b>{fmtBig(s.reputation)}</b> 声望</div>
        </div>
        <div className="jh-mult">
          <div className="v jh-dotted" data-tip={multTip}>{currentMult(s).toFixed(1)}×</div>
          <div className="k">挂机产出</div>
        </div>
      </header>

      <div className="jh-seg rep-seg" role="tablist" aria-label="前尘">
        <button type="button" role="tab" aria-selected={sub === 'diyun'} onClick={() => onSub('diyun')}>底蕴</button>
        <button type="button" role="tab" aria-selected={sub === 'jiyuan'} onClick={() => onSub('jiyuan')}>机缘</button>
      </div>

      {s.repTotal > 0 && nothingBought && (
        <p className="jh-guide">你的声望可以换成底蕴与机缘，让下一世更快更远。</p>
      )}

      {sub === 'diyun' && (
        <section className="jh-card">
          <div className="jh-gw">
            <div>
              <div className="n serif" data-tip={TIP_GANWU}>修行感悟</div>
              <div className="big">{lv}<small>级</small></div>
            </div>
            <div className="e">挂机产出 现 <b>+{ganwu.toFixed(1)}×</b><span className="nx">下一级 <b>+{GANWU_GAIN.toFixed(1)}×</b></span></div>
            <div className="jh-buy">
              <button type="button" className="jh-btn2" disabled={!canGanwu} onClick={() => s.buyGanwu('one')}>{fmtBig(nextPrice)} 声望</button>
              {!canGanwu && <small>还差 {fmtBig(Math.ceil(nextPrice - s.reputation))}</small>}
            </div>
          </div>
          <div className="jh-diyun">
            {DIYUN.map((d) => {
              const n = diyun[d.id];
              const price = diyunPrice(n + 1);
              const can = s.reputation >= price;
              const fmt = d.kind === 'pts' ? pts : pct;
              return (
                <div key={d.id} className="tile">
                  <div className="n serif" data-tip={TIP_DIYUN}>{d.name}</div>
                  <div className="big">{n}<small>级</small></div>
                  <div className="e">
                    <span>现 <b>+{fmt(diyunCum(d.first, n))}</b></span>
                    <span className="nx">下一级 <b>+{fmt(diyunGainAt(d.first, n + 1))}</b></span>
                  </div>
                  <div className="btns">
                    <button type="button" className="jh-btn2" disabled={!can} onClick={() => s.buyDiyun(d.id)}>{fmtBig(price)} 声望</button>
                    {!can && <small>还差 {fmtBig(Math.ceil(price - s.reputation))}</small>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sub === 'jiyuan' && (
        <section className="jh-card">
          <div className="head"><span className="serif">机缘</span><small>一次购得，永久生效</small></div>
          <div className="jh-rows">
            {REP_NODES.map((n) => {
              const owned = s.ownedRepNodes.includes(n.id);
              const short = Math.ceil(n.price - s.reputation);
              return (
                <div key={n.id} className={`jh-row${owned ? ' done' : ''}`}>
                  <div className="t"><span className="serif">{n.name}</span><span className="jh-tag">{n.type}</span></div>
                  <div className="d">{n.desc}</div>
                  <div className="a">
                    {owned ? <span className="price ok">已得</span> : (
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
      )}
    </>
  );
}
