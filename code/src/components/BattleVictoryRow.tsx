import { PAGE_SOURCE_TABLE, BOOK_TABLE } from '../engine/fragments';

export function BattleVictoryRow({ pageId }: { pageId: string | null | undefined }) {
  if (!pageId) return null;

  const page = PAGE_SOURCE_TABLE.find(p => p.page_id === pageId);
  const book = BOOK_TABLE.find(b => b.book_id === page?.book_id);

  if (!page || !book) return null;

  return (
    <div className="kv" style={{ borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px' }}>
      <span className="k" style={{ color: 'var(--candle-gold)' }}>获得残页</span>
      <span className="v serif" style={{ color: 'var(--ink-warm)' }}>
        {book.name}{book.type} · 第 {page.sequence} 页
      </span>
    </div>
  );
}
