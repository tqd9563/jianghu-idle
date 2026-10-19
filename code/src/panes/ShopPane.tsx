/**
 * 市集页 —— 定稿原型 docs/design/battle-loot-prototype.html `#p-market`（DESIGN.md「市集与黑市」）。
 * 摊位分段：武馆（交束脩学寻常武学）、兵器铺、衣饰铺、药铺（留位）；黑市解锁后摊位条末尾多一个暗调页签，
 * 点入整页拉黑转场。黑市只卖蒙面货：三张蒙面牌，买下即揭晓；一排铜钱表示本世剩余次数，更漏倒计时到换货。
 * 不写概率、不写保底、不写剩余件数的文字（battle-loot/design.md 裁决 33–34）。
 */
import { useEffect, useState } from 'react';
import { GRADE_NAMES, gearFullName, type GearItem } from '../engine/gear';
import { formTitle } from '../engine/formNames';
import { msToNextRound, type MarketGood, type MaskedGood } from '../engine/market';
import { hasNode } from '../engine/prestige';
import { EFFECT_TAG, WUXUE } from '../engine/wuxue';
import { blackCapOf, marketGoodsOf, shopItemsOf, shopPriceOf, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

type Stall = 'wuguan' | 'arms' | 'wear' | 'herb';
const STALLS: [Stall, string][] = [['wuguan', '武馆'], ['arms', '兵器铺'], ['wear', '衣饰铺'], ['herb', '药铺']];

const Img = ({ it }: { it: GearItem }) => <img className="ink" src={`/art/gear/${it.img}.png`} alt="" />;

export function ShopPane() {
  const s = useGameStore();
  const [stall, setStall] = useState<Stall>('wuguan');
  const [black, setBlack] = useState(false);
  const [wipe, setWipe] = useState(false);
  const discount = hasNode(s.ownedRepNodes, 'qingzhuang_shanglu');

  const enterBlack = () => {
    setWipe(true);
    s.refreshBlack();
    setTimeout(() => { setBlack(true); setWipe(false); }, 420);
  };

  return (
    <div className={`market${black ? ' night' : ''}${wipe ? ' wipe' : ''}`}>
      {!black ? (
        <>
          <header className="jh-head">
            <div><h1>市集</h1></div>
            <div className="mk-silver">持有 <b className="gold">{fmtBig(s.silver)}</b> 两</div>
          </header>
          <div className="mk-head">
            <div className="jh-seg" role="group" aria-label="摊位">
              {STALLS.map(([k, name]) => (
                <button key={k} type="button" aria-pressed={stall === k} disabled={k === 'herb'} onClick={() => setStall(k)}>{name}</button>
              ))}
              {s.blackOpen && <button type="button" className="blk" onClick={enterBlack}>黑市</button>}
            </div>
          </div>
          <section className="jh-card">
            {stall === 'wuguan' ? <Wuguan discount={discount} /> : <Stalls kind={stall as 'arms' | 'wear'} />}
          </section>
        </>
      ) : <Black onBack={() => setBlack(false)} />}
    </div>
  );
}

/** 武馆：四门寻常武学全本，用行 */
function Wuguan({ discount }: { discount: boolean }) {
  const s = useGameStore();
  return (
    <>
      <div className="head">
        <span className="serif">武馆</span>
        {discount && <small data-tip="已传承「轻装上路」：市集一律八折，价格已折算">八折</small>}
      </div>
      <div className="jh-rows">
        {shopItemsOf(s).map((it) => {
          const w = WUXUE[it.wuxue!];
          const have = (s.ownedWuxue ?? []).includes(it.wuxue!);
          const price = shopPriceOf(s, it.price);
          const short = Math.ceil(price - s.silver);
          return (
            <div key={it.id} className={`jh-row${have ? ' done' : ''}`}>
              <div className="t">
                <span className="serif">{w.name}</span>
                <span className="jh-tag q1">{w.quality}</span>
                <span className={`jh-tag tag t-${EFFECT_TAG[w.effect]}`}>{EFFECT_TAG[w.effect]}</span>
                <span className="wtag">{w.cat}</span>
              </div>
              <div className="d">第一式全本 · 三式</div>
              <div className="a">
                {have ? <span className="price">已学</span> : (
                  <span className="jh-buy">
                    <button type="button" className="jh-btn2" disabled={short > 0} onClick={() => s.buyShopItem(it.id)}>{fmtBig(price)} 两</button>
                    {short > 0 && <small>还差 {fmtBig(short)}</small>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** 兵器铺 / 衣饰铺：小卡 = 道具图 + 名 + 品阶章 + 类目 + 属性 + 价格按钮 */
function Stalls({ kind }: { kind: 'arms' | 'wear' }) {
  const s = useGameStore();
  const goods = marketGoodsOf(s)[kind];
  const base = (g: MarketGood) => Object.entries(g.sample.base).map(([k, v]) => `${k} +${v}`).join(' · ');
  return (
    <>
      <div className="head"><span className="serif">{kind === 'arms' ? '兵器铺' : '衣饰铺'}</span></div>
      <div className="stall-grid">
        {goods.map((g) => {
          const price = shopPriceOf(s, g.price, 'goods');
          return (
            <div key={g.id} className="stall-it">
              <Img it={g.sample} />
              <span className={`nm g${g.grade}`}>{g.sample.name}<span className={`gtag g${g.grade}`}>{GRADE_NAMES[g.grade]}</span>{g.cat && <span className="wtag">{g.cat}</span>}</span>
              <span className="st">{base(g)}</span>
              <button type="button" className="jh-btn2" disabled={s.silver < price} onClick={() => s.buyMarketItem(g.id)}>{fmtBig(price)} 两</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** 黑市：三张蒙面牌、铜钱计次、更漏倒计时 */
function Black({ onBack }: { onBack: () => void }) {
  const s = useGameStore();
  const [left, setLeft] = useState(msToNextRound(Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = msToNextRound(Date.now());
      setLeft(ms);
      if (ms < 1500) s.refreshBlack();
    }, 1000);
    return () => clearInterval(t);
  }, [s]);
  const sec = Math.floor(left / 1000);
  const clock = [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((x) => String(x).padStart(2, '0')).join(':');
  const buys = s.blackBuys ?? 0;
  const cap = blackCapOf(s);
  const spent = buys >= cap;

  const revealed = (g: MaskedGood) => {
    if (!g.revealed) return null;
    if ('gear' in g.revealed) {
      const it = g.revealed.gear;
      return (
        <div className={`mask-it sold g${it.grade}`}>
          <Img it={it} />
          <span className={`nm g${it.grade}`}>{gearFullName(it)}</span>
          <span className="pr"><span className={`gtag g${it.grade}`}>{GRADE_NAMES[it.grade]}</span></span>
        </div>
      );
    }
    const p = g.revealed.pages;
    return (
      <div className="mask-it sold">
        <span className="mveil">谱</span>
        <span className="nm qi">{WUXUE[p.id].name} · {formTitle(p.id, p.k)}</span>
        <span className="pr">残页 ×{p.n}</span>
      </div>
    );
  };

  return (
    <>
      <header className="jh-head">
        <div><h1>黑市</h1></div>
        <div className="bk-right">
          <span className="bk-clock"><i /><b>{clock}</b></span>
          <button type="button" className="jh-btn2 quiet" onClick={onBack}>回到市集</button>
        </div>
      </header>
      <div className="masked">
        {(s.blackGoods ?? []).map((g) => g.revealed ? <div key={g.id}>{revealed(g)}</div> : (
          <button key={g.id} type="button" className={`mask-it${spent ? ' gone' : ''}`} disabled={spent || s.silver < g.price}
            onClick={() => s.buyMasked(g.id)}>
            <span className="mveil">？</span>
            <span className="nm">{g.label}</span>
            <span className="pr">{g.hint} · {fmtBig(g.price)} 两</span>
          </button>
        ))}
      </div>
      <div className="coins" aria-label="本世余额">
        {Array.from({ length: cap }, (_, i) => <i key={i} className={i < buys ? 'spent' : ''} />)}
      </div>
    </>
  );
}
