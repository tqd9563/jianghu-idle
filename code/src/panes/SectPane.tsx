/**
 * 门派页 —— 视觉基准 docs/design/sect-overhaul-prototype.html（2026-10-28 定稿）+ DESIGN.md「门派页」。
 * 拜入后是本门驻地一整幅俯瞰水墨图，三座建筑是入口：百务殿（领差事）、典籍院（换武学与内功）、天工库（换本门装备，二级地位解锁）。
 * 内景照左图右意：画只作氛围，右侧暗区题跋写差事卷宗 / 货架与详情。未拜入是「拜山」：按卷分组、每家一张横卡。
 * 数值一律出自 engine / store（sect-overhaul/spec.md §2–§5），本组件只拼文案与画。
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type MouseEvent, type ReactNode } from 'react';
import { volName } from '../engine/enemies';
import { HUOHOU_MULT, NEIGONG, QI_COEF, TIERS, TIER_COUNT } from '../engine/neigong';
import { AFFIX_LABEL, AFFIX_PREFIX, GRADE_NAMES, rollGear } from '../engine/gear';
import { ROUTES } from '../engine/routes';
import { WUXUE, effectText, formName } from '../engine/wuxue';
import { SECTS, SECT_HOURS, SECT_VOLS, joinWord, sectTaskGain, sectsInVol, type SectHours, type SectId, type SectTier } from '../engine/sect';
import { frontierStageOf, priceBasisOf, sectShelfOf, useGameStore, volUnlocked, type SectShelfRow } from '../store/gameStore';
import { fmtBig } from '../fmt';
import { Q_NO, catIcon, ngIcon } from './wugong/shared';

const ART = '/art/sect';
/** 驻地图与内景都是 2000 × 1390 */
const RATIO = 2000 / 1390;
const HOURS_TEXT: Record<SectHours, string> = { 2: '一个时辰', 8: '四个时辰' };

type View = 'map' | 'hall' | 'dianji' | 'tiangong';
type Shop = 'dianji' | 'tiangong';
const SHOP_TITLE: Record<Shop, string> = { dianji: '典籍院', tiangong: '天工库' };
/** 内景按门派性质分套（docs/design/concepts/sect-halls-sheet.jpg）：佛门 fo、道观 dao、帮会 bang、邪派 xie，其余正派用苍崖派原套 */
function hallSet(id: SectId): string {
  const d = SECTS[id];
  if (d.kind === '寺' || d.kind === '庵') return 'fo';
  if (d.kind === '观') return 'dao';
  if (d.kind === '帮' || d.kind === '会') return 'bang';
  return d.camp === '邪' ? 'xie' : '';
}
const hallImg = (id: SectId, hall: 'baiwu' | Shop) => { const k = hallSet(id); return k ? `hall-${k}-${hall}.jpg` : `hall-${hall}.jpg`; };
const SHOP_KINDS: Record<Shop, SectShelfRow['kind'][]> = { dianji: ['wuxue', 'pages', 'neigong', 'juance'], tiangong: ['gear'] };

/** 三个入口（所有门派驻地图同一构图）：名牌下柔光落点 + 可点的建筑范围，占画幅 % */
const GATES: { key: Exclude<View, 'map'>; name: string; rank: number; at: [number, number]; hit: [number, number, number, number] }[] = [
  { key: 'hall', name: '百务殿', rank: 1, at: [31.6, 57], hit: [6, 35, 36, 25] },
  { key: 'dianji', name: '典籍院', rank: 1, at: [88.4, 27.5], hit: [63, 6, 23, 23] },
  { key: 'tiangong', name: '天工库', rank: 2, at: [79, 61], hit: [80, 46, 17, 21] },
];
/** 百务殿六块挂牌牌面（占画幅 %）：左、上、宽、高——从左到右逐块略低，透视 */
const TABS: [number, number, number, number][] = [
  [7.4, 25.2, 4.0, 18.0], [13.6, 26.3, 3.9, 17.8], [19.6, 27.5, 3.5, 17.3], [25.15, 28.8, 3.35, 16.9], [30.6, 29.5, 3.2, 16.8], [35.75, 30.8, 3.15, 16.0],
];
/** 暗区里的古籍暗纹（约 2% 不透明，只作肌理） */
const PAPER = '凡入门者先修其心后习其技心正则艺正心乱则艺乱古之侠者重诺轻生一言既出千金不易门中弟子晨起洒扫暮而习武寒暑不辍不得欺师灭祖不得恃强凌弱不得贪财好色不得滥杀无辜有功者赏有过者罚门规如山犯者逐出'.repeat(6);

/** 画按舞台宽铺满；矮屏允许多铺一点（over 倍），裁掉的部分按锚点分配；题跋落在画右侧的暗区 */
function artVars(W: number, H: number, over: number, anchor: number, dark: number): CSSProperties {
  const aw = Math.max(W, Math.min(W * over, H * RATIO)), ah = aw / RATIO;
  const ax = (W - aw) * anchor, ay = ah > H ? (H - ah) * 0.45 : 0;
  const tw = Math.max(272, Math.min(330, W - 40 - (ax + aw * dark)));
  return {
    '--aw': `${aw}px`, '--ah': `${ah}px`, '--ax': `${ax}px`, '--ay': `${ay}px`,
    '--tw': `${tw}px`, '--sw': `${Math.min(62, ((tw + 150) / W) * 100)}%`, '--ty': `${Math.max(96, Math.min(H * 0.15, 150))}px`,
  } as CSSProperties;
}

/** 一时辰 = 2 小时 = 八刻，剩余按刻向上取整 */
function fmtLeft(ms: number): ReactNode {
  const m = Math.max(0, ms / 60e3);
  let h = Math.floor(m / 120), k = Math.ceil((m - h * 120) / 15);
  if (k >= 8) { h++; k = 0; }
  return <>{h > 0 && <>{h}<small>时辰</small></>}{(k > 0 || h === 0) && <>{k}<small>刻</small></>}</>;
}

type Float = { id: number; text: string; num: boolean; left: string; top: string };
/** 操作反馈：浮在对象旁，1.8 秒后散去 */
function useFloats(): [Float[], (f: Omit<Float, 'id'>) => void] {
  const [list, setList] = useState<Float[]>([]);
  const seq = useRef(0);
  const add = (f: Omit<Float, 'id'>) => {
    const id = ++seq.current;
    setList((l) => [...l, { ...f, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 1800);
  };
  return [list, add];
}

function Pic({ img, children }: { img: string; children?: ReactNode }) {
  return (
    <div className="sx-pic">
      <div className="img" style={{ '--img': `url('${ART}/${img}')` } as CSSProperties} />
      {children}
      <div className="tone" /><div className="vig" />
    </div>
  );
}

export function SectPane() {
  const sect = useGameStore((s) => s.sect);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);

  // 页自带画：收起页底图（同修炼页）
  useEffect(() => {
    document.documentElement.classList.add('sx-own-art');
    return () => document.documentElement.classList.remove('sx-own-art');
  }, []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`sx${size ? '' : ' unready'}`} ref={stageRef}>
      {sect ? <SectHome id={sect} W={size?.W ?? 0} H={size?.H ?? 0} /> : <SectJoin />}
    </div>
  );
}

// ---------------------------------------------------------------- 拜山

function SectJoin() {
  const s = useGameStore();
  const vols = SECT_VOLS.filter((v) => volUnlocked(v, s.mapsUnlocked ?? [1]));
  const [pick, setPick] = useState<SectId | null>(vols.length ? sectsInVol(vols[0])[0] : null);
  const picked = pick ? SECTS[pick] : null;
  return (
    <div className="sx-join">
      <h1>拜山</h1>
      {vols.map((v) => (
        <div key={v}>
          <div className="sx-vol">{volName(v)}</div>
          <div className="sx-cards" role="radiogroup" aria-label={volName(v)}>
            {sectsInVol(v).map((id) => {
              const d = SECTS[id];
              return (
                <button key={id} type="button" className="sx-cardj" role="radio" aria-checked={pick === id} onClick={() => setPick(id)}>
                  <span className="th" style={{ '--img': `url('${ART}/${id}-map.jpg')` } as CSSProperties} />
                  <span className="tx">
                    <span className="nm">{d.name}<small>{d.tierName}</small></span>
                    <span className="mk">
                      <span className="rt">{ROUTES[d.route].name}</span>
                      {d.cats.map((c) => <i key={c} className="ic" style={catIcon(c)} />)}
                    </span>
                    <span className="sg">{d.signature}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {picked && <button type="button" className="sx-scroll long" onClick={() => s.joinSect(picked.id)}>{joinWord(picked.kind)}{picked.name}</button>}
    </div>
  );
}

// ---------------------------------------------------------------- 已拜入：驻地图与三座内景

function SectHome({ id, W, H }: { id: SectId; W: number; H: number }) {
  const s = useGameStore();
  const d = SECTS[id];
  const rank = s.sectRank ?? 1;
  const [view, setView] = useState<View>('map');
  // 离场的那一幅向所点建筑推近散去，0.8 秒后卸掉
  const [leaving, setLeaving] = useState<{ view: View; ox: number; oy: number } | null>(null);
  const go = (next: View, from?: [number, number]) => {
    if (next === view) return;
    setLeaving({ view, ox: from?.[0] ?? 50, oy: from?.[1] ?? 50 });
    setView(next);
  };
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 800);
    return () => clearTimeout(t);
  }, [leaving]);

  const stand = <div className="stand">{d.ranks[rank - 1]} · 贡献<b>{fmtBig(s.contrib ?? 0)}</b></div>;
  const render = (v: View, key: string, extra?: CSSProperties): JSX.Element => {
    const common = { key, id, stand, W, H, back: () => go('map') };
    if (v === 'map') return <MapView {...common} style={extra} go={go} />;
    if (v === 'hall') return <HallView {...common} style={extra} />;
    return <ShopView {...common} style={extra} shop={v} />;
  };
  return (
    <>
      {leaving && render(leaving.view, `l-${leaving.view}`, { '--ox': `${leaving.ox}%`, '--oy': `${leaving.oy}%` } as CSSProperties)}
      {render(view, view)}
    </>
  );
}

type ViewProps = { id: SectId; stand: ReactNode; W: number; H: number; back: () => void; style?: CSSProperties };
const Back = ({ name, onClick }: { name: string; onClick: () => void }) => (
  <button type="button" className="sx-back" onClick={onClick}><svg viewBox="0 0 14 14"><path d="M9 2 4 7l5 5" /></svg>{name}</button>
);

/** 驻地图：整幅画铺满，三个入口是建筑旁的竖排名牌 + 牌下柔光；天工库二级地位才出现，首次出现带金点 */
function MapView({ id, stand, W, H, style, go }: ViewProps & { go: (v: View, from: [number, number]) => void }) {
  const s = useGameStore();
  const d = SECTS[id];
  const rank = s.sectRank ?? 1;
  const seen = (s.seenTabs ?? []).includes('sect:tiangong');
  return (
    <section className={`sx-view${style ? ' leave' : ''}`} style={{ ...artVars(W, H, 1.1, 0.5, 0.68), ...style }}>
      <div className="sx-art">
        <Pic img={`${id}-map.jpg`} />
        {GATES.filter((g) => rank >= g.rank).map((g) => {
          const [l, t, w, h] = g.hit;
          const open = () => { if (g.key === 'tiangong') s.seeTab('sect:tiangong'); go(g.key, [l + w / 2, t + h / 2]); };
          return (
            <div key={g.key} className="sx-gate">
              <button type="button" className="hit" aria-hidden tabIndex={-1} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }} onClick={open} />
              <span className="glow" style={{ left: `${g.at[0]}%`, top: `${g.at[1]}%` }} />
              <button type="button" className="plq" style={{ left: `${g.at[0]}%`, top: `${g.at[1]}%` }} onClick={open}>
                {g.name}{g.key === 'tiangong' && !seen && <i className="new" />}
              </button>
            </div>
          );
        })}
      </div>
      <header className="sx-head">
        <h1>{d.name}<span className="seal">{d.name.slice(0, 2)}</span></h1>
        {stand}
      </header>
    </section>
  );
}

/** 百务殿：六块挂牌即六档差事，右侧差事卷宗；派出后案上那炷香计时 */
function HallView({ id, stand, W, H, style, back }: ViewProps) {
  const s = useGameStore();
  const d = SECTS[id];
  const rank = s.sectRank ?? 1;
  const task = s.sectTask;
  const [picked, setPicked] = useState<SectTier>(rank as SectTier);
  const [hours, setHours] = useState<SectHours>(2);
  const [now, setNow] = useState(Date.now());
  const [floats, addFloat] = useFloats();
  const sel = (task ? task.tier : Math.min(picked, rank)) as SectTier;

  useEffect(() => {
    if (!task) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [task]);
  // 到点结算：差事消失、贡献入账，「+n」浮在那块挂牌旁
  const prev = useRef({ task, contrib: s.contrib ?? 0 });
  useEffect(() => {
    const p = prev.current;
    if (p.task && !task && (s.contrib ?? 0) > p.contrib) floatAt(p.task.tier, `+${fmtBig((s.contrib ?? 0) - p.contrib)}`, true);
    prev.current = { task, contrib: s.contrib ?? 0 };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const floatAt = (tier: SectTier, text: string, num: boolean) => {
    const [l, t, w] = TABS[tier - 1];
    addFloat({ text, num, left: `${l + w + 2.2}%`, top: `${t + 4}%` });
  };

  const total = task ? task.hours * 3600e3 : 1;
  const left = task ? Math.max(0, task.endsAt - now) : 0;
  const tip = (0.687 + (1 - left / total) * 0.043).toFixed(4);
  const e = d.errands[sel - 1];
  return (
    <section className={`sx-view inner sx-hall${task ? ' busy' : ''}${style ? ' leave' : ''}`} style={{ ...artVars(W, H, 1, 0, 0.68), ...style }}>
      <div className="sx-art">
        <Pic img={hallImg(id, 'baiwu')}>
          {task && (
            <div className="sx-joss" style={{ '--tip': tip } as CSSProperties}>
              <span className="gone" /><span className="ember" />
              <span className="puff" style={{ '--d': '0s', '--dx': '-6px' } as CSSProperties} />
              <span className="puff" style={{ '--d': '1.4s', '--dx': '5px' } as CSSProperties} />
              <span className="puff" style={{ '--d': '2.8s', '--dx': '-2px' } as CSSProperties} />
            </div>
          )}
        </Pic>
        <div className="sx-bian-dim" />
        <div className="sx-bian">百务殿</div>
        {TABS.map(([l, t, w, h], i) => {
          const tier = (i + 1) as SectTier, on = tier <= rank;
          return (
            <button key={tier} type="button" className={`sx-tab${on ? ' on' : ''}${on && sel === tier ? ' sel' : ''}`}
              style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }}
              tabIndex={on ? 0 : -1} aria-hidden={!on} aria-pressed={on ? sel === tier : undefined}
              onClick={() => { if (on && !task) setPicked(tier); }}>
              <span className="halo" /><span className="lit" /><span className="nm">{on ? d.errands[i].name : ''}</span>
            </button>
          );
        })}
        {floats.map((f) => <div key={f.id} className={`sx-float${f.num ? ' num' : ''}`} style={{ left: f.left, top: f.top }}>{f.text}</div>)}
      </div>
      <div className="sx-shade"><div className="sx-paper">{PAPER}</div></div>
      <header className="sx-head">
        <Back name={d.name} onClick={back} />
        <h1>百务殿</h1>
        {stand}
      </header>
      <section className="sx-insc">
        <h2 className="sx-big">{e.name}</h2>
        <div className="sx-tag">〔{d.ranks[sel - 1]} · 差事〕</div>
        <p className="sx-desc">{e.text}</p>
        {task ? (
          <>
            <div className="sx-stroke" />
            <dl className="sx-kv">
              <div><dt>还剩</dt><dd>{fmtLeft(left)}</dd></div>
              <div><dt>将得</dt><dd className="g">{fmtBig(sectTaskGain(task.tier, task.hours))}<small>贡献</small></dd></div>
            </dl>
          </>
        ) : (
          <>
            <div className="sx-durs">
              {SECT_HOURS.map((h) => (
                <button key={h} type="button" className={`sx-dur${hours === h ? ' on' : ''}`} aria-pressed={hours === h} onClick={() => setHours(h)}>
                  <i className="dm" /><span className="dn">{HOURS_TEXT[h]}</span><span className="dv">赏<b>{fmtBig(sectTaskGain(sel, h))}</b>贡献</span>
                </button>
              ))}
            </div>
            <button type="button" className="sx-scroll long" onClick={() => { s.startSectTask(sel, hours); floatAt(sel, '领差', false); }}>领牌派出</button>
          </>
        )}
      </section>
    </section>
  );
}

/** 货架一行与详情用到的文案：品质色、〔品阶 · 类别〕、来历句、2 × 2 属性 */
function itemText(id: SectId, it: SectShelfRow, level: number, silver: number) {
  const d = SECTS[id];
  const attr = (k: string, v: string, tip?: string, wide = false) => ({ k, v, tip, wide });
  switch (it.kind) {
    case 'wuxue': case 'pages': {
      const w = WUXUE[it.wuxue!], k = it.form ?? 1;
      return {
        title: w.name, cls: `sx-q${Q_NO[w.quality]}`, tag: `${w.quality} · ${w.cat}法${it.kind === 'pages' ? '残页' : ''}`, desc: w.epigraph,
        attrs: [attr('伤害倍率', `×${Math.round(w.mults[k - 1] * 100)}%`), attr('触发几率', `${Math.round(w.p * 100)}%`), attr('真气消耗', String(w.cost)), attr('附加特效', w.effect, effectText(w, k))],
      };
    }
    case 'neigong': case 'juance': {
      const ng = NEIGONG[it.neigong!];
      const n = d.neigong;
      const tier = n.entry === ng.id ? '入门' : n.adv === ng.id ? '进阶' : n.peak === ng.id ? '镇派' : '兼修';
      if (it.kind === 'juance') return {
        title: it.label, cls: 'sx-q3', tag: `${tier} · 卷册`, desc: null,
        attrs: [attr('心法', ng.name), attr('归真', TIERS[TIER_COUNT[ng.quality] - 1].name)],
      };
      return {
        title: ng.name, cls: `sx-q${Q_NO[ng.quality]}`, tag: `${tier} · 内功`, desc: null,
        attrs: [attr('气海', `×${QI_COEF[ng.quality].toFixed(1)}`), attr('火候', `×${HUOHOU_MULT[ng.quality].toFixed(2)}`), attr('源流', ROUTES[ng.route].name), attr('可至', TIERS[TIER_COUNT[ng.quality] - 1].name)],
      };
    }
    case 'gear': {
      // 属性照兑换时的掷法取中值预览（gameStore.buySectItem）：极品、等级跟前沿走，一条本门词条固定；型取第一型（重型 / 命中型）
      const g = it.gear!;
      const roll = rollGear({ slot: g.slot, cat: g.cat, grade: 5, level: level + (g.tier === 'high' ? 0.5 : 0), clearSilver: silver }, () => 0.4999);
      return {
        title: g.name, cls: 'sx-g5', tag: `${g.slot}${g.cat ? ` · ${g.cat}` : ''}`, desc: null,
        attrs: [...Object.entries(roll.base).map(([k, v]) => attr(k, fmtBig(v!))), attr('品阶', GRADE_NAMES[5]), attr('词条', `${AFFIX_PREFIX[g.affix]} · ${AFFIX_LABEL[g.affix][0]}`, undefined, true)],
      };
    }
  }
}

function rowIcon(it: SectShelfRow): { cls: string; style: CSSProperties } {
  if (it.kind === 'neigong') return { cls: 'ic', style: ngIcon(it.neigong!) };
  if (it.kind === 'juance') return { cls: 'ic', style: { backgroundImage: "url('/art/scroll-q3.png')" } };
  if (it.kind === 'gear') return { cls: 'ic gear', style: { backgroundImage: `url('/art/gear/${it.gear!.img}.png')` } };
  return { cls: 'ic', style: catIcon(WUXUE[it.wuxue!].cat) };
}

/** 典籍院 / 天工库：画只作氛围；右侧上货架、中间菱纹分割、下选中物的卷宗与「兑换」 */
function ShopView({ id, stand, W, H, style, back, shop }: ViewProps & { shop: Shop }) {
  const s = useGameStore();
  const d = SECTS[id];
  const rank = s.sectRank ?? 1;
  const contrib = s.contrib ?? 0;
  const rows = sectShelfOf(s, id).filter((it) => it.rank <= rank && SHOP_KINDS[shop].includes(it.kind));
  const [pick, setPick] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [floats, addFloat] = useFloats();
  const viewRef = useRef<HTMLElement>(null);
  const it = rows.find((x) => x.id === pick) ?? rows.find((x) => !x.owned) ?? rows[0];
  const level = frontierStageOf(s).x ?? 1, silver = priceBasisOf(s);

  const buy = (e: MouseEvent<HTMLButtonElement>) => {
    if (!it || it.owned || it.lock || contrib < it.price) return;
    const row = viewRef.current?.querySelector(`[data-row="${CSS.escape(it.id)}"] .rp`);
    const box = viewRef.current?.getBoundingClientRect();
    if (row && box) {
      const r = row.getBoundingClientRect();
      addFloat({ text: `−${fmtBig(it.price)}`, num: true, left: `${r.left - box.left + r.width / 2}px`, top: `${r.top - box.top - 4}px` });
    }
    s.buySectItem(it.id);
    setPick(it.id);
    setFresh(it.id);
    e.currentTarget.blur();
  };

  const tx = it ? itemText(id, it, level, silver) : null;
  const short = it && !it.owned ? Math.max(0, it.price - contrib) : 0;
  const disabled = !!it && (!!it.lock || short > 0);
  return (
    <section ref={viewRef} className={`sx-view inner${style ? ' leave' : ''}`} style={{ ...artVars(W, H, 1.18, 1, 0.73), ...style }}>
      <div className="sx-art"><Pic img={hallImg(id, shop)} /></div>
      <div className="sx-shade"><div className="sx-paper">{PAPER}</div></div>
      <header className="sx-head">
        <Back name={d.name} onClick={back} />
        <h1>{SHOP_TITLE[shop]}</h1>
        {stand}
      </header>
      {floats.map((f) => <div key={f.id} className={`sx-float${f.num ? ' num' : ''}`} style={{ left: f.left, top: f.top }}>{f.text}</div>)}
      <section className={`sx-insc${rows.length > 6 ? ' dense' : ''}`}>
        <div className="sx-list">
          {rows.map((x) => {
            const t = itemText(id, x, level, silver), ic = rowIcon(x);
            const on = it?.id === x.id;
            return (
              <button key={x.id} type="button" data-row={x.id} className={`sx-row${on ? ' on' : ''}${fresh === x.id ? ' fresh' : ''}`} aria-pressed={on}
                onClick={() => setPick(x.id)} onAnimationEnd={() => fresh === x.id && setFresh(null)}>
                <i className={ic.cls} style={ic.style} />
                <span className={`rn ${t.cls}`}>{t.title}{x.kind === 'pages' && <small>残页 · {formName(x.form!)}</small>}</span>
                {x.owned ? <span className="rp own">已得</span>
                  : <span className={`rp${on && short > 0 ? ' short' : ''}`}><b>{fmtBig(x.price)}</b>贡献</span>}
              </button>
            );
          })}
        </div>
        {it && tx && (
          <>
            <div className="sx-orn"><b /><i /><b /></div>
            <div className="sx-card">
              <div className="nmrow">
                <h2 className={`${tx.cls}${tx.title.length > 4 ? ' w5' : ''}`}>{tx.title}</h2>
                <span className="gtag">{tx.tag}</span>
              </div>
              {tx.desc && <p className="sx-desc">{tx.desc}</p>}
              <dl className="sx-attrs">
                {tx.attrs.map((a) => (
                  <div key={a.k} className={`a${a.wide ? ' wide' : ''}`}><dt>{a.k}</dt><dd data-tip={a.tip}>{a.v}</dd></div>
                ))}
              </dl>
              {it.owned ? <div className="sx-own-gap"><span className="sx-own">已得</span></div>
                : (
                  <button type="button" className="sx-scroll" aria-disabled={disabled || undefined}
                    data-tip={it.lock ?? (short > 0 ? `还差 ${fmtBig(short)} 贡献` : undefined)} onClick={buy}>兑换</button>
                )}
            </div>
          </>
        )}
      </section>
    </section>
  );
}
