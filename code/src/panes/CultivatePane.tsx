/**
 * 修炼页 —— 视觉基准 docs/design/ui-overhaul-prototype.html `#p-cultivate`（issue #26 定稿）。
 * 左主栏：周天场景 + 月相读数 + 燃香进度；右侧栏：身手 → 破境 → 伤势（有伤才出现，排最下）。
 * 数值一律出自 engine / store，本组件只拼文案；推导公式放进悬停（data-tip）。
 */
import type { CSSProperties } from 'react';
import { WoundPanel } from '../components/WoundPanel';
import { freshInjuries } from '../engine/injury';
import { computeAttributes, type FinalAttributes } from '../engine/attributes';
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, huohouRealms } from '../engine/content';
import { paidThrough, segmentQuotas, zhoutianProgress } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import {
  currentMult, effBreakCost, effIdleRate, huohouMultOf, qiMaxOf, retireKind, useGameStore,
  zhoutianN as zhoutianNOf,
} from '../store/gameStore';
import { NEIGONG, QI_COEF } from '../engine/neigong';
import { fmtBig } from '../fmt';
import {
  REALM_ACUPOINTS, totalAcupointBonus, isMeridianComplete, openedInRealm,
  requiredMeridian, requiredMeridianOpened,
} from '../engine/acupoints';
import { CultivationScene } from '../components/CultivationScene';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${+(v * 100).toFixed(1)}%`;

/** 剩余时间的口语说法：按分钟 / 小时 / 天取整，不到一分钟说「片刻」 */
function fmtEta(sec: number): string {
  if (sec < 60) return '片刻';
  const min = sec / 60;
  if (min < 120) return `约 ${Math.ceil(min)} 分钟`;
  const h = min / 60;
  if (h < 48) return `约 ${Math.round(h)} 小时`;
  return `约 ${Math.round(h / 24)} 天`;
}

type State = ReturnType<typeof useGameStore.getState>;

export function CultivatePane() {
  const s = useGameStore();
  const breakCost = effBreakCost(s);

  // 窍穴/贯通加成（spec §9：加法合并进临时加成）。两套口径不可混用：
  // 加成按全局累计（窍穴加成保留至转世，design.md §5 D1），账目与突破条件按本境界（design.md §4）。
  const acupointData = REALM_ACUPOINTS[s.realm];
  const openedIds = new Set(
    Object.entries(s.acupointProgress ?? {}).filter(([, a]) => a.opened).map(([id]) => id),
  );
  const meridianCount = acupointData
    ? acupointData.meridians.filter(m => isMeridianComplete(m, openedIds)).length
    : 0;
  const acupointPct = totalAcupointBonus(s.realm, openedIds.size, meridianCount);

  return (
    <>
      <header className="jh-head"><div><h1>运转周天</h1></div></header>
      <div className="cult">
        <div className="cult-main">
          <CultivationScene />
          {breakCost !== null && <ZhoutianRead s={s} breakCost={breakCost} />}
        </div>
        <aside className="cult-side">
          <AttrCard s={s} acupointPct={acupointPct} />
          {breakCost !== null
            ? <BreakCard s={s} breakCost={breakCost} meridianCount={meridianCount} acupointPct={acupointPct} />
            : <StillCard s={s} />}
          <WoundPanel
            injuries={s.injuries ?? freshInjuries()} realm={s.realm}
            soulUnsettled={s.soulUnsettled ?? false} outMult={currentMult(s)}
          />
        </aside>
      </div>
    </>
  );
}

// ─────────────────────────────── 月相读数 + 燃香

function ZhoutianRead({ s, breakCost }: { s: State; breakCost: number }) {
  const n = zhoutianNOf(s.realm);
  const p = zhoutianProgress(s.dantian, breakCost, n);
  const done = p.segmentsFull >= n;
  const total = done ? 1 : (p.segmentsFull + p.currentSegmentPct) / n;
  const rate = effIdleRate(s);
  // 本周天圆满还差：到下一段刻度的内力 ÷ 当前速率
  const toSeg = done ? 0 : paidThrough(breakCost, n, p.segmentsFull + 1) - s.dantian;
  // 本段账目与月相同口径（按丹田推算），否则冲穴扣款后会出现「47% 但本段 0」
  const segIdx = Math.min(p.segmentsFull, n - 1);
  const segQuota = segmentQuotas(breakCost, n)[segIdx];
  const segNeili = Math.max(0, Math.min(s.dantian, breakCost) - paidThrough(breakCost, n, segIdx));
  const tip = `本段 <b>${fmtBig(segNeili)}</b> / ${fmtBig(segQuota)} 内力<br>`
    + `<span class='l'>${CN[n] ?? n}段周天逐段翻倍，突破共需 ${fmtBig(breakCost)}</span>`;

  return (
    <>
      <div className="zt-read">
        <div className="moons" aria-hidden="true">
          {Array.from({ length: n }, (_, i) =>
            i < p.segmentsFull ? <i key={i} className="full" />
              : i === p.segmentsFull
                ? <i key={i} className="wax" style={{ '--fill-inv': `${(1 - p.currentSegmentPct) * 100}%` } as CSSProperties} />
                : <i key={i} />)}
        </div>
        <div className="t">
          {done ? '周天圆满' : <>第{CN[p.segmentsFull + 1] ?? p.segmentsFull + 1}周天<b>{Math.floor(p.currentSegmentPct * 100)}%</b></>}
        </div>
        <div className="eta">
          {done ? '丹田已满' : rate > 0 ? `${fmtEta(toSeg / rate)}后本周天圆满` : ''}
        </div>
      </div>
      <div className={`incense${done ? ' done' : ''}`} data-tip={tip}>
        <div className="ash" style={{ width: `${total * 100}%` }} />
        <div className="stick" style={{ width: `${100 - total * 100}%` }} />
        {Array.from({ length: n - 1 }, (_, i) => (
          <span key={i} className="tick" style={{ left: `${((i + 1) / n) * 100}%` }} />
        ))}
        <div className="smoke" style={{ left: `${total * 100}%` }} />
        <div className="ember" style={{ left: `${total * 100}%` }} />
      </div>
    </>
  );
}

// ─────────────────────────────── 身手

function AttrCard({ s, acupointPct }: { s: State; acupointPct: number }) {
  const hhMult = huohouMultOf(s);
  const a = computeAttributes(s.realm, s.route, s.zhong, 0, acupointPct, hhMult);
  const base = REALMS[s.realm - 1];
  const ng = s.neigong ? NEIGONG[s.neigong] : null;
  const route = s.route ? ROUTES[s.route] : null;
  const dx = s.route ? huohouRealms(s.zhong) * hhMult : 0;
  const hhStat = Math.pow(1.7, dx);
  const qiMax = qiMaxOf(s);

  // 三项主属性的推导：境界基础 · 内功逐重 · 路数赠予 · 窍穴经脉 · 十重以上火候
  const statTip = (baseV: number, tempPct: number, grantPct: number, extra: string[] = []): string => {
    const parts = [`境界基础 ${baseV}`];
    const ngPart = tempPct - acupointPct - grantPct;
    if (grantPct > 0) parts.push(`路数赠予 +${pct1(grantPct)}`);
    if (ngPart > 1e-9 && ng) parts.push(`${ng.name} 第 ${s.zhong} 重 +${pct1(ngPart)}`);
    if (acupointPct > 0) parts.push(`窍穴经脉 +${pct1(acupointPct)}`);
    if (hhStat > 1.0001) parts.push(`十重以上火候 ×${hhStat.toFixed(2)}`);
    return [...parts, ...extra].length > 1 ? [...parts, ...extra].join('<br>') : '';
  };
  const grantDef = route?.grant.defPct ?? 0;
  const rows: [string, string, string][] = [
    ['气血', String(a.hp), statTip(base.hp, a.zones.hpTempPct, 0)],
    ['真气', qiMax > 0 ? String(qiMax) : '——',
      ng ? `(70 + 15 × (境界 − 2) + 重数) × 气海<br><span class='l'>(70 + 15 × ${Math.max(s.realm, 2) - 2} + ${s.zhong}) × ${ng.name}气海 ${QI_COEF[ng.quality].toFixed(1)}</span>`
        : '未修内功，尚无真气'],
    ['攻击', String(a.atk), statTip(base.atk, a.zones.atkTempPct, 0,
      a.basicAtkMult !== 1 ? [`普攻系数 ×${a.basicAtkMult.toFixed(2)}（轻手暗器）`] : [])],
    ['防御', String(a.def), statTip(base.def, a.zones.defTempPct, grantDef)],
    ['命中', String(a.accuracy), a.accuracy !== base.accuracy ? `境界基础 ${base.accuracy}<br>十重以上火候 +${+(a.accuracy - base.accuracy).toFixed(1)}` : ''],
    ['闪避', String(a.evasion), a.evasion !== base.evasion ? `境界基础 ${base.evasion}<br>十重以上火候 +${+(a.evasion - base.evasion).toFixed(1)}` : ''],
    ['暴击率', pct1(a.critRate), critTip(a, 'critRate', route?.name)],
    ['暴击伤害', pct(a.critDmg), critTip(a, 'critDmg', route?.name)],
  ];

  return (
    <div className="jh-card">
      <div className="head"><span className="serif">身手</span></div>
      <dl className="attr-list">
        {rows.map(([k, v, tip]) => (
          <div className="r" key={k}>
            <dt>{k}</dt>
            <dd className={`${tip && v !== '——' ? 'jh-dotted' : ''}${v === '——' ? ' none' : ''}`} data-tip={tip || undefined}>{v}</dd>
          </div>
        ))}
      </dl>
      {ng && (
        <div className="attr-foot">
          内功 {ng.name} · 第 {s.zhong} 重 ·{' '}
          <button type="button" onClick={() => useGameStore.setState({ pendingTab: 'neigong' })}>详情</button>
        </div>
      )}
    </div>
  );
}

function critTip(a: FinalAttributes, key: 'critRate' | 'critDmg', routeName?: string): string {
  const baseV = key === 'critRate' ? BASE_CRIT_RATE : BASE_CRIT_DMG;
  const diff = a[key] - baseV;
  if (diff < 1e-9) return '';
  return `基础 ${pct(baseV)}<br>${routeName ?? '路数'}（路数赠予与逐重）+${pct1(diff)}`;
}

// ─────────────────────────────── 破境

function BreakCard({ s, breakCost, meridianCount, acupointPct }: {
  s: State; breakCost: number; meridianCount: number; acupointPct: number;
}) {
  const cur = REALMS[s.realm - 1];
  const next = REALMS[s.realm];
  const n = zhoutianNOf(s.realm);
  const p = zhoutianProgress(s.dantian, breakCost, n);
  const dantianReady = p.ready;
  // 双条件（design.md §4）：N 段缴清 且 本境界首条经脉贯通；与 gameStore.breakthrough 同口径
  const progress = s.acupointProgress ?? {};
  const req = requiredMeridian(s.realm);
  const merOpened = requiredMeridianOpened(s.realm, progress);
  const meridianReady = req === null || merOpened >= req.acupointIds.length;
  const ready = dantianReady && meridianReady;
  const acupointData = REALM_ACUPOINTS[s.realm];
  const rate = effIdleRate(s);

  const label = ready
    ? `突破 · ${next.name}`
    : dantianReady && req
      ? `${req.name} 未贯通（${merOpened}/${req.acupointIds.length}）`   // 冻结文案 §5
      : `周天运转中${rate > 0 ? ` · ${fmtEta((breakCost - s.dantian) / rate)}后可突破` : ''}`;

  return (
    <div className="jh-card break-card">
      <div className="head"><span className="serif">破境</span><small>{cur.name} → {next.name}</small></div>
      <div className="cond">
        <span className={dantianReady ? 'ok' : 'no'}>{CN[n] ?? n}段周天圆满 <b>{Math.min(p.segmentsFull, n)}/{n}</b></span>
        {req && (
          <span className={meridianReady ? 'ok' : 'no'}>{req.name}贯通 <b>{merOpened}/{req.acupointIds.length}</b></span>
        )}
      </div>
      {acupointData ? (
        <div className="acu-ledger">
          <span>窍穴<b>{openedInRealm(s.realm, progress)}/{cur.acupointPoolSize}</b></span>
          <span>经脉<b>{meridianCount}/{acupointData.meridians.length}</b></span>
          <span>修炼加成<b className="gold">+{pct(acupointPct)}</b></span>
        </div>
      ) : <div style={{ height: 16 }} />}
      <button type="button" className="jh-btn breathe" disabled={!ready} onClick={s.breakthrough}>{label}</button>
    </div>
  );
}

/** 境界圆满（本版终点）：无周天，给出转世入口 */
function StillCard({ s }: { s: State }) {
  return (
    <div className="jh-card break-card">
      <div className="head"><span className="serif">破境</span><small>小周天圆满</small></div>
      <p className="still">任督俱通，小周天至此圆满。大周天未开——这一版的修行到此为止。</p>
      {retireKind(s) !== null && (
        <button type="button" className="jh-btn" onClick={s.openRetire}>就此转世</button>
      )}
    </div>
  );
}
