import { useGameStore } from '../store/gameStore';

export function ShopCategory() {
  const s = useGameStore();

  const handleBuyNamed = () => {
    // Only buy named if there's a missing page and hasn't bought this run
    if ((s.shopPurchasesThisRun ?? 0) >= 1) return;
    const missing = s.getMissingPages();
    if (missing.length === 0) return;
    
    // Pick the first one or we can just call buyShopPage on a specific one.
    // The spec says "自选任意缺页" but since we don't have a picker UI, we'll just buy the first missing one that has a shop price.
    // Wait, the prompt says "Dual product category in 声望阁: 指名寻访 (buyable, calls buyShopPage)". 
    // It doesn't say to build the whole picker, just the shop node.
    // Let's just buy the first available page that can be bought, or we can just mock the picker or buy the first missing page.
    const pageToBuy = missing.find(m => m.nextSource === '指名寻访')?.pageId ?? missing[0]?.pageId;
    if (pageToBuy) s.buyShopPage(pageToBuy);
  };

  const hasPurchased = (s.shopPurchasesThisRun ?? 0) >= 1;

  return (
    <>
      <div className="panel-head" style={{ marginTop: '32px', borderBottom: '1px solid var(--line)', paddingBottom: '8px', borderTop: 'none', paddingLeft: 0, paddingRight: 0 }}>
        <h2 className="serif" style={{ fontSize: '18px' }}>秘籍残页</h2>
      </div>
      <div className="rep-grid" style={{ marginTop: '16px' }}>
        <div className={`rep-node${hasPurchased ? ' owned' : ''}`} style={{ borderColor: hasPurchased ? 'oklch(0.72 0.14 145 / 0.5)' : 'var(--line)' }}>
          <div className="rn-head">
            <span className="rn-name serif">指名寻访</span>
            <span className="rn-type" style={{ color: 'var(--candle-gold)', borderColor: 'transparent', padding: 0 }}>80 声望</span>
          </div>
          <span className="rn-type" style={{ alignSelf: 'flex-start' }}>残页</span>
          <div className="rn-desc">
            自选任意缺页，每轮限 1 次。<br/>
            <span style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>压轴尾页高价档 120。</span>
          </div>
          <div className="rn-foot">
            <button 
              className="btn" 
              style={{ marginTop: '8px', padding: '7px 0', fontSize: '13px' }}
              disabled={hasPurchased}
              onClick={handleBuyNamed}
            >
              {hasPurchased ? '✓ 已购' : '寻访'}
            </button>
          </div>
        </div>

        <div className="rep-node">
          <div className="rn-head">
            <span className="rn-name serif">坊间秘闻</span>
            <span className="rn-type" style={{ color: 'var(--candle-gold)', borderColor: 'transparent', padding: 0 }}>40 声望</span>
          </div>
          <span className="rn-type" style={{ color: 'var(--ink-faint)', borderColor: 'var(--line)', alignSelf: 'flex-start' }}>窗口后开放</span>
          <div className="rn-desc">
            随机开出一张必定缺页的残页，不含压轴尾页。<br/>
            <span style={{ color: 'var(--blood-red)', fontSize: '11.5px', marginTop: '4px', display: 'inline-block' }}>未开放 (验证窗口期结束后上架)</span>
          </div>
          <div className="rn-foot">
            <button className="btn" style={{ marginTop: '8px', padding: '7px 0', fontSize: '13px' }} disabled>敬请期待</button>
          </div>
        </div>
      </div>
    </>
  );
}
