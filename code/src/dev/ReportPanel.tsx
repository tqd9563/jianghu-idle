/**
 * 提报面板（仅 dev 构建）：⌥R 或侧栏「报」进入框选 → 右侧填写卷 → 入池回执。
 * 原型：docs/design/report-panel-prototype.html。截图由 vite-report.ts 用 screencapture 截窗口，
 * 红框在截图时仍留在页面上，所以直接烙进图里。
 */
import { useEffect, useRef, useState } from 'react';
import { SAVE_KEY } from '../save/storage';
import { recentErrors } from './reportLog';
import '../styles/report.css';

type Phase = 'idle' | 'cap' | 'sheet' | 'toast';
interface El { tag: string; text: string; sel: string }
interface Rect { x: number; y: number; w: number; h: number }
interface Mark { rect: Rect; els: El[] }

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';
const TAB_NAME: Record<string, string> = { cultivate: '修炼', battle: '战斗', bag: '行囊', neigong: '内功', wuxue: '武学', sect: '门派', shop: '市集', rep: '声望阁' };

/* 混合元素（文本 + 子元素）只量自己的文字，不量整格：否则横跨整行的名字格会误命中 */
function textRect(el: Element): DOMRect | { left: number; top: number; right: number; bottom: number; width: number } {
  if (!el.children.length) return el.getBoundingClientRect();
  const r = document.createRange();
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  el.childNodes.forEach((n) => {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) return;
    r.selectNodeContents(n);
    const b = r.getBoundingClientRect();
    x1 = Math.min(x1, b.left); y1 = Math.min(y1, b.top); x2 = Math.max(x2, b.right); y2 = Math.max(y2, b.bottom);
  });
  return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1 };
}

function selOf(el: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && !n.classList.contains('jh-app') && parts.length < 3; n = n.parentElement) {
    let s = n.tagName.toLowerCase();
    const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/)[0] : '';
    if (cls) s += '.' + cls;
    const sib = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n!.tagName) : [];
    if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(n) + 1})`;
    parts.unshift(s);
  }
  return parts.join(' > ');
}

/* 命中规则：只取带可见文字的叶子（或自带文字的混合元素），与框相交即命中 */
function hitEls(r: Rect): { el: Element; info: El }[] {
  const out: { el: Element; info: El }[] = [];
  document.querySelectorAll('.jh-app *').forEach((el) => {
    if (el.closest('.jh-report')) return;
    if (el.children.length && !Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) return;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const b = textRect(el);
    if (b.width === 0 || b.right < r.x || b.left > r.x + r.w || b.bottom < r.y || b.top > r.y + r.h) return;
    out.push({ el, info: { tag: el.tagName.toLowerCase(), text: text.slice(0, 24), sel: selOf(el) } });
  });
  return out.slice(0, 8);
}

/* 截图区域：所有红框的并集向外扩一圈（保留上下文），不出窗口 */
const SHOT_PAD = 120;
function shotRegion(ms: Mark[]): Rect {
  const x1 = Math.max(0, Math.min(...ms.map((m) => m.rect.x)) - SHOT_PAD);
  const y1 = Math.max(0, Math.min(...ms.map((m) => m.rect.y)) - SHOT_PAD);
  const x2 = Math.min(window.innerWidth, Math.max(...ms.map((m) => m.rect.x + m.rect.w)) + SHOT_PAD);
  const y2 = Math.min(window.innerHeight, Math.max(...ms.map((m) => m.rect.y + m.rect.h)) + SHOT_PAD);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const norm = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
const css = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h });

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__report${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? res.statusText);
  return j;
}

export default function ReportPanel({ tab }: { tab: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [marks, setMarks] = useState<Mark[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);   // ref：连发的指针事件之间不等重渲染
  const [box, setBox] = useState<Rect | null>(null);
  const [hits, setHits] = useState<Rect[]>([]);
  const [shooting, setShooting] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [shotVer, setShotVer] = useState(0);
  const [pasted, setPasted] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'bug' | 'polish'>('bug');
  const [judge, setJudge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issue, setIssue] = useState<{ number: number; url: string; title: string } | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const tabName = TAB_NAME[tab] ?? tab;

  const reset = () => { setMarks([]); setBox(null); setHits([]); setId(null); setPasted(null); setTitle(''); setTitleTouched(false); setDesc(''); setType('bug'); setJudge(false); setErr(null); };

  // 入口：⌥R / 侧栏「报」（自定义事件）
  useEffect(() => {
    const open = () => setPhase((p) => (p === 'idle' || p === 'toast' ? 'cap' : p));
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyR') { e.preventDefault(); open(); }
      if (e.key === 'Escape') setPhase((p) => (p === 'cap' ? (marks.length ? 'sheet' : 'idle') : p === 'sheet' ? 'idle' : p));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('jh:report', open);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('jh:report', open); };
  }, [marks.length]);

  // 标题自动拼：页签 · 首个框中元素：描述第一句；用户改过就不再跟
  useEffect(() => {
    if (titleTouched) return;
    const first = marks.flatMap((m) => m.els)[0];
    const sentence = (desc.split(/[。！？\n]/)[0] || '').trim().slice(0, 30);
    setTitle([tabName, first?.text].filter(Boolean).join(' · ') + (sentence ? '：' + sentence : ''));
  }, [marks, desc, tabName, titleTouched]);

  // 粘贴：换掉截图
  useEffect(() => {
    if (phase !== 'sheet') return;
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => setPasted(String(rd.result));
      rd.readAsDataURL(f);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [phase]);

  useEffect(() => { if (phase === 'sheet') setTimeout(() => descRef.current?.focus(), 50); }, [phase]);

  /* 框选 */
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY }; setBox({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 合成事件无 pointerId */ }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const r = norm(drag.current.x, drag.current.y, e.clientX, e.clientY);
    setBox(r);
    setHits(hitEls(r).map(({ el }) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }));
  };
  const onUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const r = norm(drag.current.x, drag.current.y, e.clientX, e.clientY);
    drag.current = null; setHits([]);
    if (r.w < 6 || r.h < 6) { setBox(null); return; }
    const next = [...marks, { rect: r, els: hitEls(r).map((h) => h.info) }];
    setMarks(next); setBox(null);
    // 截图：先把压暗与提示去掉，只留红框，再让服务端截框选区域（外扩一圈）
    setShooting(true);
    await new Promise((res) => setTimeout(res, 160));
    try {
      const rg = shotRegion(next);
      const area = { id: id ?? undefined, x: window.screenX + rg.x, y: window.screenY + (window.outerHeight - window.innerHeight) + rg.y, w: rg.w, h: rg.h };
      const { id: got } = await api<{ id: string }>('POST', '/shot', area);
      setId(got); setShotVer((v) => v + 1); setErr(null);
    } catch (ex) {
      setErr(String(ex));
    }
    setShooting(false);
    setPhase('sheet');
  };

  const removeEl = (mi: number, ei: number) => setMarks((ms) => ms.map((m, i) => (i === mi ? { ...m, els: m.els.filter((_, j) => j !== ei) } : m)));

  const cancel = async () => { if (id) api('DELETE', `/${id}`).catch(() => {}); reset(); setPhase('idle'); };
  const submit = async () => {
    if (!id) { setErr('还没有截图'); return; }
    setBusy(true);
    try {
      const r = await api<{ number: number; url: string }>('POST', '', {
        id, title: title.trim() || tabName, desc, type, judge, tab: tabName, hash: location.hash,
        marks, save: localStorage.getItem(SAVE_KEY), errors: recentErrors(), pasted: pasted ?? undefined,
      });
      setIssue({ ...r, title: title.trim() || tabName });
      reset(); setPhase('toast');
      setTimeout(() => setPhase((p) => (p === 'toast' ? 'idle' : p)), 6000);
    } catch (ex) {
      setErr(String(ex));
    }
    setBusy(false);
  };

  if (phase === 'idle') return null;

  if (phase === 'cap') {
    return (
      <div className={`jh-report jh-report-cap${shooting ? ' shooting' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        {!shooting && <div className="hint">拖一个框，圈住你要说的地方<kbd>Esc 取消 · 松开即定</kbd></div>}
        {marks.map((m, i) => <div key={i} className="box" data-n={CIRCLED[i]} style={css(m.rect)} />)}
        {box && <div className="box" data-n={CIRCLED[marks.length]} style={css(box)} />}
        {hits.map((h, i) => <div key={i} className="el" style={css(h)} />)}
      </div>
    );
  }

  if (phase === 'toast' && issue) {
    return (
      <div className="jh-report jh-report-toast" role="status">
        <div className="seal">入池</div>
        <div className="t"><b>#{issue.number}</b> {issue.title}</div>
        <div className="d">待开始 · <a href={issue.url} target="_blank" rel="noreferrer">{issue.url.replace('https://', '')}</a></div>
      </div>
    );
  }

  return (
    <>
      <div className="jh-report jh-report-back" onClick={cancel} />
      <aside className="jh-report jh-report-sheet" aria-label="提报">
        <h2>提报<small>{tabName} · {new Date().toTimeString().slice(0, 5)}</small></h2>
        <div className={`shot${pasted ? ' pasted' : ''}`}>
          {pasted ? <img src={pasted} alt="" /> : id ? <img src={`/__report/${id}/shot.png?v=${shotVer}`} alt="" /> : <div className="none">没截到图</div>}
        </div>
        <div className="shot-cap">{pasted ? '已换成你的截图' : <><kbd>⌘V</kbd>&nbsp;换成你自己的截图</>}</div>
        <div className="els">
          <div className="k"><span>框中元素</span><button type="button" onClick={() => setPhase('cap')}>再框一处</button></div>
          {marks.map((m, mi) => m.els.map((e, ei) => (
            <div className="chip" key={`${mi}-${ei}`}>
              <span className="n">{CIRCLED[mi]}</span>
              <span className="t">{e.text}<code>{e.sel}</code></span>
              <button type="button" className="x" aria-label="去掉" onClick={() => removeEl(mi, ei)}>×</button>
            </div>
          )))}
        </div>
        <input className={`title${titleTouched ? '' : ' auto'}`} value={title} placeholder="标题（自动）" aria-label="标题" onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} />
        <textarea ref={descRef} value={desc} placeholder="怎么了，想改成什么样" onChange={(e) => setDesc(e.target.value)} />
        <div className="opts">
          <div className="seg" role="group" aria-label="类型">
            <button type="button" aria-pressed={type === 'bug'} onClick={() => setType('bug')}>缺陷</button>
            <button type="button" aria-pressed={type === 'polish'} onClick={() => setType('polish')}>优化</button>
          </div>
          <button type="button" className="sw" aria-pressed={judge} onClick={() => setJudge((v) => !v)}>需我裁决<i /></button>
        </div>
        <div className="auto-line">
          <span>存档</span><span>页签 {tabName}</span>{location.hash && <span>{location.hash.slice(0, 24)}</span>}
          {recentErrors().length > 0 && <span className="warn">控制台错误 {recentErrors().length}</span>}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="acts">
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>{busy ? '提报中' : '提报'}</button>
          <button type="button" className="cancel" onClick={cancel}>取消</button>
        </div>
      </aside>
    </>
  );
}
