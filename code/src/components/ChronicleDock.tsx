/**
 * 江湖编年右栏（活江湖第一期批四）：原型 docs/design/living-jianghu-prototype.html「江湖编年」+ DESIGN.md「江湖编年右栏」。
 * 「江湖」页签是当世的头条简讯（最近一桩大事作头条，其下按类别筛的一行一事）；「往世」一世一行，点开看年表。
 * 修炼、战斗页常驻（可收起，记在本机）；其余页收成窄边，有新事挂计数，点开从右侧浮出。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cnNum, lifeChronicle, seasonOf, type ChronCat, type ChronLine, type LifeRec } from '../engine/chronicle';
import { currentEra, ERA_START, INIT_AGE } from '../engine/reincarnation';
import { useGameStore } from '../store/gameStore';

const CAT: Record<Exclude<ChronCat, 'me'>, string> = { zheng: '正道', xie: '邪道', court: '朝廷', jh: '江湖', big: '大事' };
const catName = (c: ChronCat, who: string) => (c === 'me' ? who : CAT[c]);
const yr = (l: ChronLine) => `${Math.floor(l.y)} 年${seasonOf(l.y) ? ` ${seasonOf(l.y)}` : ''}`;
const runCn = (run: number) => `第${cnNum(run)}世`;

function endLine(rec: LifeRec): string {
  if (!rec.end) return '';
  const { year, age, cause, place } = rec.end;
  const how = cause === 'battle' ? `殁于${place}，年${cnNum(age)}` : cause === 'old' ? `卒于${place}，年${cnNum(age)}` : `归隐${place}`;
  return `江湖历 ${rec.born} — ${year} 年 · ${how}`;
}

/** 年表：左列中文年份、一道细轴、每事一个类别色圆点 + 季节 + 正文 */
function YearBook({ lines, who }: { lines: ChronLine[]; who: string }) {
  const groups: { y: number; list: ChronLine[] }[] = [];
  for (const l of lines) {
    const y = Math.floor(l.y);
    const g = groups[groups.length - 1];
    if (g && g.y === y) g.list.push(l);
    else groups.push({ y, list: [l] });
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.y} className="yb">
          <div className="y">{cnNum(g.y)}年</div>
          <ol>
            {g.list.map((l, i) => (
              <li key={i} className={l.cat} data-tip={catName(l.cat, who)}>
                {seasonOf(l.y) && <span className="s">{seasonOf(l.y)}</span>}{l.text}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}

export function ChronicleDock({ min, open, onOpen, onClose, onFold }: {
  min: boolean; open: boolean; onOpen: () => void; onClose: () => void; onFold: () => void;
}) {
  const seed = useGameStore((s) => s.worldSeed);
  const kills = useGameStore((s) => s.rosterKills);
  const lives = useGameStore((s) => s.lives);
  const year = useGameStore((s) => Math.floor(currentEra(s.eraStart ?? ERA_START, s.age ?? INIT_AGE)));
  const [tab, setTab] = useState<'now' | 'past'>('now');
  const [chip, setChip] = useState<ChronCat | 'all'>('all');
  const [openLife, setOpenLife] = useState<number | null>(null);

  const cur = lives?.at(-1);
  const now = useMemo(
    () => (cur ? lifeChronicle(seed, kills ?? [], cur, year + 1) : []),
    [seed, kills, cur, year],
  );
  const past = useMemo(
    () => (lives ?? []).slice(0, -1).reverse().map((rec) => ({ rec, lines: lifeChronicle(seed, kills ?? [], rec, rec.end?.year ?? rec.born + 1) })),
    [seed, kills, lives],
  );

  // 窄边计数：收着的时候来了几条新事（来的是大事则朱砂）
  const seenRef = useRef(now.length);
  const [unread, setUnread] = useState({ n: 0, big: false });
  const firstText = now[0]?.text;
  useEffect(() => {
    if (!min || open) { seenRef.current = now.length; setUnread({ n: 0, big: false }); return; }
    const n = now.length - seenRef.current;
    if (n > 0) setUnread({ n, big: now.slice(0, n).some((l) => l.cat === 'big') });
    else if (n < 0) seenRef.current = now.length;   // 转世换了一世
  }, [min, open, now.length, firstText]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 浮出时点外面收起
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener('click', h));
    return () => { clearTimeout(t); document.removeEventListener('click', h); };
  }, [open, onClose]);

  if (!cur) return null;
  const who = cur.name;
  const top = now.find((l) => l.cat === 'big');
  const rest = now.filter((l) => l !== top && (chip === 'all' || l.cat === chip));
  const chips: [ChronCat | 'all', string][] = [['all', '全部'], ['me', who], ['zheng', '正道'], ['xie', '邪道'], ['court', '朝廷'], ['jh', '江湖']];

  return (
    <aside ref={ref} className="jh-dock" aria-label="江湖编年">
      <button type="button" className="edge" aria-label="展开江湖编年" onClick={onOpen}>
        <span className="vt">江湖编年</span>
        {unread.n > 0 && <span className={`n${unread.big ? ' big' : ''}`}>{unread.n}</span>}
      </button>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'now'} onClick={() => setTab('now')}>江湖</button>
        <button type="button" role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>往世</button>
        {min
          ? <button type="button" className="close" aria-label="收起" onClick={onClose}>×</button>
          : <button type="button" className="fold" aria-label="收起江湖编年" data-tip="收起" onClick={onFold}>›</button>}
      </div>
      <div className="feed" role="tabpanel">
        {tab === 'now' ? (
          <>
            {top && (
              <div className="hd">
                <div className="k">江湖大事<span>{yr(top)}</span></div>
                <div className="t">{top.text}</div>
              </div>
            )}
            <div className="chips">
              {chips.map(([k, n]) => (
                <button key={k} type="button" aria-pressed={chip === k} onClick={() => setChip(k)}>{n}</button>
              ))}
            </div>
            {rest.map((l, i) => (
              <p key={`${l.y}-${i}`} className={`brief ${l.cat}`}>
                <b>{catName(l.cat, who)}</b>{l.text}<span className="yr">{yr(l)}</span>
              </p>
            ))}
          </>
        ) : past.length === 0 ? (
          <p className="empty">尚无往世。</p>
        ) : (
          past.map(({ rec, lines }) => (
            <div key={rec.run} className="past" data-open={openLife === rec.run ? '' : undefined}>
              <button type="button" aria-expanded={openLife === rec.run} onClick={() => setOpenLife(openLife === rec.run ? null : rec.run)}>
                <span className="n">{runCn(rec.run)}</span>
                <span className="nm">{rec.hao && <span className="hao">「{rec.hao}」</span>}{rec.name}</span>
                <span className="chev" aria-hidden="true">▶</span>
                <span className="end">{endLine(rec)}</span>
              </button>
              <div className="bd"><div><YearBook lines={lines} who={rec.name} /></div></div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
