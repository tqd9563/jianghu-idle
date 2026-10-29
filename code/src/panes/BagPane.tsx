/**
 * 行囊页 —— 基准 docs/design/bag-wugong-prototype.html + DESIGN.md「行囊」：雾中人影 + 蓝印花布包袱，一整幅 AI 画上叠字与格子。
 * 左：人影四处挂点（佩饰 / 衣甲 / 暗器 / 兵器）引金线到小框，两左两右，脚下一行属性合计；
 * 右：布面上的形态格背包（10 列，按部位占格、自动紧凑摆放），格边颜色即品阶；点物件在旁边弹出布贴纸签（属性对比、词条、穿戴 / 卖出）。
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  GEAR_SHAPE, GRADE_NAMES, affixText, bagUsed, betterThanWorn, gearPrefix,
  type BaseKey, type GearItem, type GearSlot,
} from '../engine/gear';
import { picLayout, type PicLayout } from '../components/qianchenSceneModel';
import { bagCellsOf, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

type Sort = 'new' | 'grade' | 'slot';
const SORTS: readonly [Sort, string][] = [['new', '新得'], ['grade', '品阶'], ['slot', '部位']];
const BASE_KEYS: readonly BaseKey[] = ['攻击', '气血', '防御', '命中', '闪避'];
const SLOT_ORDER: Record<GearSlot, number> = { 兵器: 0, 暗器: 1, 衣甲: 2, 佩饰: 3 };
/** 人影四处挂点与对应小框（画幅 %，按 art/xingnang/bg.jpg 中人影量取）；衣甲、兵器的小框在左 */
const WEAR_AT: Record<GearSlot, [[number, number], [number, number]]> = {
  佩饰: [[27, 28], [37.5, 24]], 衣甲: [[25.5, 37], [12, 33]], 暗器: [[27, 47], [37.5, 46]], 兵器: [[20.5, 56], [12, 58]],
};
const LEFT: Partial<Record<GearSlot, true>> = { 衣甲: true, 兵器: true };
const WEAR_ORDER: GearSlot[] = ['佩饰', '衣甲', '暗器', '兵器'];
/** 包袱布面（画幅 %）：格子在这块里按格数排、居中 */
const CLOTH = { x: 47.5, y: 37.5, w: 44, h: 47 };
const img = (it: GearItem) => `/art/gear/${it.img}.png`;

export function BagPane() {
  const s = useGameStore();
  const bag = s.bag ?? [];
  const worn = s.worn ?? {};
  const cells = bagCellsOf(s);
  const [sel, setSel] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const stageRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<PicLayout | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('xn-own-art');
    return () => document.documentElement.classList.remove('xn-own-art');
  }, []);
  // 离开这一页，这趟看过的就不再算新得（金点清掉）；页内不动，免得「新得」排序跳位
  useEffect(() => () => useGameStore.getState().markBagSeen(), []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setL(picLayout(el.clientWidth, el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!sel) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('.gcard, .it, .wear')) setSel(null);
    };
    addEventListener('keydown', close);
    addEventListener('pointerdown', close);
    return () => { removeEventListener('keydown', close); removeEventListener('pointerdown', close); };
  }, [sel]);

  const used = bagUsed(bag);
  const list = [...bag].sort(
    sort === 'new' ? (a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || b.grade - a.grade
      : sort === 'grade' ? (a, b) => b.grade - a.grade
        : (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || b.grade - a.grade,
  );
  const sum: Partial<Record<BaseKey, number>> = {};
  for (const it of Object.values(worn)) {
    if (!it) continue;
    for (const k of BASE_KEYS) if (it.base[k]) sum[k] = (sum[k] ?? 0) + it.base[k]!;
  }
  const pick = (id: string) => setSel(sel === id ? null : id);

  // 形态格：10 列，行数随容量；格子取正方形、在布面里居中
  const cols = 10, rows = Math.ceil(cells / cols);
  let clothStyle: CSSProperties | undefined;
  if (L) {
    const ph = (L.pw * 9) / 16, cw = (CLOTH.w / 100) * L.pw, chh = (CLOTH.h / 100) * ph;
    const cs = Math.floor(Math.min(cw / cols, chh / rows));
    clothStyle = {
      left: `calc(${CLOTH.x}% + ${(cw - cs * cols) / 2}px)`, top: `calc(${CLOTH.y}% + ${(chh - cs * rows) / 2}px)`,
      gridTemplateColumns: `repeat(${cols}, ${cs}px)`, gridTemplateRows: `repeat(${rows}, ${cs}px)`,
    };
  }

  const vars = L ? { '--pw': `${L.pw}px`, '--pl': `${L.pl}px`, '--pt': `${L.pt}px` } as CSSProperties : undefined;
  return (
    <div className={`xn${L ? '' : ' unready'}`} ref={stageRef} style={vars}>
      <div className="wpic">
        <div className="bg" style={{ backgroundImage: "url('/art/xingnang/bg-tall.jpg')" }} />
        <svg className="links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {WEAR_ORDER.map((slot) => {
            const [[px, py], [fx, fy]] = WEAR_AT[slot];
            return <line key={slot} x1={px} y1={py} x2={fx} y2={fy} style={worn[slot] ? undefined : { stroke: 'oklch(0.7 0.02 262 / .4)' }} />;
          })}
        </svg>
        {WEAR_ORDER.map((slot) => {
          const [[px, py], [fx, fy]] = WEAR_AT[slot];
          const it = worn[slot];
          return (
            <span key={slot}>
              <span className={`ring${it ? '' : ' empty'}`} style={{ left: `${px}%`, top: `${py}%` }} />
              {it ? (
                <button type="button" className={`wear${LEFT[slot] ? ' l' : ''}${sel === it.id ? ' sel' : ''}`} data-id={it.id}
                  style={{ left: `${fx}%`, top: `${fy}%`, '--gc': `var(--g${it.grade})` } as CSSProperties}
                  data-tip={`${gearPrefix(it)}${it.name} · ${GRADE_NAMES[it.grade]}`} onClick={() => pick(it.id)}>
                  <span className="fr"><img src={img(it)} alt="" /></span><span className="lb">{slot}</span>
                </button>
              ) : (
                <span className={`wear empty${LEFT[slot] ? ' l' : ''}`} style={{ left: `${fx}%`, top: `${fy}%` }}>
                  <span className="fr" /><span className="lb">{slot}</span>
                </span>
              )}
            </span>
          );
        })}
        {Object.keys(sum).length > 0 && (
          <div className="wsum" style={{ left: '25%', top: '84%' }}>
            {BASE_KEYS.filter((k) => sum[k]).map((k) => <span key={k}>{k}<b>+{fmtBig(sum[k]!)}</b></span>)}
          </div>
        )}
        <div className="cloth" style={clothStyle}>
          {list.map((it) => {
            const [c, r] = GEAR_SHAPE[it.slot];
            return (
              <button key={it.id} type="button" className={`it g${it.grade}${sel === it.id ? ' sel' : ''}`} data-id={it.id}
                style={{ gridColumn: `span ${c}`, gridRow: `span ${r}`, '--gc': `var(--g${it.grade})` } as CSSProperties}
                data-tip={`${gearPrefix(it)}${it.name} · ${GRADE_NAMES[it.grade]}`} onClick={() => pick(it.id)}>
                {it.fresh && <span className="fresh" />}
                {betterThanWorn(it, worn) && !!worn[it.slot] && <span className="up">▲</span>}
                <img src={img(it)} alt="" />
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, cells - used) }, (_, i) => <i key={i} className="cell" />)}
        </div>
      </div>
      <div className="vig" />
      <header className="whead">
        <div>
          <h1>行囊</h1>
          <div className="sub">背包 <b>{used}</b> / {cells} 格</div>
          <div className="wseg" role="group" aria-label="排序">
            {SORTS.map(([k, name]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{name}</button>)}
          </div>
        </div>
        <div className="right">
          <button type="button" className="btn-ghost" disabled={!bag.some((g) => g.grade < 3)} onClick={() => { s.sellGearBelow(3); setSel(null); }}>
            一键出售 上乘以下
          </button>
        </div>
      </header>
      {sel && <Tag id={sel} stage={stageRef} onClose={() => setSel(null)} />}
    </div>
  );
}

/** 布贴纸签：放在选中物件右侧，放不下改左侧；上不压页头 */
function Tag({ id, stage, onClose }: { id: string; stage: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const s = useGameStore();
  const worn = s.worn ?? {};
  const wornIt = Object.values(worn).find((g) => g?.id === id);
  const it = wornIt ?? (s.bag ?? []).find((g) => g.id === id);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const t = ref.current, st = stage.current, el = st?.querySelector(`[data-id="${id}"]`);
    if (!t || !st || !el) return;
    const S = st.getBoundingClientRect(), r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
    let x = r.right - S.left + 12;
    if (x + w > S.width - 8) x = r.left - S.left - w - 12;
    const y = r.top - S.top + r.height / 2 - h / 2;
    setPos({ x: Math.max(8, Math.min(S.width - w - 8, x)), y: Math.max(110, Math.min(S.height - h - 10, y)) });
  }, [id, stage, it]);
  if (!it) return null;
  const isWorn = !!wornIt;
  const cur = isWorn ? null : worn[it.slot] ?? null;
  const keys = BASE_KEYS.filter((k) => it.base[k] || cur?.base[k]);
  const bagFull = isWorn && bagUsed(s.bag ?? []) + GEAR_SHAPE[it.slot][0] * GEAR_SHAPE[it.slot][1] > bagCellsOf(s);
  return (
    <div ref={ref} className="gcard" role="dialog" aria-label={it.name}
      style={{ '--pgc': `var(--pg${it.grade})`, ...(pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }) } as unknown as CSSProperties}>
      <div className="nm">{gearPrefix(it) && <span className="pre">{gearPrefix(it)}</span>}{it.name}</div>
      <div className="meta"><span className="gr">{GRADE_NAMES[it.grade]}</span> · {it.slot}{it.cat ? ` · ${it.cat}` : ''}</div>
      <hr />
      {keys.map((k) => {
        const a = it.base[k] ?? 0, d = a - (cur?.base[k] ?? 0);
        return (
          <div key={k} className="row">
            <span className="k">{k}</span><span className="v">+{fmtBig(a)}</span>
            <span className={`d${d > 0 ? ' up' : d < 0 ? ' dn' : ''}`}>{isWorn ? '' : d > 0 ? `▲ ${fmtBig(d)}` : d < 0 ? `▼ ${fmtBig(-d)}` : '—'}</span>
          </div>
        );
      })}
      {it.afx.length > 0 && <><hr /><div className="afx">{it.afx.map((a) => <div key={a[0]}>{affixText(a)}</div>)}</div></>}
      <div className="acts">
        {isWorn
          ? <button type="button" className="sub" disabled={bagFull} data-tip={bagFull ? '行囊已满' : undefined} onClick={() => { s.unwearGear(it.slot); onClose(); }}>卸下</button>
          : (
            <>
              <button type="button" className="main" onClick={() => s.wearGear(it.id)}>穿戴</button>
              <button type="button" className="sub" onClick={() => { s.sellGear(it.id); onClose(); }}>卖 {fmtBig(it.sell)} 两</button>
            </>
          )}
      </div>
    </div>
  );
}
