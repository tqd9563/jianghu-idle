/**
 * 内功页 —— docs/design/ui-overhaul-prototype.html `#p-neigong` 的实现（issue #26 视觉大改）。
 * 页头（内功名 + 品质 + 路数风格、第 N 重）→ 五关节点路 → 精进一重 → 心法要诀 → 藏经（书册陈列 + 详情 + 转修）。
 * 真气已移到修炼页；推导公式一律放进悬停。数值出自 sect-neigong/spec.md §1。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { assertNever } from '../engine/exhaustive';
import type { Build } from '../engine/combat';
import { HUOHOU_PER_REALM, zhaoshiLevel, type RouteId } from '../engine/content';
import {
  DUNWU_INTERVAL_SEC, NEIGONG, QI_COEF, QUALITY_ORDER, TIERS, TIER_COUNT, dunwuChance, foldRealms, neigongBuild, qiMax,
  switchFee, zhongAfterSwitch, zhongCost, type NeigongId, type Quality,
} from '../engine/neigong';
import { ROUTES } from '../engine/routes';
import { SECTS } from '../engine/sect';
import { playerBuild, useGameStore, zhongGate } from '../store/gameStore';
import { fmtBig } from '../fmt';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${(v * 100).toFixed(1)}pp`;
const Q_NO: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
/** 路数的风格词：页头品质标签后面那一个词 */
const LU_STYLE: Record<RouteId, string> = { huashan: '爆发', shaolin: '护体', tangmen: '阴毒' };
const ROUTE_ORDER: RouteId[] = ['huashan', 'shaolin', 'tangmen'];
const qiCoef = (q: Quality) => QI_COEF[q].toFixed(1);

/** 该品质最高可至的关：寻常大成（第 6 重）/ 上乘化境（第 20 重）/ 绝学归真（第 40 重） */
function peakOf(q: Quality) {
  const t = TIERS[TIER_COUNT[q] - 1];
  return `${t.name}（第 ${t.at} 重）`;
}

export function NeigongPane() {
  const s = useGameStore();
  const ng = NEIGONG[s.neigong!];
  const gate = zhongGate(s);
  const cost = zhongCost(s.zhong + 1);
  const short = cost - s.dantian;
  const fold = foldRealms(s.zhong, ng.quality);
  const passed = s.tiersPassed;
  const reach = TIER_COUNT[ng.quality];
  const wuxing = s.wuxing ?? 1;

  // 节点路：已过的节点实线连起，朝下一关按重数走一段；节点间距 20%，首尾各留 10%
  const walked = (() => {
    if (passed === 0) return 0;
    if (passed >= reach) return (reach - 1) * 20;
    const from = TIERS[passed - 1].at, to = TIERS[passed].at;
    const f = Math.max(0, Math.min(1, (s.zhong - from) / (to - from)));
    return (passed - 1 + f) * 20;
  })();

  // 精进按钮下的一句提示：临关 / 缺卷册 / 离下一关还有几重
  const nextTier = passed < reach ? TIERS[passed] : null;
  let note: ReactNode = null;
  if (gate && !gate.needScroll) {
    const p = dunwuChance(gate.tier, wuxing);
    const hours = DUNWU_INTERVAL_SEC / p / 3600;
    const expect = hours < 1 ? `${Math.round(hours * 60)} 分钟` : `${hours.toFixed(1)} 小时`;
    note = (
      <span className="jh-dotted" data-tip={`挂机修炼每 10 分钟一判，此刻概率 ${(p * 100).toFixed(1)}%（${Math.round(gate.tier.p * 100)}% × 悟性 ${wuxing.toFixed(2)}），期望约 ${expect}；闭关照判。<br>静候期间内力照常积累，不会浪费。`}>
        临「{gate.tier.name}」之关，需静候顿悟
      </span>
    );
  } else if (gate?.needScroll) {
    note = <>临「归真」之关，需先得《归真卷册》（{SECTS[ng.route].name}贡献商店 500 贡献），得册后方能顿悟</>;
  } else if (nextTier) {
    const left = nextTier.at - s.zhong;
    note = left === 1
      ? <>到第 {nextTier.at} 重即临「{nextTier.name}」之关，需静候顿悟才能再升</>
      : <>再精进 {left} 重，临「{nextTier.name}」之关</>;
  } else {
    note = <>{ng.quality}内功至「{TIERS[reach - 1].name}」已是尽头，此后每重仍长气血、攻击、防御</>;
  }

  const owned = [...(s.ownedNeigong ?? [])].sort((a, b) =>
    QUALITY_ORDER.indexOf(NEIGONG[b].quality) - QUALITY_ORDER.indexOf(NEIGONG[a].quality));
  const [cat, setCat] = useState<RouteId | 'all'>('all');
  const [cur, setCur] = useState<NeigongId>(s.neigong!);
  const [switchTo, setSwitchTo] = useState<NeigongId | null>(null);
  const cats = ROUTE_ORDER.filter((r) => owned.some((id) => NEIGONG[id].route === r));
  const shown = owned.filter((id) => cat === 'all' || NEIGONG[id].route === cat);
  const sel = owned.includes(cur) ? cur : s.neigong!;

  return (
    <>
      <div className="ng-top">
        <header className="jh-head">
          <div>
            <h1>{ng.name}</h1>
            <div className="sub"><span className={`jh-tag q${Q_NO[ng.quality]}`}>{ng.quality}</span>　{LU_STYLE[ng.route]}</div>
          </div>
        </header>
        <div className="ng-lv">
          <div className="z" data-tip={`火候折合 ${fold.toFixed(2)} 个境界：每 ${HUOHOU_PER_REALM} 重折合一个境界`}>
            第 {s.zhong}<small>重</small>
          </div>
        </div>
      </div>

      <div className="ng-ladder" role="list" aria-label="五关">
        <div className="walked" style={{ width: `${walked}%` }} />
        {TIERS.map((t, i) => {
          const na = i >= reach;
          const done = i < passed;
          const wait = !na && i === passed;
          return (
            <div key={t.name} role="listitem" className={`ng-node${done ? ' done' : wait ? ' wait' : na ? ' na' : ''}`}>
              <span className="k">{done ? '✓' : i + 1}</span>
              <span className="n">{t.name}</span>
              <span className="z">第 {t.at} 重</span>
              <span className="e">{t.effect[ng.route]}{na ? (i === 3 ? ' · 上乘可达' : ' · 绝学可达') : ''}</span>
            </div>
          );
        })}
      </div>

      <div className="ng-act">
        <button
          className="jh-btn"
          disabled={!!gate || short > 0}
          onClick={s.upgradeZhong}
          data-tip={`十重以内按路数逐重加成，此后每重气血、攻击、防御约 +2.7%；价格每重 ×1.08。<br>重数只在这一世有效，转世即散。`}
        >
          {gate ? (gate.needScroll ? '缺《归真卷册》' : '静候顿悟') : '精进一重'}
          <small>{gate ? '内力照常积累' : `${fmtBig(cost)} 内力${short > 0 ? ` · 还差 ${fmtBig(short)}` : ''}`}</small>
        </button>
        <span className="note">{note}</span>
      </div>

      <div className="jh-card">
        <div className="head">
          <span className="serif">心法要诀</span>
          {s.zhong > 0 && (
            <small className="jh-dotted" data-tip={`第 1–10 重逐重加成（已计 ${zhaoshiLevel(s.zhong)} 重）：<br>${zhongEffectsText(ng.route, zhaoshiLevel(s.zhong))}`}>
              逐重加成
            </small>
          )}
        </div>
        <ul className="ng-mech">
          <RouteMechList routeId={ng.route} zhong={s.zhong} build={playerBuild(s)} />
          <QiSeaLine q={ng.quality} realm={s.realm} zhong={s.zhong} />
        </ul>
      </div>

      <div className="gf-shelf-head">
        <h2 className="jh-sec">藏经</h2>
        {cats.length > 1 && (
          <div className="jh-seg" role="group" aria-label="按路数筛选">
            <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>全部<small>{owned.length}</small></button>
            {cats.map((r) => (
              <button key={r} aria-pressed={cat === r} onClick={() => setCat(r)}>
                {ROUTES[r].name}<small>{owned.filter((id) => NEIGONG[id].route === r).length}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ng-scrolls">
        {shown.map((id) => {
          const d = NEIGONG[id];
          return (
            <button key={id} className={`ng-book q${Q_NO[d.quality]}`} aria-current={id === sel} onClick={() => setCur(id)}>
              {id === s.neigong && <span className="on">主修</span>}
              <span className="t">{d.name}</span>
              <small>{d.quality} · {ROUTES[d.route].name}</small>
            </button>
          );
        })}
      </div>
      <NeigongDetail id={sel} onSwitch={setSwitchTo} />

      {switchTo && <SwitchDialog to={switchTo} onClose={() => setSwitchTo(null)} />}
    </>
  );
}

/** 藏经里选中那本的详情：主修显示当前生效值，其它显示初练时的样子 */
function NeigongDetail({ id, onSwitch }: { id: NeigongId; onSwitch: (id: NeigongId) => void }) {
  const s = useGameStore();
  const d = NEIGONG[id];
  const main = id === s.neigong;
  const same = d.route === NEIGONG[s.neigong!].route;
  const zhong = main ? s.zhong : 0;
  const build = main ? playerBuild(s) : neigongBuild(id, s.realm, 0, 0);
  return (
    <div className="jh-card ng-detail">
      <div className="head">
        <span className="ttl">
          <span className="serif big">{d.name}</span>
          <span className={`jh-tag q${Q_NO[d.quality]}`}>{d.quality}</span>
        </span>
        {main ? <span className="ng-cur">主修中</span>
          : same ? <button className="jh-btn2" onClick={() => onSwitch(id)}>转修 · 保留八成功力</button>
            : <button className="jh-btn2 quiet" onClick={() => onSwitch(id)}>散功重修</button>}
      </div>
      <div className="ng-facts">
        <span>最高可至 <b>{peakOf(d.quality)}</b></span>
        <span data-tip="真气上限的倍率">气海 <b>×{qiCoef(d.quality)}</b></span>
        {!main && <span>初练时的心法如下</span>}
      </div>
      <ul className="ng-mech">
        <RouteMechList routeId={d.route} zhong={zhong} build={build} />
        <QiSeaLine q={d.quality} realm={s.realm} zhong={zhong} />
      </ul>
    </div>
  );
}

function QiSeaLine({ q, realm, zhong }: { q: Quality; realm: number; zhong: number }) {
  return (
    <li data-tip={`真气上限 = (70 + 15 × (境界 − 2) + 重数) × 气海<br>此刻：(70 + 15 × ${Math.max(realm, 2) - 2} + ${zhong}) × ${qiCoef(q)} = ${qiMax(realm, zhong, q)}`}>
      气海 <b>×{qiCoef(q)}</b>，每精进一重真气上限 <b>+1</b>
    </li>
  );
}

function SwitchDialog({ to, onClose }: { to: NeigongId; onClose: () => void }) {
  const s = useGameStore();
  const from = NEIGONG[s.neigong!];
  const target = NEIGONG[to];
  const same = from.route === target.route;
  const zhongTo = zhongAfterSwitch(from.id, to, s.zhong);
  const fee = switchFee(s.realm);
  const canPay = s.silver >= fee;
  const title = `${same ? '转修' : '散功重修'} · ${target.name}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  // 挂到 body：舞台有 isolation，留在里面盖不住侧栏
  return createPortal(
    <div className="gf-veil" onClick={onClose}>
      <div className="gf-dlg" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="sub">
          {same
            ? `同为${ROUTES[from.route].name}一路，功力可带过去大半。`
            : `跨路数须散功：${ROUTES[from.route].name}之法散去，改修${ROUTES[target.route].name}，重数从头练起。`}
        </div>
        <div className="gf-kv"><span className="k">起始重数</span><span className={`v${same ? '' : ' loss'}`}>第 {s.zhong} 重 → 第 {zhongTo} 重</span></div>
        <div className="gf-kv"><span className="k">已过的关</span><span className="v loss">需重新顿悟</span></div>
        <div className="gf-kv"><span className="k">手续费</span><span className="v">{fmtBig(fee)} 银两{canPay ? '' : <small>银两不足，还差 {fmtBig(fee - s.silver)}</small>}</span></div>
        <p className="note">
          {same ? '保留八成累计内力，约少三重。' : ''}下一世开头换功不收费、不折算{same ? '。' : '；若只是想试试这一路，不如等到那时。'}
        </p>
        <div className="acts">
          <button className="jh-btn quiet" onClick={onClose}>再想想</button>
          <button className="jh-btn" disabled={!canPay} onClick={() => { s.switchNeigong(to); onClose(); }}>
            {same ? '转修' : '散功重修'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function zhongEffectsText(routeId: RouteId, zhong: number): string {
  const p = ROUTES[routeId].perLevel;
  const parts: string[] = [];
  if (p.atkPct) parts.push(`攻击 +${pct(p.atkPct * zhong)}`);
  if (p.hpPct) parts.push(`气血 +${pct(p.hpPct * zhong)}`);
  if (p.defPct) parts.push(`防御 +${pct(p.defPct * zhong)}`);
  if (p.critRatePP) parts.push(`暴击率 +${pp(p.critRatePP * zhong)}`);
  if (p.critDmgPP) parts.push(`暴击伤害 +${pp(p.critDmgPP * zhong)}`);
  if (p.thornsPP) parts.push(`反伤 +${pp(p.thornsPP * zhong)}`);
  if (p.poisonCoefPP) parts.push(`毒伤系数 +${pp(p.poisonCoefPP * zhong)}`);
  return parts.join(' · ');
}

/**
 * 心法要诀：路数机制一律显示**当前生效值**（含已过关口的质变；battle-copy §3.2 通用规则）。
 * 数值的来源（路数赠予 + 逐重加成 + 关口）写进悬停，不铺在界面上。
 */
function RouteMechList({ routeId, zhong, build }: { routeId: RouteId; zhong: number; build: Build }) {
  const g = ROUTES[routeId].grant;
  const p = ROUTES[routeId].perLevel;
  const L = zhaoshiLevel(zhong);
  switch (routeId) {
    case 'tangmen':
      return (
        <>
          <li>开战为对方<b>施毒 {build.poison.init} 层</b>，每次命中 <b>+{build.poison.perHit} 层</b></li>
          <li data-tip={`基础 12% · 逐重 +${pp((p.poisonCoefPP ?? 0) * L)}（已计 ${L} 重）${build.poison.coef > (g.poisonCoef ?? 0) + (p.poisonCoefPP ?? 0) * L + 1e-9 ? ' · 关口加成' : ''}`}>
            毒伤 = 攻击 × <b>{Math.round(build.poison.coef * 1000) / 10}%</b> × 层数，<b>无视防御</b>、绕过护盾
          </li>
          <li>层数上限 <b>{build.poison.cap}</b>，满层触发<b>毒爆 {pct(build.poison.burst)}</b></li>
          <li>代价：普攻伤害 <b>×{build.plainMult.toFixed(2)}</b></li>
        </>
      );
    case 'huashan':
      return (
        <>
          <li data-tip={`路数赠予：暴击率 +${pp(g.critRatePP!)}、暴击伤害 +${pp(g.critDmgPP!)}<br>逐重加成（已计 ${L} 重）：+${pp((p.critRatePP ?? 0) * L)}、+${pp((p.critDmgPP ?? 0) * L)}`}>
            暴击率 <b>+{pp(g.critRatePP! + (p.critRatePP ?? 0) * L)}</b>，暴击伤害 <b>+{pp(g.critDmgPP! + (p.critDmgPP ?? 0) * L)}</b>
          </li>
          <li>开战首击<b>必定暴击</b></li>
          <li>每次暴击积 <b>1 层剑意</b></li>
          <li>剑意满 <b>{build.sqNeed} 层</b>，施展爆发剑招 <b>{Math.round(build.burstMult * 100)}%</b></li>
        </>
      );
    case 'shaolin':
      return (
        <>
          <li>开战获得 <b>{pct(build.shieldPct)} 气血</b>护盾</li>
          <li data-tip="减免之后、护盾吸收之前结算">受击反伤 <b>{pct(build.thorns)}</b></li>
          <li data-tip={`路数赠予 +${pct(g.defPct ?? 0)} · 逐重 +${pct((p.defPct ?? 0) * L)}（已计 ${L} 重）`}>
            防御 <b>+{pct((g.defPct ?? 0) + (p.defPct ?? 0) * L)}</b>
          </li>
          {build.lowhpDr > 0 && <li>气血低于 30% 时受到伤害 <b>−{pct(build.lowhpDr)}</b></li>}
        </>
      );
    default:
      return assertNever(routeId, 'RouteMechList 未处理的路数');
  }
}
