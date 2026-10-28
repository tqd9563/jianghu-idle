/**
 * 前尘 —— 底蕴（修行感悟 + 八条属性，可反复购买）、机缘（十四件一次性）、侠名录（二十二条成就）；转世后的落地页（§8.6-4）。
 * 基准 docs/design/qianchen-xiang-prototype.html + DESIGN.md「前尘页」：三段各一幅 AI 水墨画，代码只叠字与按钮。
 * 文案逐字取自 docs/rules/copy/retire.md v2.4 §5；侠名录 §5.3。
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type Ref, type RefObject } from 'react';
import { REALMS } from '../engine/content';
import {
  DIYUN_MAP, GANWU_GAIN, REP_NODES, SUHUI, diyunCum, diyunGainAt, diyunPrice, freshDiyun, ganwuPrice,
} from '../engine/prestige';
import { ACHV, ACHV_MAP, achvCount, achvEffText, achvTier, type AchvId } from '../engine/achievements';
import { XIANG, ZONES, cardAt, jiyuanSlipAt, picLayout, reveal, type PicLayout } from '../components/qianchenSceneModel';
import { currentMult, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

export type RepSub = 'diyun' | 'jiyuan' | 'xiaming';

const TIP_GANWU = '侠名在外，江湖自有人奉上资粮';
const ART = '/art/qianchen';

const fmtV = (v: number, kind: 'pct' | 'pts') => `${(v * 100).toFixed(1).replace(/\.0$/, '')}${kind === 'pts' ? '点' : '%'}`;
const short = (price: number, rep: number) => (rep >= price ? undefined : `还差 ${fmtBig(Math.ceil(price - rep))} 声望`);

/** 朱印价格按钮：钱不够时去色，外层悬停说还差多少（禁用的按钮收不到悬停） */
function SealBuy({ price, rep, onBuy }: { price: number; rep: number; onBuy: () => void }) {
  const tip = short(price, rep);
  return (
    <span className="qc-buy" data-tip={tip}>
      <button type="button" className="qc-seal" disabled={!!tip} onClick={onBuy}>{fmtBig(price)}<small>声望</small></button>
    </span>
  );
}

export function RepPane({ sub, onSub }: { sub: RepSub; onSub: (s: RepSub) => void }) {
  const s = useGameStore();
  const stageRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<PicLayout | null>(null);

  // 页自带画：收起页底图（同修炼页）
  useEffect(() => {
    document.documentElement.classList.add('qc-own-art');
    return () => document.documentElement.classList.remove('qc-own-art');
  }, []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setL(picLayout(el.clientWidth, el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const peak = s.peakRealm ?? 1;
  const ganwu = GANWU_GAIN * (s.ganwuLevel ?? 0);
  const suhuiLines = Object.entries(SUHUI).map(([realm, v]) => Number(realm) <= peak
    ? `+ 宿慧 · 首达${REALMS[Number(realm) - 1].name} ${v.toFixed(1)}×`
    : `<span class="l">宿慧 · 首达${REALMS[Number(realm) - 1].name} ${v.toFixed(1)}× · 未至</span>`).join('<br>');
  const multTip = `基础 1<br>${suhuiLines}<br>+ 修行感悟 ${ganwu.toFixed(1)}×<br><span class="l">相加即挂机产出倍率</span>`;
  const tiers = ACHV.map((a) => achvTier(s, a.id));

  const vars = L ? { '--pw': `${L.pw}px`, '--pl': `${L.pl}px`, '--pt': `${L.pt}px` } as CSSProperties : undefined;
  return (
    <div className={`qc${L?.short ? ' short' : ''}${L ? '' : ' unready'}`} ref={stageRef} style={vars}>
      {sub === 'diyun' && <Diyun />}
      {sub === 'jiyuan' && <Jiyuan />}
      {sub === 'xiaming' && <Xiaming stage={stageRef} />}
      <div className="qc-vig" />
      <header className="qc-head">
        <div>
          <h1>前尘</h1>
          <div className="rep">{sub === 'xiaming'
            ? <>得名 <b>{tiers.filter((t) => t > 0).length}</b> / {ACHV.length} · 点亮 <b>{tiers.reduce((a, b) => a + b, 0)}</b> / {ACHV.length * 3} 重</>
            : <>持有 <b>{fmtBig(s.reputation)}</b> 声望</>}</div>
          <div className="qc-seg" role="tablist" aria-label="前尘">
            {([['diyun', '底蕴'], ['jiyuan', '机缘'], ['xiaming', '侠名录']] as const).map(([k, name]) => (
              <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => onSub(k)}>{name}</button>
            ))}
          </div>
        </div>
        <div className="qc-mult"><b data-tip={multTip}>{currentMult(s).toFixed(1)}×</b><span>挂机产出</span></div>
      </header>
    </div>
  );
}

/** 底蕴 · 往世八相：每位往世按级数在空景上显影，旁挂一支签；修行感悟写在悬幅上 */
function Diyun(): JSX.Element {
  const s = useGameStore();
  const diyun = { ...freshDiyun(), ...(s.diyun ?? {}) };
  const lv = s.ganwuLevel ?? 0;
  const [flare, setFlare] = useState<string | null>(null);
  useEffect(() => {
    if (!flare) return;
    const t = setTimeout(() => setFlare(null), 1200);
    return () => clearTimeout(t);
  }, [flare]);
  return (
    <div className="qc-pic">
      <div className="bg" style={{ backgroundImage: `url('${ART}/xiang-empty.jpg')` }} />
      <div className="qc-ghosts">
        {XIANG.map(({ id, fig: [cx, cy, rx, ry] }) => {
          const r = reveal(diyun[id]);
          return <div key={id} className={`qc-ghost${flare === id ? ' flare' : ''}`} style={{
            '--cx': `${cx}%`, '--cy': `${cy}%`, '--rx': `${rx}%`, '--ry': `${ry}%`,
            '--op': r.toFixed(2), '--bl': `${((1 - r) * 3).toFixed(1)}px`, '--ct': (0.7 + r * 0.3).toFixed(2),
          } as CSSProperties} />;
        })}
      </div>
      <div className="qc-banner">
        <div className="t" data-tip={TIP_GANWU}>修行感悟</div>
        <div className="lv">{lv}<small>级</small></div>
        <div className="e">挂机产出 <b>+{(GANWU_GAIN * lv).toFixed(1)}×</b><br /><span className="n">下一级 <b>+{GANWU_GAIN.toFixed(1)}×</b></span></div>
        <SealBuy price={ganwuPrice(lv + 1)} rep={s.reputation} onBuy={() => s.buyGanwu('one')} />
      </div>
      {XIANG.map(({ id, who, slip: [x, y] }) => {
        const d = DIYUN_MAP[id], n = diyun[id];
        return (
          <div key={id} className="qc-slip" style={{ left: `${x}%`, top: `${y}%` }}>
            <div className="nm" data-tip={`前世为${who}，散功重修，根骨不失`}>{d.name}</div>
            <div className="lv">{n}<small>级</small></div>
            <div className="cur">+{fmtV(diyunCum(d.first, n), d.kind)}</div>
            <div className="nx">下一级<b>+{fmtV(diyunGainAt(d.first, n + 1), d.kind)}</b></div>
            <SealBuy price={diyunPrice(n + 1)} rep={s.reputation} onBuy={() => { s.buyDiyun(id); setFlare(id); }} />
          </div>
        );
      })}
    </div>
  );
}

/** 机缘 · 江边挂签：十四支签挂在两根绳上，效果在悬停，已得盖「得」印 */
function Jiyuan(): JSX.Element {
  const s = useGameStore();
  const [stamped, setStamped] = useState<string | null>(null);
  return (
    <div className="qc-pic">
      <div className="bg" style={{ backgroundImage: `url('${ART}/jiyuan.jpg')` }} />
      {REP_NODES.map((n, i) => {
        const [x, y] = jiyuanSlipAt(i), owned = s.ownedRepNodes.includes(n.id);
        return (
          <div key={n.id} className={`qc-jslip${stamped === n.id ? ' stamp' : ''}`} data-tip={`${n.name}<br>${n.desc}`}
            style={{ left: `${x}%`, top: `${y}%`, '--dl': `${-i * 0.7}s` } as CSSProperties}>
            <div className="nm">{n.name}</div>
            <div className="ty">{n.type}</div>
            {owned ? <div className="got">得</div>
              : <SealBuy price={n.price} rep={s.reputation} onBuy={() => { s.buyRepNode(n.id); setStamped(n.id); }} />}
          </div>
        );
      })}
    </div>
  );
}

/** 侠名录 · 江湖百景：徽记散在四处地界，点选弹出手卷 */
function Xiaming({ stage }: { stage: RefObject<HTMLDivElement | null> }): JSX.Element {
  const s = useGameStore();
  const [sel, setSel] = useState<AchvId | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<AchvId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!sel) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('.qc-card, .qc-node')) setSel(null);
    };
    addEventListener('keydown', close);
    addEventListener('pointerdown', close);
    return () => { removeEventListener('keydown', close); removeEventListener('pointerdown', close); };
  }, [sel]);
  useLayoutEffect(() => {
    const el = sel && nodeRefs.current[sel], c = cardRef.current, st = stage.current;
    if (!el || !c || !st) { setPos(null); return; }
    const S = st.getBoundingClientRect(), r = el.getBoundingClientRect();
    setPos(cardAt({ left: r.left - S.left, top: r.top - S.top, bottom: r.bottom - S.top, cx: r.left - S.left + r.width / 2 },
      { w: c.offsetWidth, h: c.offsetHeight }, { w: S.width, h: S.height }));
  }, [sel, stage]);

  return (
    <>
      <div className="qc-pic">
        <div className="bg map" style={{ backgroundImage: `url('${ART}/xiaming-map.jpg')` }} />
        <div className="qc-veil" />
        <svg className="qc-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {ZONES.flatMap((z) => z.at.slice(1).map((b, i) => {
            const a = z.at[i], lit = achvTier(s, z.ids[i]) > 0 && achvTier(s, z.ids[i + 1]) > 0;
            return <path key={`${z.name}${i}`} className={lit ? 'lit' : undefined} d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} />;
          }))}
        </svg>
        {ZONES.map((z) => (
          <div key={z.name} className="qc-zone" style={{ left: `${z.label[0]}%`, top: `${z.label[1]}%` }}>
            {z.name}<small>{z.ids.reduce((n, id) => n + achvTier(s, id), 0)}/{z.ids.length * 3}</small>
          </div>
        ))}
        {ZONES.flatMap((z) => z.ids.map((id, i) => {
          const a = ACHV_MAP[id], t = achvTier(s, id);
          return (
            <button key={id} type="button" ref={(el) => { nodeRefs.current[id] = el; }} className={`qc-node t${t}${sel === id ? ' sel' : ''}`}
              style={{ left: `${z.at[i][0]}%`, top: `${z.at[i][1]}%` }} aria-expanded={sel === id}
              onClick={() => setSel(sel === id ? null : id)}>
              <span className="em"><img src={`${ART}/em/${id}.png`} alt="" />{t === 3 && <span className="seal">极</span>}</span>
              <span className="n">{a.tiers[Math.max(0, t - 1)]}</span>
            </button>
          );
        }))}
      </div>
      {sel && <AchvCard id={sel} ref={cardRef} pos={pos} />}
    </>
  );
}

function AchvCard({ id, pos, ref }: { id: AchvId; pos: { x: number; y: number } | null; ref: Ref<HTMLDivElement> }): JSX.Element {
  const s = useGameStore();
  const a = ACHV_MAP[id], t = achvTier(s, id), c = achvCount(s, id);
  return (
    <div ref={ref} className={`qc-card t${t}`} role="dialog" aria-label={a.tiers[Math.max(0, t - 1)]}
      style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}>
      <img src={`${ART}/em/${id}.png`} alt="" />
      <div className="tx">
        {t > 0 && <><span className="nm">【{a.tiers[t - 1]}】</span><em>{achvEffText(a, t)}</em><br /></>}
        {t < 3 ? <>
          下一重<span className="q">「{a.tiers[t]}」</span> <em>{achvEffText(a, t + 1)}</em><br />
          解锁条件：{a.what} <em>{fmtBig(Math.min(c, a.th[t]))}</em> / {fmtBig(a.th[t])}
        </> : <span className="full">三重俱满</span>}
      </div>
    </div>
  );
}
