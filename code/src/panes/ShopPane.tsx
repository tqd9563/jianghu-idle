/**
 * 书肆页 —— 定稿原型 docs/design/ui-overhaul-prototype.html「书肆」`#p-market`（从武学页独立出来）。
 * 银两买秘籍：寻常武学、上乘武学的招式秘籍、上乘内功。数值出自 docs/systems/sect-neigong/spec.md §4。
 */
import { NEIGONG, TIERS, TIER_COUNT } from '../engine/neigong';
import { hasNode } from '../engine/prestige';
import { WUXUE, formKey, formName, type ShopItem } from '../engine/wuxue';
import { shopItemsOf, shopPriceOf, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

const LU_NAME = { huashan: '惊雷', shaolin: '镇岳', tangmen: '蚀骨' } as const;

/** 一行的标题、品质标签与说明 */
function itemText(it: ShopItem): { title: string; tag: { cls: string; text: string } | null; desc: string } {
  if (it.kind === 'wuxue') {
    const w = WUXUE[it.wuxue!];
    return { title: it.label, tag: { cls: 'q1', text: w.quality }, desc: `${w.category} · 特效${w.effect}` };
  }
  if (it.kind === 'scroll') {
    return { title: `招式秘籍 · ${WUXUE[it.wuxue!].name}${formName(it.form!)}`, tag: null, desc: `领悟${formName(it.form!)}所需` };
  }
  const ng = NEIGONG[it.id.slice('neigong:'.length) as keyof typeof NEIGONG];
  return {
    title: it.label, tag: { cls: 'q2', text: `${ng.quality}内功` },
    desc: `${LU_NAME[ng.route]}一路 · 最高可至${TIERS[TIER_COUNT[ng.quality] - 1].name}`,
  };
}

export function ShopPane() {
  const s = useGameStore();
  const discount = hasNode(s.ownedRepNodes, 'qingzhuang_shanglu');
  return (
    <>
      <header className="jh-head">
        <div><h1>书肆</h1><div className="sub">银两每世清零，买下的秘籍永久保留</div></div>
      </header>
      <section className="jh-card">
        <div className="head">
          <span className="serif">秘籍</span>
          <small data-tip={discount ? '已传承「轻装上路」：书肆的秘籍一律八折，价格已折算' : undefined}>
            持有 <b className="gold">{fmtBig(s.silver)}</b> 两
          </small>
        </div>
        <div className="jh-rows">
          {shopItemsOf(s).map((it) => {
            const have = it.kind === 'wuxue' ? (s.ownedWuxue ?? []).includes(it.wuxue!)
              : it.kind === 'scroll' ? (s.ownedScrolls ?? []).includes(formKey(it.wuxue!, it.form!)) : false;
            const locked = s.realm < it.realm;
            const price = shopPriceOf(s, it.price);
            const short = Math.ceil(price - s.silver);
            const { title, tag, desc } = itemText(it);
            return (
              <div key={it.id} className={`jh-row${have ? ' done' : locked ? ' lock' : ''}`}>
                <div className="t">
                  <span className="serif">{title}</span>
                  {tag && <span className={`jh-tag ${tag.cls}`}>{tag.text}</span>}
                </div>
                <div className="d">{desc}</div>
                <div className="a">
                  {have ? <span className="price">已有</span>
                    : locked ? <span className="price">境界 {it.realm} 上架</span>
                      : (
                        <span className="jh-buy">
                          <button type="button" className="jh-btn2" disabled={short > 0} onClick={() => s.buyShopItem(it.id)}>
                            {fmtBig(price)} 两
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
