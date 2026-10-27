/**
 * 武功页（内功 + 武学合一）—— 定稿原型 docs/design/gongfa-prototype.html（issue #80）。
 * 页头 → 装配一行（主修印匣 | 武学印匣）→ 左「藏书」3 × 3 窄栏（标题旁切内功 / 武学，武学一页九本可翻）/ 右一本翻开的磁青书。
 * 书只在一处：已装的武学不在藏书里重复陈列。点印匣或书封即在右侧翻开那本；换书时先合上露出封面，再以中缝为轴翻开。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { NEIGONG, QUALITY_ORDER, type NeigongId } from '../engine/neigong';
import { CAT_GROUPS, EFFECT_TAG, QUALITY_PARAMS, WUXUE, WUXUE_IDS, type WuxueCat, type WuxueId } from '../engine/wuxue';
import { ROUTES } from '../engine/routes';
import type { RouteId } from '../engine/content';
import { slotCountOf, useGameStore } from '../store/gameStore';
import { NeigongBook } from './wugong/NeigongBook';
import { WuxueBook } from './wugong/WuxueBook';
import { Q_NO, ROUTE_TAG, catIcon, ngIcon } from './wugong/shared';

type Kind = 'neigong' | 'wuxue';
type Open = { kind: 'neigong'; id: NeigongId } | { kind: 'wuxue'; id: WuxueId };
const PER_PAGE = 9;
const CAT_ORDER = Object.values(CAT_GROUPS).flat();
const ROUTE_ORDER: RouteId[] = ['huashan', 'shaolin', 'tangmen'];
/** 书封上的类目印：暗器盖「镖」 */
const SEAL: Partial<Record<WuxueCat, string>> = { 暗器: '镖' };

export function WugongPane({ focus }: { focus?: Kind }) {
  const s = useGameStore();
  const ngId = s.neigong!;
  const equipped = s.equipped ?? [];
  const owned = s.ownedWuxue ?? [];
  const pages = s.pages ?? [];
  const pagesOf = (id: WuxueId) => pages.filter((k) => k.startsWith(`${id}:`)).length;
  // 书架上陈列：已拥有的，加上虽未拥有但已得它别的式残页的（压暗）；已装的在装配行，不重复陈列
  const ghost = (id: WuxueId) => !owned.includes(id) && pagesOf(id) > 0;
  const wxAll = WUXUE_IDS.filter((id) => owned.includes(id) || ghost(id));
  const byQuality = <T extends string>(q: (id: T) => string) => (a: T, b: T) => QUALITY_ORDER.indexOf(q(b) as never) - QUALITY_ORDER.indexOf(q(a) as never);
  const wxShelf = wxAll.filter((id) => !equipped.includes(id)).sort(byQuality((id: WuxueId) => WUXUE[id].quality));
  const ngShelf = [...(s.ownedNeigong ?? [])].sort(byQuality((id: NeigongId) => NEIGONG[id].quality));

  const [kind, setKind] = useState<Kind>(focus ?? 'neigong');
  const [open, setOpen] = useState<Open>(focus === 'wuxue' && wxAll.length ? { kind: 'wuxue', id: equipped[0] ?? wxAll[0] } : { kind: 'neigong', id: ngId });
  const [route, setRoute] = useState<RouteId | 'all'>('all');
  const [cat, setCat] = useState<'全部' | WuxueCat>('全部');
  const [page, setPage] = useState(0);
  // 转修后主修换了、或那本已不在架上：退回主修
  const shown: Open = open.kind === 'neigong' ? (ngShelf.includes(open.id) ? open : { kind: 'neigong', id: ngId })
    : wxAll.includes(open.id) ? open : { kind: 'neigong', id: ngId };
  const pick = (o: Open, toShelf = false) => { setOpen(o); if (toShelf) setKind(o.kind); };

  const slots = slotCountOf(s);
  const ngD = NEIGONG[ngId];
  const catCount = (c: '全部' | WuxueCat) => wxShelf.filter((id) => c === '全部' || WUXUE[id].cat === c).length;
  const curCat = cat !== '全部' && !catCount(cat) ? '全部' : cat;
  const wxShown = wxShelf.filter((id) => curCat === '全部' || WUXUE[id].cat === curCat);
  const pageCount = Math.max(1, Math.ceil(wxShown.length / PER_PAGE));
  const curPage = Math.min(page, pageCount - 1);
  const ngShown = ngShelf.filter((id) => route === 'all' || NEIGONG[id].route === route);
  const routes = ROUTE_ORDER.filter((r) => ngShelf.some((id) => NEIGONG[id].route === r));

  return (
    <div className="wg">
      <header className="jh-head"><div><h1>武功</h1></div></header>

      <h2 className="jh-sec">装配</h2>
      <div className="wg-carry">
        <button className={`ya ng qg${Q_NO[ngD.quality]} rf t-${ROUTE_TAG[ngD.route]}`} aria-current={shown.kind === 'neigong' && shown.id === ngId}
          onClick={() => pick({ kind: 'neigong', id: ngId }, true)}>
          <span className="box"><i className="wg-ico" style={ngIcon(ngId)} /></span>
          <span className="nm">{ngD.name}</span>
          <span className="mt">第 {s.zhong} 重</span>
        </button>
        <i className="sep" aria-hidden="true" />
        {Array.from({ length: slots }, (_, i) => {
          const id = equipped[i];
          if (!id) return <span key={i} className="ya empty"><span className="box" /></span>;
          const d = WUXUE[id];
          const tag = EFFECT_TAG[d.effect];
          return (
            <button key={id} className={`ya qg${Q_NO[d.quality]} rf t-${tag}`} aria-current={shown.kind === 'wuxue' && shown.id === id}
              data-tip={`${d.quality} · ${tag} · ${d.cat} · 触发 ${Math.round(d.p * 100)}% · 冷却 ${d.cd}`} onClick={() => pick({ kind: 'wuxue', id }, true)}>
              <span className="box"><i className="wg-ico" style={catIcon(d.cat)} /></span>
              <span className="nm">{d.name}</span>
              <span className="mt">触发 {Math.round(d.p * 100)}%</span>
            </button>
          );
        })}
      </div>

      <div className="wg-study">
        <div className="wg-left">
          <div className="wg-sechead">
            <h2 className="jh-sec">藏书</h2>
            <div className="jh-seg kind" role="group" aria-label="内功 / 武学">
              <button aria-pressed={kind === 'neigong'} onClick={() => setKind('neigong')}>内功</button>
              <button aria-pressed={kind === 'wuxue'} onClick={() => setKind('wuxue')}>武学</button>
            </div>
          </div>

          {kind === 'neigong' ? (
            <>
              <div className="wg-segrow">
                <div className="jh-seg" role="group" aria-label="按源流筛选">
                  <button aria-pressed={route === 'all'} onClick={() => setRoute('all')}>全部<small>{ngShelf.length}</small></button>
                  {routes.map((r) => (
                    <button key={r} aria-pressed={route === r} onClick={() => setRoute(r)}>
                      {ROUTES[r].name}<small>{ngShelf.filter((id) => NEIGONG[id].route === r).length}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="wg-shelf">
                {ngShown.map((id) => {
                  const d = NEIGONG[id];
                  return (
                    <button key={id} className={`wg-book cover ng q${Q_NO[d.quality]}`} aria-current={shown.kind === 'neigong' && shown.id === id}
                      onClick={() => pick({ kind: 'neigong', id })}>
                      <i className="cv" />
                      {id === ngId && <span className="on">主修</span>}
                      <span className="slip">{d.name}</span>
                      <small>{d.quality} · <span className={`rt t-${ROUTE_TAG[d.route]}`}>{ROUTES[d.route].name}</span></small>
                    </button>
                  );
                })}
              </div>
              <div className="wg-pager" />
            </>
          ) : wxAll.length === 0 ? (
            <div className="wg-empty">
              <p>尚无武学。书肆有寻常秘籍可买；对手身上也能搜出整式与残页。</p>
              <button className="jh-btn2" onClick={() => useGameStore.setState({ pendingTab: 'shop' })}>去书肆</button>
            </div>
          ) : (
            <>
              <div className="wg-segrow">
                <div className="jh-seg icons" role="group" aria-label="按类目筛选">
                  <button aria-pressed={curCat === '全部'} onClick={() => { setCat('全部'); setPage(0); }}>全部<small>{wxShelf.length}</small></button>
                  {CAT_ORDER.filter((c) => catCount(c) > 0).map((c) => (
                    <button key={c} aria-pressed={curCat === c} aria-label={c} data-tip={`${c} · ${catCount(c)} 本`} onClick={() => { setCat(c); setPage(0); }}>
                      <i className="wg-ico" style={catIcon(c)} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="wg-shelf">
                {wxShown.slice(curPage * PER_PAGE, curPage * PER_PAGE + PER_PAGE).map((id) => {
                  const d = WUXUE[id];
                  const isGhost = ghost(id);
                  const tag = EFFECT_TAG[d.effect];
                  return (
                    <button key={id} className={`wg-book cover wx q${Q_NO[d.quality]}${isGhost ? ' ghost' : ''}`} aria-current={shown.kind === 'wuxue' && shown.id === id}
                      onClick={() => pick({ kind: 'wuxue', id })}>
                      <i className="cv" />
                      <span className="slip">{d.name}</span>
                      <span className="seal">{SEAL[d.cat] ?? d.cat}</span>
                      <small>{isGhost ? `残页 ${pagesOf(id)} / ${QUALITY_PARAMS[d.quality].forms}` : <>{d.quality} · <span className={`rt t-${tag}`}>{tag}</span></>}</small>
                    </button>
                  );
                })}
              </div>
              <div className="wg-pager">
                {pageCount > 1 && (
                  <>
                    <button aria-label="上一页" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹</button>
                    <span><b>{curPage + 1}</b> / {pageCount}</span>
                    <button aria-label="下一页" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>›</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="wg-right">
          <FlipBook bookKey={`${shown.kind}:${shown.id}`} cover={<Cover o={shown} />}>
            {shown.kind === 'neigong' ? <NeigongBook id={shown.id} /> : <WuxueBook id={shown.id} />}
          </FlipBook>
        </div>
      </div>
    </div>
  );
}

/** 合上时的封面：同藏书书封，题签写书名；武学另压类目印 */
function Cover({ o }: { o: Open }) {
  if (o.kind === 'neigong') {
    const d = NEIGONG[o.id];
    return <div className={`face front cover ng q${Q_NO[d.quality]}`}><i className="cv" /><span className="slip">{d.name}</span></div>;
  }
  const d = WUXUE[o.id];
  return (
    <div className={`face front cover wx q${Q_NO[d.quality]}`}>
      <i className="cv" /><span className="slip">{d.name}</span><span className="seal">{SEAL[d.cat] ?? d.cat}</span>
    </div>
  );
}

/**
 * 翻开的书：换书（bookKey 变）时先合上露出封面 0.32 秒，再以中缝为轴翻开约 1 秒，左页内容等封面落定再淡入。
 * 首次进页、减少动态效果时不翻。
 */
function FlipBook({ bookKey, cover, children }: { bookKey: string; cover: ReactNode; children: ReactNode }) {
  const last = useRef(bookKey);
  const [phase, setPhase] = useState<'idle' | 'closed' | 'opening'>('idle');
  const [face, setFace] = useState<ReactNode>(null);
  useLayoutEffect(() => {
    if (last.current === bookKey) return;
    last.current = bookKey;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setFace(cover);
    setPhase('closed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);
  useEffect(() => {
    if (phase === 'idle') return;
    const t = setTimeout(() => setPhase(phase === 'closed' ? 'opening' : 'idle'), phase === 'closed' ? 320 : 1000);
    return () => clearTimeout(t);
  }, [phase]);
  return (
    <>
      <div className={`wg-open${phase !== 'idle' ? ' closed' : ''}${phase === 'opening' ? ' opening' : ''}`}>{children}</div>
      {phase !== 'idle' && (
        <div className="wg-flip" aria-hidden="true">
          <div className={`wg-flipper${phase === 'opening' ? ' go' : ''}`}>{face}<div className="face back" /></div>
        </div>
      )}
    </>
  );
}
