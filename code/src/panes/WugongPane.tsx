/**
 * 武功页（内功 + 武学合一）—— 基准 docs/design/bag-wugong-prototype.html + DESIGN.md「武功页」：崖边舞剑一整幅 AI 画上叠字。
 * 左缘一列类别圈（九类武学 + 内功，无藏书的置灰）→ 旁边宣纸目录竖写这一类各门（选中金字、已装短金线、未得淡灰，一页八门）；
 * 右侧题跋：大字竖写名 + 品质朱印 + 两列批注，下接详情（武学：招式 / 属性；内功：重数 / 心法 / 属性）；
 * 下沿一排装配圈（首枚金圈为主修内功，其余按品质描边、圈下写名），点圈跳到那一门。
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { NEIGONG, QUALITY_ORDER, type NeigongId, type Quality } from '../engine/neigong';
import { CAT_GROUPS, WUXUE, WUXUE_IDS, type WuxueCat, type WuxueId } from '../engine/wuxue';
import { picLayout, type PicLayout } from '../components/qianchenSceneModel';
import { slotCountOf, useGameStore } from '../store/gameStore';
import { NeigongBook } from './wugong/NeigongBook';
import { WuxueBook } from './wugong/WuxueBook';
import { wgIcon } from './wugong/shared';

type Cat = WuxueCat | '内功';
type Open = { kind: 'neigong'; id: NeigongId } | { kind: 'wuxue'; id: WuxueId };
const CATS: Cat[] = [...Object.values(CAT_GROUPS).flat(), '内功'];
/** 类别圈在画上的纵向位置（画幅 %） */
const CAT_Y = [11.5, 18.9, 26.3, 33.7, 41.1, 48.5, 55.9, 63.3, 70.7, 78.1];
const PER = 8;
const QN: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
const NG_VERSE = '散功重修，根骨不失';

export function WugongPane({ focus }: { focus?: 'neigong' | 'wuxue' }) {
  const s = useGameStore();
  const ngId = s.neigong!;
  const equipped = s.equipped ?? [];
  const owned = s.ownedWuxue ?? [];
  const pages = s.pages ?? [];
  // 目录里陈列：已拥有的，加上虽未拥有但已得它别的式残页的（淡灰）
  const ghost = (id: WuxueId) => !owned.includes(id) && pages.some((k) => k.startsWith(`${id}:`));
  const byQuality = <T extends string>(q: (id: T) => Quality) => (a: T, b: T) => QUALITY_ORDER.indexOf(q(b)) - QUALITY_ORDER.indexOf(q(a));
  const wxAll = WUXUE_IDS.filter((id) => owned.includes(id) || ghost(id)).sort(byQuality((id: WuxueId) => WUXUE[id].quality));
  const ngShelf = [...(s.ownedNeigong ?? [])].sort(byQuality((id: NeigongId) => NEIGONG[id].quality));
  const itemsOf = (c: Cat): Open[] => c === '内功' ? ngShelf.map((id) => ({ kind: 'neigong', id }))
    : wxAll.filter((id) => WUXUE[id].cat === c).map((id) => ({ kind: 'wuxue', id }));

  const firstWx = equipped[0] ?? wxAll[0];
  const [open, setOpen] = useState<Open>(focus === 'wuxue' && firstWx ? { kind: 'wuxue', id: firstWx } : { kind: 'neigong', id: ngId });
  // 转修后主修换了、或那本已不在：退回主修
  const shown: Open = open.kind === 'neigong' ? (ngShelf.includes(open.id) ? open : { kind: 'neigong', id: ngId })
    : wxAll.includes(open.id) ? open : { kind: 'neigong', id: ngId };
  const catOf = (o: Open): Cat => o.kind === 'neigong' ? '内功' : WUXUE[o.id].cat;
  const [cat, setCat] = useState<Cat>(catOf(shown));
  const items = itemsOf(cat);
  const pageCount = Math.max(1, Math.ceil(items.length / PER));
  const [page, setPage] = useState(0);
  const curPage = Math.min(page, pageCount - 1);
  const pickOpen = (o: Open) => {
    const c = catOf(o);
    setOpen(o); setCat(c);
    setPage(Math.max(0, Math.floor(itemsOf(c).findIndex((x) => x.id === o.id) / PER)));
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<PicLayout | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('wgs-own-art');
    return () => document.documentElement.classList.remove('wgs-own-art');
  }, []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setL(picLayout(el.clientWidth, el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slots = slotCountOf(s);
  const main = NEIGONG[ngId];
  const d = shown.kind === 'neigong' ? NEIGONG[shown.id] : WUXUE[shown.id];
  const pw = L?.pw ?? 1200, ph = (pw * 9) / 16;
  const longTitle = shown.kind === 'neigong' || (WUXUE[shown.id as WuxueId]?.quality !== '寻常');
  const tf = Math.min(pw * 0.06, (ph * (longTitle ? 0.25 : 0.32)) / d.name.length);
  const verse = (shown.kind === 'wuxue' ? WUXUE[shown.id].epigraph : NG_VERSE).split(/[，,]/).filter(Boolean);

  const vars = L ? { '--pw': `${L.pw}px`, '--pl': `${L.pl}px`, '--pt': `${L.pt}px` } as CSSProperties : undefined;
  return (
    <div className={`wgs${L ? '' : ' unready'}`} ref={stageRef} style={vars}>
      <div className="wpic">
        <div className="bg" style={{ backgroundImage: "url('/art/wugong/bg-tall.jpg')" }} />
        <div className="wrule" />
        {CATS.map((c, i) => {
          const n = itemsOf(c).length;
          return (
            <button key={c} type="button" className={`wcat${cat === c ? ' on' : ''}`} style={{ left: '3.6%', top: `${CAT_Y[i]}%` }}
              disabled={!n} aria-label={c} aria-pressed={cat === c} data-tip={`${c} · ${n ? `${n}${c === '内功' ? ' 部' : ' 门'}` : '尚无'}`}
              onClick={() => { setCat(c); setPage(0); const first = itemsOf(c)[0]; if (first) setOpen(first); }}>
              <img src={wgIcon(c)} alt="" />
            </button>
          );
        })}
        <div className="toc" role="list">
          {items.slice(curPage * PER, curPage * PER + PER).map((o, ci) => {
            const q = o.kind === 'neigong' ? NEIGONG[o.id].quality : WUXUE[o.id].quality;
            const isEq = o.kind === 'neigong' ? o.id === ngId : equipped.includes(o.id);
            const isGhost = o.kind === 'wuxue' && ghost(o.id);
            const name = o.kind === 'neigong' ? NEIGONG[o.id].name : WUXUE[o.id].name;
            return (
              <button key={o.id} type="button" role="listitem"
                className={`q${QN[q]}${shown.id === o.id ? ' on' : ''}${isGhost ? ' ghost' : ''}${isEq ? ' equipped' : ''}`}
                style={{ left: `${8.5 + ci * 10.3}%` }} aria-current={shown.id === o.id}
                data-tip={`${q}${isEq ? (o.kind === 'neigong' ? ' · 主修' : ' · 已装配') : isGhost ? ' · 未得整本' : ''}`}
                onClick={() => setOpen(o)}>
                <span>{name}</span>
              </button>
            );
          })}
        </div>
        {pageCount > 1 && (
          <div className="tocpg">
            <button type="button" aria-label="上一页" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹</button>
            <span>{curPage + 1} / {pageCount}</span>
            <button type="button" aria-label="下一页" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>›</button>
          </div>
        )}

        <div className={`ttl q${QN[d.quality]}`} style={{ '--tf': `${tf}px` } as CSSProperties}>{d.name}</div>
        <div className="tseal" style={{ left: `calc(82.5% + ${tf * 0.55}px)`, top: `calc(6% + ${tf * d.name.length - pw * 0.02}px)` }}>{d.quality.slice(0, 2)}</div>
        <div className="verse">{verse.map((t) => <span key={t}>{t}</span>)}</div>
        {shown.kind === 'neigong' ? <NeigongBook id={shown.id} /> : <WuxueBook id={shown.id} pw={pw} />}

        <div className="eqrow">
          <button type="button" className={`eq main${shown.kind === 'neigong' && shown.id === ngId ? ' sel' : ''}`}
            data-tip={`主修 · ${main.name} · 第 ${s.zhong} 重`} onClick={() => pickOpen({ kind: 'neigong', id: ngId })}>
            <img src={wgIcon('内功')} alt="" /><span className="nm">{main.name}</span>
          </button>
          {Array.from({ length: slots }, (_, i) => {
            const id = equipped[i];
            if (!id) return <span key={`e${i}`} className="eq empty" data-tip="空位" />;
            const w = WUXUE[id];
            return (
              <button key={id} type="button" className={`eq q${QN[w.quality]}${shown.id === id ? ' sel' : ''}`}
                data-tip={`${w.name} · ${w.quality} · 触发 ${Math.round(w.p * 100)}%`} onClick={() => pickOpen({ kind: 'wuxue', id })}>
                <img src={wgIcon(w.cat)} alt="" /><span className="nm">{w.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="vig" />
      <header className="whead"><div><h1>武功</h1></div></header>
    </div>
  );
}
