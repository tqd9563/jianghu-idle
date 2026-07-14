import { useGameStore } from '../store/gameStore';
import { BOOK_TABLE, TRIAL_TABLE } from '../engine/fragments';
import { TrialEntry } from '../components/TrialEntry';
import { ROUTES } from '../engine/routes';

export function FragmentShelf() {
  const s = useGameStore();
  const collectedPages = s.collectedPages ?? [];
  const completedBooks = s.completedBooks ?? [];
  const missingPages = s.getMissingPages();

  const totalPages = 18;
  const collectedCount = collectedPages.length;

  const currentRouteName = s.route ? ROUTES[s.route].name : '未定';

  return (
    <div className="pane-wrap">
      <div className="pane-grid">
        {/* 左栏：收集总览 */}
        <div>
          <section className="panel">
            <div className="panel-head">
              残卷总进度{' '}
              <span className="sub" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--candle-gold)' }}>
                {collectedCount} / {totalPages}
              </span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {BOOK_TABLE.map((book) => {
                const isCompleted = completedBooks.includes(book.book_id);
                const isZhenchuan = book.type === '真传';
                const bookCollectedPages = book.pages.filter(p => collectedPages.includes(p));
                const count = bookCollectedPages.length;
                
                // Get next source if missing
                const missingPage = book.pages.find(p => !collectedPages.includes(p));
                const missingPageInfo = missingPage ? missingPages.find(m => m.pageId === missingPage) : null;

                // effect preview
                let effectPreview = '';
                if (book.book_id === 'legacy_intro') effectPreview = '全属性永久 +5%';
                if (book.book_id === 'legacy_advanced') effectPreview = '全属性永久 +7%';
                if (book.book_id === 'legacy_finale') effectPreview = '全属性永久 +8%';
                if (book.book_id === 'true_jinglei') effectPreview = '所需剑意 -1';
                if (book.book_id === 'true_zhenyue') effectPreview = '反伤比例 +15%';
                if (book.book_id === 'true_shigu') effectPreview = '每次命中叠毒 +1 层';

                return (
                  <div key={book.book_id} className="book-card" style={{
                    border: `1px solid var(--${isZhenchuan ? 'candle-gold' : 'line'})`, 
                    borderRadius: '6px', 
                    padding: '12px', 
                    background: 'var(--night-surface-raised)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {isZhenchuan && (
                      <div style={{
                        position: 'absolute', top: 0, right: 0, padding: '2px 8px', fontSize: '10px',
                        background: 'var(--candle-gold)', color: 'var(--candle-ink)', fontWeight: 'bold',
                        borderBottomLeftRadius: '6px', letterSpacing: '0.05em'
                      }}>真传</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span className="serif" style={{ fontSize: '15px', fontWeight: 600, color: isZhenchuan ? 'var(--candle-gold)' : 'var(--ink-warm)' }}>
                        {book.name}{book.type}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--ink-muted)', marginRight: isZhenchuan ? '30px' : '0', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--candle-gold)' }}>{count}</span>/3 页
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', paddingRight: isZhenchuan ? '30px' : '0' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          height: '4px', flex: 1, borderRadius: '2px',
                          background: i < count ? 'var(--candle-gold)' : 'var(--line-strong)'
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                      效果预览：{effectPreview}<br/>
                      {isCompleted ? (
                        isZhenchuan ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>○ 未启用 (真传仅可启用一本)</span>
                            <button className="btn ghost" style={{ padding: '2px 10px', fontSize: '11.5px', minHeight: 'auto', width: 'auto', marginTop: 0 }} disabled>启用</button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--candle-gold)', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>● 生效中</span>
                        )
                      ) : (
                        <>
                          <span style={{ color: 'var(--ink-faint)', marginTop: '4px', display: 'inline-block' }}>○ 未集齐不生效</span><br/>
                          {missingPageInfo && (
                            <span style={{ color: 'var(--sword-cyan)', marginTop: '4px', display: 'inline-block' }}>
                              下一页来源：{missingPageInfo.nextSource}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* 右栏：试炼与行迹 */}
        <div>
          <section className="panel" style={{ borderColor: 'var(--candle-gold)' }}>
            <div className="panel-head" style={{ color: 'var(--candle-gold)' }}>
              真传试炼 <span className="sub" style={{ color: 'inherit', opacity: 0.8 }}>挑战隐士，夺取秘卷</span>
            </div>
            <div className="panel-body">
              <p style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: 1.6, margin: '0 0 12px' }}>
                天下真传皆在世外隐士手中。每位隐士怀揣一部绝世真传，其功法卓绝，非等闲之辈可敌。<br/><br/>
                集齐散落残页后，方能探听隐士行踪。战而胜之，方可夺其真传。
              </p>
              {TRIAL_TABLE.map(trial => (
                <TrialEntry key={trial.trial_id} trial={trial} />
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginTop: '24px' }}>
            <div className="panel-head">江湖行迹 <span className="sub">{currentRouteName}</span></div>
            <div className="panel-body">
              <div className="kv"><span className="k">累计游玩</span><span className="v">{s.run} 轮</span></div>
              <div className="kv"><span className="k">真传收集</span><span className="v">{completedBooks.filter(id => BOOK_TABLE.find(b => b.book_id === id)?.type === '真传').length} / 3 本</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
