/**
 * 修炼页 —— 视觉基准 docs/design/cultivate-redesign-prototype.html（2026-10-27 定稿）+ DESIGN.md「修炼页（外视 · 内视）」。
 * 外视：月下崖边一整幅画；月相即周天，身手与破境写在画上（题跋），伤势是画中血墨。
 * 内视：内经图式人影，经脉沿身体流动、穴位落在身上；右侧只写选中穴位的字与冲穴（左图右意）。
 * 数值一律出自 engine / store，几何与状态出自 cultivationSceneModel，本组件只拼文案与画。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { computeAttributes } from '../engine/attributes';
import { gearBonusOf } from '../engine/gear';
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, huohouRealms, zhaoshiLevel } from '../engine/content';
import { idleNeiliPerSec, paidThrough, zhoutianProgress } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import {
  INJURY_DEFS, INJURY_IDS, SEVERITY_HEAL_MIN, SEVERITY_NAME, SEVERITY_PRESS,
  freshInjuries, healRealmFactor, idleOutputMultiplier,
  type InjuryId, type Severity,
} from '../engine/injury';
import { SOUL_WEAK_MULT } from '../engine/reincarnation';
import {
  currentMult, effBreakCost, effIdleRate, huohouMultOf, qiMaxOf, retireKind, useGameStore,
  zhoutianN as zhoutianNOf,
} from '../store/gameStore';
import { NEIGONG, QI_COEF } from '../engine/neigong';
import { fmtBig, fmtRate } from '../fmt';
import { REALM_ACUPOINTS, isMeridianComplete, requiredMeridian, requiredMeridianOpened, totalAcupointBonus } from '../engine/acupoints';
import {
  INNER_H, INNER_W, SCENE_QI, buildSceneModel, cultLayout, defaultSelection, moonArc, moonLitPath, smoothPath,
  type CultLayout, type SceneMeridian, type SceneModel, type SceneStar,
} from '../components/cultivationSceneModel';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const MOON = '/zhoutian/moon-ink.png';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${+(v * 100).toFixed(1)}%`;
const pct2 = (v: number) => `${+(v * 100).toFixed(2)}%`;
const fmtNeili = (n: number): string => Math.ceil(n).toLocaleString('en-US');

/** 剩余时间的口语说法：按分钟 / 小时 / 天取整，不到一分钟说「片刻」 */
function fmtEta(sec: number): string {
  if (sec < 60) return '片刻';
  const min = sec / 60;
  if (min < 120) return `约 ${Math.ceil(min)} 分钟`;
  const h = min / 60;
  if (h < 48) return `约 ${Math.round(h)} 小时`;
  return `约 ${Math.round(h / 24)} 天`;
}
function fmtMin(min: number): string {
  const total = Math.max(0, Math.round(min * 60));
  const m = Math.floor(total / 60), sec = total % 60;
  return m > 0 ? `${m}分${String(sec).padStart(2, '0')}秒` : `${sec}秒`;
}

type State = ReturnType<typeof useGameStore.getState>;

/** 各伤型压了哪些属性（injury/spec.md §1 combat 列） */
const WOUND_HITS: Record<InjuryId, { attr: string; k: number }[]> = {
  wai: [{ attr: '防御', k: 1 }, { attr: '气血', k: 0.66 }],
  nei: [{ attr: '攻击', k: 1 }],
  du: [{ attr: '命中', k: 1 }, { attr: '闪避', k: 1 }],
};
/** 血墨在场景画里的落点（%）：内伤胸口、外伤袖口、毒伤手背 */
const BLOT_AT: Record<InjuryId, [number, number]> = { nei: [26.4, 48.5], wai: [20.6, 56.5], du: [31.6, 58.6] };

export function CultivatePane(): JSX.Element {
  const s = useGameStore();
  const breakCost = effBreakCost(s);
  const model = buildSceneModel({
    realm: s.realm, dantian: s.dantian, breakCost,
    chargeHighWater: s.chargeHighWater, acupointProgress: s.acupointProgress ?? {},
  });
  const [inner, setInner] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<CultLayout | null>(null);

  // 页自带画：收起页底图（同战斗页）
  useEffect(() => {
    document.documentElement.classList.add('cv-own-art');
    return () => document.documentElement.classList.remove('cv-own-art');
  }, []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setL(cultLayout(el.clientWidth, el.clientHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!inner) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setInner(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [inner]);
  const showInner = inner && model !== null;

  const vars = L ? {
    '--art-left': `${L.artLeft}px`, '--art-w': `${L.artW}px`,
    '--mx': `${L.moon.x}px`, '--my': `${L.moon.y}px`, '--md': `${L.moon.d}px`,
    '--tw': `${L.text.w}px`, '--ty': `${L.text.top}px`, '--fw': `${L.featherPct}%`,
    '--in-left': `${L.inner.left}px`, '--in-top': `${L.inner.top}px`, '--in-h': `${L.inner.h}px`,
    '--ox': `${SCENE_QI[0] * 100}%`, '--oy': `${SCENE_QI[1] * 100}%`,
  } as CSSProperties : undefined;

  return (
    <div className={`cv${showInner ? ' in' : ''}${L ? '' : ' unready'}`} ref={stageRef} style={vars}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="cv-bleed" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={7} />
          <feDisplacementMap in="SourceGraphic" scale={34} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="cv-art">
        {model && <QiMotes total={model.totalPct} onClick={() => setInner(true)} />}
        <Blots s={s} />
      </div>
      <div className="cv-fog" />
      <div className="cv-feather" />
      <div className="cv-rim" />
      <h1 className="cv-title">运转周天<span className="seal" aria-hidden="true">周天</span></h1>

      {model && breakCost !== null && <Moon s={s} model={model} breakCost={breakCost} />}
      <Inscription s={s} model={model} />

      {model && <InnerView s={s} model={model} active={showInner} onClose={() => setInner(false)} />}
    </div>
  );
}

// ─────────────────────────────── 丹田真气（外视入口）

function QiMotes({ total, onClick }: { total: number; onClick: () => void }) {
  const n = 2 + Math.round(total * 6);
  return (
    <button type="button" className="cv-qi" aria-label="内视丹田" onClick={onClick}
      style={{ '--glow': (0.25 + total * 0.6).toFixed(2) } as CSSProperties}>
      <span className="tint" /><span className="ring" />
      {Array.from({ length: n }, (_, i) => {
        const x0 = ((i * 37) % 30) - 15;
        return <i key={i} style={{
          '--x0': `${x0}px`, '--x1': `${x0 + ((i * 53) % 20) - 10}px`, '--d': `${3.2 + (i % 4) * 0.7}s`,
          '--dl': `${-(i * 0.9)}s`, '--op': (0.45 + total * 0.5).toFixed(2),
        } as CSSProperties} />;
      })}
      <span className="lbl">内视</span>
    </button>
  );
}

// ─────────────────────────────── 血墨（伤势长在画里）

function woundTip(id: InjuryId, sev: Severity, realm: number, healAccMin: number): string {
  const p = SEVERITY_PRESS[sev as Exclude<Severity, 0>];
  const eff = WOUND_HITS[id].map(h => `${h.attr === '气血' ? '气血上限' : h.attr} −${pct(p * h.k)}`).join(' · ');
  const need = SEVERITY_HEAL_MIN[sev as Exclude<Severity, 0>] * healRealmFactor(realm);
  const next = sev === 1 ? '痊愈' : `转为${SEVERITY_NAME[(sev - 1) as Severity]}伤`;
  return `${INJURY_DEFS[id].name} · ${SEVERITY_NAME[sev]}<br>${eff} · 挂机内力 −${pct(p * INJURY_DEFS[id].idleWeight)}`
    + `<br><span class='l'>${fmtMin(Math.max(0, need - healAccMin))}后${next} · 挂机静养，离线同样恢复</span>`;
}

function Blots({ s }: { s: State }) {
  const inj = s.injuries ?? freshInjuries();
  return (
    <>
      {INJURY_IDS.filter(id => inj[id].severity > 0).map(id => {
        const sev = inj[id].severity;
        return (
          <span key={id} className={`cv-blot ${id}`}
            style={{ left: `${BLOT_AT[id][0]}%`, top: `${BLOT_AT[id][1]}%`, width: `${3.2 + sev * 1.3}%`, '--a': 0.45 + sev * 0.15 } as CSSProperties}
            data-tip={woundTip(id, sev, s.realm, inj[id].healAccMin)} />
        );
      })}
    </>
  );
}

// ─────────────────────────────── 月相 = 周天

function MoonArc({ model, R, r }: { model: SceneModel; R: number; r: number }) {
  return (
    <g className="cv-arc">
      {moonArc(model.zhoutianCount, model.segmentsFull, model.currentSegmentPct, R).map((m, i) => (
        <g key={i} transform={`translate(${m.x} ${m.y})`}>
          <circle className="ring" r={r} />
          <image href={MOON} x={-r} y={-r} width={2 * r} height={2 * r} opacity={0.18} />
          {m.lit > 0 && <>
            <clipPath id={`cv-m${R}-${i}`}><path d={moonLitPath(m.lit, r)} /></clipPath>
            <image className={m.lit >= 1 ? 'full' : undefined} href={MOON} x={-r} y={-r} width={2 * r} height={2 * r} clipPath={`url(#cv-m${R}-${i})`} />
          </>}
        </g>
      ))}
    </g>
  );
}

function zhoutianLine(model: SceneModel): JSX.Element {
  return model.segmentsFull >= model.zhoutianCount
    ? <>周天圆满</>
    : <>第{CN[model.segmentsFull + 1] ?? model.segmentsFull + 1}周天<b>{Math.floor(model.currentSegmentPct * 100)}%</b></>;
}

function Moon({ s, model, breakCost }: { s: State; model: SceneModel; breakCost: number }) {
  const n = model.zhoutianCount;
  const done = model.segmentsFull >= n;
  const lit = done ? 1 : model.currentSegmentPct;
  const rate = effIdleRate(s);
  const p = zhoutianProgress(s.dantian, breakCost, n);
  const toSeg = done ? 0 : paidThrough(breakCost, n, p.segmentsFull + 1) - s.dantian;
  // 有伤 / 魂魄未稳时，挂机内力的来源分解也收进这里
  const inj = s.injuries ?? freshInjuries();
  const press = idleOutputMultiplier(inj) * (s.soulUnsettled ? SOUL_WEAK_MULT : 1);
  const src = press < 1
    ? `<br><span class='l'>挂机内力 +${fmtRate(idleNeiliPerSec(s.realm) * currentMult(s) * press)}/秒（伤势${s.soulUnsettled ? '与魂魄未稳' : ''}压制 −${pct(1 - press)}）</span>`
    : '';
  const tip = done
    ? `${CN[n]}周天圆满 · 丹田已满${src}`
    : `第${CN[p.segmentsFull + 1]}周天 ${Math.floor(model.currentSegmentPct * 100)}%<br>`
      + `<span class='l'>${rate > 0 ? `${fmtEta(toSeg / rate)}后本周天圆满 · ` : ''}${CN[n]}段周天逐段翻倍</span>${src}`;

  return (
    <div className="cv-moon" style={{ '--lit': 0.35 + lit * 0.65 } as CSSProperties}>
      <div className="halo" />
      <svg viewBox="-180 -180 360 360" aria-hidden="true">
        <image className="dark" href={MOON} x={-100} y={-100} width={200} height={200} />
        <clipPath id="cv-lit"><path d={moonLitPath(lit)} /></clipPath>
        <image className="lit" href={MOON} x={-100} y={-100} width={200} height={200} clipPath="url(#cv-lit)" />
        <MoonArc model={model} R={128} r={8} />
      </svg>
      <div className="hit" data-tip={tip} aria-label={`周天进度 ${done ? '圆满' : `${Math.floor(model.currentSegmentPct * 100)}%`}`} />
      <div className="cap">{zhoutianLine(model)}</div>
    </div>
  );
}

// ─────────────────────────────── 题跋：身手 + 破境

function Inscription({ s, model }: { s: State; model: SceneModel | null }) {
  return (
    <section className="cv-inscr">
      <Attrs s={s} />
      <div className="cv-stroke" />
      {model ? <Break s={s} model={model} /> : <Still s={s} />}
    </section>
  );
}

function acupointPctOf(s: State): number {
  const openedIds = new Set(Object.entries(s.acupointProgress ?? {}).filter(([, a]) => a.opened).map(([id]) => id));
  const data = REALM_ACUPOINTS[s.realm];
  const meridians = data ? data.meridians.filter(m => isMeridianComplete(m, openedIds)).length : 0;
  return totalAcupointBonus(s.realm, openedIds.size, meridians);
}

function Attrs({ s }: { s: State }) {
  const acupointPct = acupointPctOf(s);
  const hhMult = huohouMultOf(s);
  const gear = gearBonusOf(s.worn);
  const a = computeAttributes(s.realm, s.route, s.zhong, 0, acupointPct, hhMult, gear, s.diyun);
  const base = REALMS[s.realm - 1];
  const ng = s.neigong ? NEIGONG[s.neigong] : null;
  const route = s.route ? ROUTES[s.route] : null;
  const hhStat = Math.pow(1.7, s.route ? huohouRealms(s.zhong) * hhMult : 0);
  const qiMax = qiMaxOf(s);
  const dq = a.zones.diyun;

  // 三项主属性的推导：境界基础 · 内功逐重 · 源流赠予 · 窍穴经脉 · 十重以上火候 · 底蕴
  const statTip = (baseV: number, tempPct: number, grantPct: number, diyunPct = 0, extra: string[] = []): string => {
    const parts = [`境界基础 ${baseV}`];
    const ngPart = tempPct - acupointPct - grantPct;
    if (grantPct > 0) parts.push(`源流赠予 +${pct1(grantPct)}`);
    if (ngPart > 1e-9 && ng) parts.push(`${ng.name} 第 ${s.zhong} 重 +${pct1(ngPart)}`);
    if (acupointPct > 0) parts.push(`窍穴经脉 +${pct1(acupointPct)}`);
    if (hhStat > 1.0001) parts.push(`十重以上火候 ×${hhStat.toFixed(2)}`);
    if (diyunPct > 1e-9) parts.push(`底蕴 +${pct1(diyunPct)}`);
    return [...parts, ...extra].length > 1 ? [...parts, ...extra].join('<br>') : '';
  };
  const hitTip = (baseV: number, flat: number, diyunPct: number, gearFlat: number): string => {
    const parts = [`境界基础 ${baseV}`];
    if (flat > 1e-9) parts.push(`十重以上火候 +${+flat.toFixed(1)}`);
    if (diyunPct > 1e-9) parts.push(`底蕴 +${pct1(diyunPct)}`);
    if (gearFlat > 0) parts.push(`装备 +${+gearFlat.toFixed(1)}`);
    return parts.length > 1 ? parts.join('<br>') : '';
  };
  const critTip = (key: 'critRate' | 'critDmg', routePP: number, diyunPP: number, gearPP: number): string => {
    const baseV = key === 'critRate' ? BASE_CRIT_RATE : BASE_CRIT_DMG;
    const parts = [`基础 ${pct(baseV)}`];
    if (routePP > 1e-9) parts.push(`${route?.name ?? '源流'} +${pct1(routePP)}`);
    if (diyunPP > 1e-9) parts.push(`底蕴 +${pct1(diyunPP)}`);
    if (gearPP > 1e-9) parts.push(`装备 +${pct1(gearPP)}`);
    return a[key] - baseV < 1e-9 ? '' : parts.join('<br>');
  };
  const L = route ? zhaoshiLevel(s.zhong) : 0;
  const critRoutePP = (route?.grant.critRatePP ?? 0) + (route?.perLevel.critRatePP ?? 0) * L;
  const cdRoutePP = (route?.grant.critDmgPP ?? 0) + (route?.perLevel.critDmgPP ?? 0) * L;

  // 受伤压低的属性：数值直接变红，压了多少只写在悬停里
  const inj = s.injuries ?? freshInjuries();
  const hurt = new Map<string, string>();
  for (const id of INJURY_IDS) {
    const sev = inj[id].severity;
    if (sev === 0) continue;
    for (const h of WOUND_HITS[id]) {
      const line = `${INJURY_DEFS[id].name} · ${SEVERITY_NAME[sev]}　${h.attr} −${pct(SEVERITY_PRESS[sev as Exclude<Severity, 0>] * h.k)}`;
      hurt.set(h.attr, hurt.has(h.attr) ? `${hurt.get(h.attr)}<br>${line}` : line);
    }
  }

  const rows: [string, string, string][] = [
    ['气血', String(Math.round(a.hp)), statTip(base.hp, a.zones.hpTempPct, 0, dq.hpPct)],
    ['真气', qiMax > 0 ? String(qiMax) : '——',
      ng ? `(700 + 150 × (境界 − 2) + 10 × 重数) × 气海<br><span class='l'>(700 + 150 × ${Math.max(s.realm, 2) - 2} + 10 × ${s.zhong}) × ${ng.name}气海 ${QI_COEF[ng.quality].toFixed(1)}</span>`
        : '未修内功，尚无真气'],
    ['攻击', String(Math.round(a.atk)), statTip(base.atk, a.zones.atkTempPct, 0, dq.atkPct,
      a.basicAtkMult !== 1 ? [`普攻系数 ×${a.basicAtkMult.toFixed(2)}（轻手暗器）`] : [])],
    ['防御', String(Math.round(a.def)), statTip(base.def, a.zones.defTempPct, route?.grant.defPct ?? 0, dq.defPct)],
    ['命中', String(Math.round(a.accuracy)), hitTip(base.accuracy, a.zones.hitFlat, dq.hitPct, gear.hit)],
    ['闪避', String(Math.round(a.evasion)), hitTip(base.evasion, a.zones.dodgeFlat, dq.dodgePct, gear.dodge)],
    ['会心率', pct1(a.critRate), critTip('critRate', critRoutePP, dq.critPP, gear.critPP / 100)],
    ['会心伤害', pct(a.critDmg), critTip('critDmg', cdRoutePP, dq.cdPP, gear.cdPP / 100)],
  ];

  return (
    <>
      <div className="cv-hd"><h2>身手</h2></div>
      <dl className="cv-attrs">
        {rows.map(([k, v, tip]) => {
          const h = hurt.get(k);
          const full = [h ? `<span class='hurt'>${h}</span>` : '', tip].filter(Boolean).join('<br>');
          return (
            <div className="r" key={k}>
              <dt>{k}</dt>
              <dd className={`${h ? 'hit' : ''}${v === '——' ? ' none' : ''}`} data-tip={full || undefined}>{v}</dd>
            </div>
          );
        })}
      </dl>
      {ng && (
        <div className="cv-ng">
          {ng.name} · 第 {s.zhong} 重 ·{' '}
          <button type="button" onClick={() => useGameStore.setState({ pendingTab: 'neigong' })}>详情</button>
        </div>
      )}
    </>
  );
}

const Check = () => <span className="sq" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.6l3 3 6-7.2" /></svg></span>;

function Break({ s, model }: { s: State; model: SceneModel }) {
  const breakCost = effBreakCost(s)!;
  const cur = REALMS[s.realm - 1];
  const next = REALMS[s.realm];
  const n = zhoutianNOf(s.realm);
  const dantianReady = model.segmentsFull >= n;
  // 双条件（design.md §4）：N 段缴清 且 本境界首条经脉贯通；与 gameStore.breakthrough 同口径
  const req = requiredMeridian(s.realm);
  const merOpened = requiredMeridianOpened(s.realm, s.acupointProgress ?? {});
  const meridianReady = req === null || merOpened >= req.acupointIds.length;
  const ready = dantianReady && meridianReady;
  const rate = effIdleRate(s);
  const label = ready
    ? `突破 · ${next.name}`
    : dantianReady && req
      ? `${req.name} 未贯通（${merOpened}/${req.acupointIds.length}）`   // 冻结文案 §5
      : `${rate > 0 ? `${fmtEta((breakCost - s.dantian) / rate)}后可突破` : '运转周天中…'}`;

  return (
    <>
      <div className="cv-hd"><h2>破境</h2><small>{cur.name}<em>→</em>{next.name}</small></div>
      <div className="cv-cond">
        <div className={`c${dantianReady ? ' ok' : ''}`}><Check />{CN[n] ?? n}段周天圆满<b>{Math.min(model.segmentsFull, n)}/{n}</b></div>
        {req && <div className={`c${meridianReady ? ' ok' : ''}`}><Check />{req.name}贯通<b>{merOpened}/{req.acupointIds.length}</b></div>}
      </div>
      <button type="button" className={`cv-scroll${ready ? ' ready' : ''}`} disabled={!ready} onClick={s.breakthrough}>
        {ready ? '突破' : label}
      </button>
    </>
  );
}

/** 境界圆满（本版终点）：无周天，给出转世入口 */
function Still({ s }: { s: State }) {
  return (
    <>
      <div className="cv-hd"><h2>破境</h2><small>小周天圆满</small></div>
      <p className="cv-still">任督俱通，大周天未开。</p>
      {retireKind(s) !== null && <button type="button" className="cv-scroll ready" onClick={s.openRetire}>就此转世</button>}
    </>
  );
}

// ─────────────────────────────── 内视：内经图 + 冲穴

/** 太极 / 朱砂圈 / 墨圈三态穴位图标，身上用 */
function AcuGlyph() {
  return (
    <svg className="tj" viewBox="-13 -13 26 26" aria-hidden="true">
      <circle className="rip" r={6} /><circle className="rip r2" r={6} /><circle className="ring" r={6} /><circle className="core" r={2.2} />
      <g className="yy">
        <circle r={8} fill="oklch(0.18 0.02 70)" />
        <path d="M0,-8 A8,8 0 0,1 0,8 A4,4 0 0,1 0,0 A4,4 0 0,0 0,-8Z" fill="oklch(0.86 0.12 80)" />
        <circle cy={-4} r={1.3} fill="oklch(0.86 0.12 80)" /><circle cy={4} r={1.3} fill="oklch(0.18 0.02 70)" />
        <circle r={8} fill="none" stroke="oklch(0.86 0.12 80)" strokeWidth={0.8} />
      </g>
    </svg>
  );
}

const STAR_CLS: Record<SceneStar['state'], string> = { dim: 'dim', actionable: 'act', opened: 'open' };
type Float = { key: number; text: string; ok: boolean; x: number; y: number };

function InnerView({ s, model, active, onClose }: { s: State; model: SceneModel; active: boolean; onClose: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const fkey = useRef(0);
  // 每次进内视重新落到默认穴
  useEffect(() => { if (active) setSel(defaultSelection(model)); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = model.meridians.flatMap(m => m.stars.map(st => ({ m, st })));
  const cur = all.find(v => v.st.id === sel) ?? all.find(v => v.st.id === defaultSelection(model)) ?? null;

  const chong = (m: SceneMeridian, st: SceneStar): void => {
    s.attemptAcupoint(st.id);
    const opened = useGameStore.getState().acupointProgress?.[st.id]?.opened ?? false;
    const through = opened && m.stars.every(v => v.id === st.id || v.state === 'opened');
    const k = ++fkey.current;
    setFloats(f => [...f, { key: k, text: through ? '经脉贯通' : opened ? '已通' : '未通', ok: opened, x: st.x, y: st.y }]);
    setTimeout(() => setFloats(f => f.filter(v => v.key !== k)), 1700);
    if (opened) {
      // 通了就落到本脉下一穴；本脉贯通则重新挑默认
      const after = buildSceneModel({
        realm: s.realm, dantian: useGameStore.getState().dantian, breakCost: effBreakCost(useGameStore.getState()),
        chargeHighWater: useGameStore.getState().chargeHighWater, acupointProgress: useGameStore.getState().acupointProgress ?? {},
      });
      const nextInMer = m.stars.find(v => v.id !== st.id && v.state !== 'opened');
      setSel(nextInMer?.id ?? (after ? defaultSelection(after) : null));
    }
  };

  const opened = model.meridians.reduce((a, m) => a + m.stars.filter(v => v.state === 'opened').length, 0);
  const total = model.meridians.reduce((a, m) => a + m.stars.length, 0);
  const through = model.meridians.filter(m => m.through).length;
  const allOpened = Object.values(s.acupointProgress ?? {}).filter(a => a.opened).length;
  const bonus = acupointPctOf(s);

  return (
    <>
      <div className="cv-inner" aria-hidden={!active} style={{ '--f': model.segmentsFull >= model.zhoutianCount ? 1 : model.currentSegmentPct } as CSSProperties}>
        <div className="img" />
        <div className="pool" />
        <svg className="ch" viewBox={`0 0 ${INNER_W} ${INNER_H}`} preserveAspectRatio="none" aria-hidden="true">
          {model.meridians.map(m => (
            <g key={m.id} className={`mg${cur && cur.m.id !== m.id ? ' far' : ''}`}>
              <path className="chan" d={smoothPath(m.route)} />
              {m.litRoute.length > 1 && <>
                <path className="qglow" d={smoothPath(m.litRoute)} />
                <path className="qcore" d={smoothPath(m.litRoute)} />
                <path className="qmote" d={smoothPath(m.litRoute)} />
              </>}
            </g>
          ))}
        </svg>
        <div className="crown"><svg viewBox="-180 -180 360 360" aria-hidden="true"><MoonArc model={model} R={150} r={13} /></svg></div>
        <div className="zread">{zhoutianLine(model)}</div>
        {model.meridians.map(m => {
          const far = cur && cur.m.id !== m.id ? ' far' : '';
          return (
            <div key={m.id}>
              <div className={`mname${far}${m.through ? ' thr' : ''}`} style={{ left: `${(m.label[0] / INNER_W) * 100}%`, top: `${(m.label[1] / INNER_H) * 100}%` }}>{m.name}</div>
              {m.stars.map(st => (
                <button key={st.id} type="button"
                  className={`acu ${STAR_CLS[st.state]} ${st.side}${far}${cur?.st.id === st.id ? ' sel' : ''}`}
                  style={{ left: `${(st.x / INNER_W) * 100}%`, top: `${(st.y / INNER_H) * 100}%` }}
                  aria-label={`${st.name}${st.state === 'opened' ? ' 已通' : ''}`} aria-pressed={cur?.st.id === st.id}
                  tabIndex={active ? 0 : -1} onClick={() => setSel(st.id)}>
                  <AcuGlyph /><span>{st.name}</span>
                </button>
              ))}
            </div>
          );
        })}
        {floats.map(f => (
          <div key={f.key} className={`float ${f.ok ? 'ok' : 'no'}`} style={{ left: `${(f.x / INNER_W) * 100}%`, top: `${(f.y / INNER_H) * 100}%` }}>{f.text}</div>
        ))}
      </div>

      <section className="cv-ledger" aria-hidden={!active}>
        <div className="sum">
          窍穴 <b>{opened}/{total}</b><i>·</i>经脉 <b>{through}/{model.meridians.length}</b><i>·</i>修炼加成{' '}
          <b className="g" data-tip={`已通窍穴 ${allOpened} 处 × ${pct2(model.perAcupoint)}<br>贯通经脉 ${through} 条 × ${pct2(model.perMeridian)}<br><span class='l'>加在气血、攻击、防御上</span>`}>+{pct2(bonus)}</b>
        </div>
        <div className="mlist">
          {model.meridians.map(m => {
            const on = m.stars.filter(v => v.state === 'opened').length;
            return (
              <button key={m.id} type="button" tabIndex={active ? 0 : -1}
                className={`mrow${cur?.m.id === m.id ? ' on' : ''}${m.through ? ' thr' : ''}`}
                onClick={() => setSel((m.stars.find(v => v.state !== 'opened') ?? m.stars[m.stars.length - 1]).id)}>
                <span className="mn">{m.name}</span>{m.through && <span className="mtag">贯通</span>}<span className="mp">{on}/{m.stars.length}</span>
              </button>
            );
          })}
        </div>
        {cur && <Inspector m={cur.m} st={cur.st} model={model} active={active} onChong={() => chong(cur.m, cur.st)} />}
        <button type="button" className="cv-ghost" tabIndex={active ? 0 : -1} onClick={onClose}>收功</button>
      </section>
    </>
  );
}

function Inspector({ m, st, model, active, onChong }: { m: SceneMeridian; st: SceneStar; model: SceneModel; active: boolean; onChong: () => void }) {
  const idx = m.stars.indexOf(st);
  const last = st.state !== 'opened' && m.stars.every(v => v === st || v.state === 'opened');
  // 不可冲时按具体原因给话——三种原因玩家的下一步动作完全不同（冻结文案 §1）
  const gateText = st.gate === 'not-loosened' ? '内力未至 · 运转周天'
    : st.gate === 'prev-unopened' ? `${st.blockedBy} 未通 · 循序而行`
      : st.gate === 'insufficient' ? `内力未足 · 蓄至 ${fmtBig(st.neiliCost)} 方可冲` : '';
  return (
    <div className="insp">
      <div className="ih"><h2>{st.name}</h2><small>{m.name} · 第{CN[idx + 1]}穴</small></div>
      <dl className="kv">
        <div><dt>效果</dt><dd>气血 攻击 防御 +{pct2(model.perAcupoint)}</dd></div>
        {last && <div><dt>贯通后</dt><dd>{m.name}再 +{pct2(model.perMeridian)}</dd></div>}
        {st.state !== 'opened' && <div><dt>消耗内力</dt><dd>{fmtNeili(st.neiliCost)}</dd></div>}
      </dl>
      {st.state === 'opened'
        ? <div className="btn-gap" />
        : st.state === 'actionable'
          ? <button type="button" className="cv-scroll ready" tabIndex={active ? 0 : -1} onClick={onChong} data-tip={`成功率 ${pct(st.rate)}`}>冲穴</button>
          : <button type="button" className="cv-scroll" disabled>{gateText.split(' · ').map((t, i) => <span key={i} className="ln">{t}</span>)}</button>}
    </div>
  );
}
