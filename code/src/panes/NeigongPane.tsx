/**
 * 内功页 —— docs/design/sect-neigong-prototype.html §2 的实现（取代原武学页）。
 * 升重（内力灌注）、五级台阶与顿悟、真气、路数机制、已有内功与转修。数值出自 sect-neigong/spec.md §1。
 */
import { useState } from 'react';
import { assertNever } from '../engine/exhaustive';
import { computeAttributes } from '../engine/attributes';
import type { Build } from '../engine/combat';
import { HUOHOU_PER_REALM, zhaoshiLevel, type RouteId } from '../engine/content';
import {
  DUNWU_INTERVAL_SEC, NEIGONG, QUALITY_ORDER, TIERS, TIER_COUNT, dunwuChance, foldRealms, qiMax,
  switchFee, zhongAfterSwitch, zhongCost, type NeigongId, type Quality,
} from '../engine/neigong';
import { bossDmgBonus } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { huohouMultOf, playerBuild, useGameStore, zhongGate } from '../store/gameStore';
import { fmtBig } from '../fmt';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${(v * 100).toFixed(1)}pp`;
const Q_CLS: Record<Quality, string> = { 寻常: 'q-common', 上乘: 'q-fine', 绝学: 'q-peak' };
const LU_TAG: Record<RouteId, string> = { huashan: '惊雷 · 爆发', shaolin: '镇岳 · 护体', tangmen: '蚀骨 · 阴毒' };

export function NeigongPane() {
  const s = useGameStore();
  const [switchTo, setSwitchTo] = useState<NeigongId | null>(null);
  const ng = NEIGONG[s.neigong!];
  const gate = zhongGate(s);
  const next = s.zhong + 1;
  const cost = zhongCost(next);
  const affordable = s.dantian >= cost;
  const fold = foldRealms(s.zhong, ng.quality);
  const qi = qiMax(s.realm, s.zhong, ng.quality);
  const build = playerBuild(s);
  const attrs = computeAttributes(s.realm, s.route, s.zhong, 0, 0, huohouMultOf(s));
  const bossBonus = bossDmgBonus(s.ownedRepNodes);
  const others = (s.ownedNeigong ?? [])
    .filter((id) => id !== s.neigong)
    .sort((a, b) => QUALITY_ORDER.indexOf(NEIGONG[b].quality) - QUALITY_ORDER.indexOf(NEIGONG[a].quality));

  return (
    <div className="pane-wrap">
      <section className="panel">
        <div className="panel-body">
          <div className="ng-hero">
            <div>
              <div className="ng-name serif">{ng.name}</div>
              <div className="ng-meta">
                <span className={`qtag ${Q_CLS[ng.quality]}`}>{ng.quality}</span>
                <span className={`tag route-tag-${ng.route}`}>{LU_TAG[ng.route]}</span>
                <span className="wuxing-chip" title="每一世天生不同，决定顿悟的快慢">悟性 <b>{(s.wuxing ?? 1).toFixed(2)}</b></span>
              </div>
            </div>
            <div className="ng-zhong">
              <div className="big">第 {s.zhong}<small>重</small></div>
              <div className="fold">火候折合 {fold.toFixed(2)} 个境界</div>
            </div>
          </div>
          <div className="ng-up">
            <button className="btn" disabled={!!gate || !affordable} onClick={s.upgradeZhong}>
              {gate ? '卡在台阶上' : '精进一重'}
              <span className="sub">{gate ? '顿悟前不能再升重' : `${fmtBig(cost)} 内力`}</span>
            </button>
            <span className="why">
              十重以内按路数逐重加成；此后每一重气血、攻击、防御约 +2.7%，每 {HUOHOU_PER_REALM} 重折合一个境界。价格每重 ×1.08；归隐即散，每一世从头练起。
            </span>
          </div>

          <ol className="ng-steps" aria-label="台阶">
            {TIERS.map((t, i) => {
              const na = i >= TIER_COUNT[ng.quality];
              const done = i < s.tiersPassed;
              const waiting = gate?.index === i;
              const cls = done ? 'done' : waiting ? (gate!.needScroll ? 'scroll' : 'wait') : na ? 'na' : '';
              return (
                <li key={t.name} className={`ng-step ${cls}`}>
                  <span className="dot">{done ? '✓' : i + 1}</span>
                  <span className="sn serif">{t.name}</span>
                  <span className="sz">第 {t.at} 重{na ? (i === 3 ? ' · 上乘' : ' · 绝学') : ''}</span>
                  <span className="se">{t.effect[ng.route]}</span>
                </li>
              );
            })}
          </ol>

          {gate && !gate.needScroll && (() => {
            const p = dunwuChance(gate.tier, s.wuxing ?? 1);
            const hours = (DUNWU_INTERVAL_SEC / p) / 3600;
            return (
              <div className="ng-wait">
                <span className="t serif">静候顿悟</span>
                <span className="d">
                  已到第 <b>{s.zhong}</b> 重，{gate.tier.name}之关在前。挂机修炼每 10 分钟一判，
                  此刻概率 <b>{(p * 100).toFixed(1)}%</b>（{Math.round(gate.tier.p * 100)}% × 悟性 {(s.wuxing ?? 1).toFixed(2)}），
                  期望约 <b>{hours < 1 ? `${Math.round(hours * 60)} 分钟` : `${hours.toFixed(1)} 小时`}</b>，闭关照判。
                  卡在台阶上时内力照常积累，不会浪费。
                </span>
              </div>
            );
          })()}
          {gate?.needScroll && (
            <div className="ng-wait scroll">
              <span className="t serif">缺《归真卷册》</span>
              <span className="d">已到第 <b>{s.zhong}</b> 重，归真需先得卷册（门派贡献商店）。得卷册后才开始判顿悟。</span>
            </div>
          )}
        </div>
      </section>

      <div className="pane-grid" style={{ marginTop: 16 }}>
        <div>
          <section className="panel">
            <div className="panel-head">真气 <span className="sub">战斗内的气条，开战满、打完清零</span></div>
            <div className="panel-body">
              <div className="qi-box"><span className="big">{qi}</span><span className="sub">真气上限</span></div>
              <div className="qi-formula">
                (70 + 15 × (境界 <b>{s.realm}</b> − 2) + 重数 <b>{s.zhong}</b>) × {ng.quality} <b>{ngQiCoef(ng.quality)}</b>
              </div>
              <div className="cap-note">真气够，才领悟得了武学的后几式。普攻回 20，出招扣耗气（武学随后开放）。</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">乘区透视 <span className="sub">每个最终量 ≤ 2 乘区</span></div>
            <div className="panel-body">
              <div className="zone-box">
                <div className="zt">最终攻击 · 战斗域</div>
                <div className="zone-line">
                  <span className="base">基础 {attrs.zones.atkBase}</span>
                  {' '}× <span className="perm">(1 + {pct(attrs.zones.atkPermPct)})</span>
                  {' '}× <span className="temp">(1 + {pct(attrs.zones.atkTempPct)})</span>
                  {fold > 0 && <>{' '}× <span className="temp">火候 {Math.pow(1.7, fold).toFixed(2)}</span></>}
                  {' '}= <span className="result">{attrs.atk}</span>
                </div>
                <div className="zone-legend">
                  <span className="perm">永久加成</span>
                  <span className="temp">本世加成（{ng.name} {Math.min(s.zhong, 10)} 重逐重加成）</span>
                </div>
              </div>
              <div className="zone-box">
                <div className="zt">对 Boss 伤害 · 战斗域</div>
                <div className="zone-line">
                  <span className="base">结算伤害</span> × <span className="perm">(1 + {pct(bossBonus)})</span> = <span className="result">×{(1 + bossBonus).toFixed(2)}</span>
                </div>
                <div className="zone-legend">
                  <span className="perm">{bossBonus > 0 ? '永久（破关心得 +10%）' : '「破关心得」购买后 +10%'}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panel-head"><span className={`route-name serif route-${ng.route}`}>{ROUTES[ng.route].name}</span><span className="sub">路数机制 · 当前生效值</span></div>
            <div className="panel-body">
              <ul className="route-mech">
                <RouteMechList routeId={ng.route} zhong={s.zhong} build={build} />
              </ul>
              {s.zhong > 0 && (
                <div className="cap-note">第 1–10 重逐重加成：<ZhongEffects routeId={ng.route} zhong={zhaoshiLevel(s.zhong)} /></div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">已有内功 <span className="sub">一世之内转修须付代价</span></div>
            <div className="panel-body">
              <div className="ng-lib cur">
                <span className="nm serif">{ng.name}</span>
                <span className={`qtag ${Q_CLS[ng.quality]}`}>{ng.quality}</span>
                <span className={`tag route-tag-${ng.route}`}>{ROUTES[ng.route].name}</span>
                <span className="st">主修中</span>
              </div>
              {others.map((id) => {
                const o = NEIGONG[id];
                const same = o.route === ng.route;
                return (
                  <div key={id} className="ng-lib">
                    <span className="nm serif">{o.name}</span>
                    <span className={`qtag ${Q_CLS[o.quality]}`}>{o.quality}</span>
                    <span className={`tag route-tag-${o.route}`}>{ROUTES[o.route].name}</span>
                    <span className="st">{same ? '同路数' : '跨路数'}</span>
                    <button className="btn ghost small" onClick={() => setSwitchTo(id)}>{same ? '转修' : '散功重修'}</button>
                  </div>
                );
              })}
              <div className="cap-note">下一世开头换功不收费、不折算。一世之内要换，才看这里的代价。</div>
            </div>
          </section>
        </div>
      </div>

      {switchTo && <SwitchDialog to={switchTo} onClose={() => setSwitchTo(null)} />}
    </div>
  );
}

const ngQiCoef = (q: Quality) => ({ 寻常: '1.0', 上乘: '1.1', 绝学: '1.2' })[q];

function SwitchDialog({ to, onClose }: { to: NeigongId; onClose: () => void }) {
  const s = useGameStore();
  const from = NEIGONG[s.neigong!];
  const target = NEIGONG[to];
  const same = from.route === target.route;
  const zhongTo = zhongAfterSwitch(from.id, to, s.zhong);
  const fee = switchFee(s.realm);
  const canPay = s.silver >= fee;
  const title = `${same ? '转修' : '散功重修'} · ${target.name}`;
  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><span className="serif">{title}</span></div>
        <div className="modal-body">
          {same ? (
            <p>同为{ROUTES[from.route].name}一路，功力可带过去大半。</p>
          ) : (
            <p>跨路数须散功：<span className="loss">重数归零</span>，台阶清空，{ROUTES[from.route].name}之法散去，改修{ROUTES[target.route].name}。</p>
          )}
          <div className="rline"><span>起始重数</span><span className="v">第 {s.zhong} 重 → 第 {zhongTo} 重{same ? '（保留八成累计内力）' : ''}</span></div>
          <div className="rline"><span>已过台阶</span><span className="v loss">需重新顿悟</span></div>
          <div className="rline"><span>手续费</span><span className="v">{fmtBig(fee)} 银两{canPay ? '' : '（银两不足）'}</span></div>
          {!same && <p className="cap-note">若只是想试试这一路，不如等下一世开头再选，那时不收费、不折算。</p>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>再想想</button>
            <button className="btn" disabled={!canPay} onClick={() => { s.switchNeigong(to); onClose(); }}>
              {same ? '转修' : '散功重修'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZhongEffects({ routeId, zhong }: { routeId: RouteId; zhong: number }) {
  const p = ROUTES[routeId].perLevel;
  const parts: string[] = [];
  if (p.atkPct) parts.push(`攻 +${pct(p.atkPct * zhong)}`);
  if (p.hpPct) parts.push(`血 +${pct(p.hpPct * zhong)}`);
  if (p.defPct) parts.push(`防 +${pct(p.defPct * zhong)}`);
  if (p.critRatePP) parts.push(`暴率 +${pp(p.critRatePP * zhong)}`);
  if (p.critDmgPP) parts.push(`暴伤 +${pp(p.critDmgPP * zhong)}`);
  if (p.thornsPP) parts.push(`反伤 +${pp(p.thornsPP * zhong)}`);
  if (p.poisonCoefPP) parts.push(`毒系数 +${pp(p.poisonCoefPP * zhong)}`);
  return <>{parts.join(' · ')}</>;
}

/**
 * 路数机制一律显示**当前生效值**（含台阶质变；battle-copy §3.2 通用规则）——
 * 过了台阶的玩家读到过期基线值即文案撒谎；基线值只允许出现在选内功卡。
 */
function RouteMechList({ routeId, zhong, build }: { routeId: RouteId; zhong: number; build: Build }) {
  const g = ROUTES[routeId].grant;
  const p = ROUTES[routeId].perLevel;
  const L = zhaoshiLevel(zhong);
  switch (routeId) {
    case 'tangmen':
      return (
        <>
          <li>第 0 回合自动<b>施毒 {build.poison.init} 层</b>，每次命中 <b>+{build.poison.perHit} 层</b></li>
          <li>毒伤 = 攻击 × <b>{Math.round(build.poison.coef * 1000) / 10}%</b>（基础 12% + 逐重 {pp((p.poisonCoefPP ?? 0) * L)}）× 层数</li>
          <li>毒<b>无视防御、绕过护盾</b>，不可暴击</li>
          <li>层数上限 <b>{build.poison.cap}</b>，满层触发<b>毒爆 {pct(build.poison.burst)}</b></li>
          <li>代价：普攻伤害 <b>×{build.plainMult.toFixed(2)}</b></li>
        </>
      );
    case 'huashan':
      return (
        <>
          <li>暴击率 <b>+{pp(g.critRatePP!)}</b>，暴击伤害 <b>+{pp(g.critDmgPP!)}</b></li>
          <li><b>开战首击必定暴击</b>（并积 1 层剑意）</li>
          <li>每次暴击积 <b>1 层剑意</b></li>
          <li>剑意满 <b>{build.sqNeed} 层</b>自动施展<b>爆发剑招（{Math.round(build.burstMult * 100)}%）</b></li>
        </>
      );
    case 'shaolin':
      return (
        <>
          <li>开战自动获得 <b>{pct(build.shieldPct)} 气血护盾</b></li>
          <li>受击自动反伤 <b>{pct(build.thorns)}</b>（减免后、护盾吸收前）</li>
          <li>防御 <b>+{pct((g.defPct ?? 0) + (p.defPct ?? 0) * L)}</b></li>
          {build.lowhpDr > 0 && <li>气血低于 30% 时受到伤害 <b>−{pct(build.lowhpDr)}</b></li>}
        </>
      );
    default:
      return assertNever(routeId, 'RouteMechList 未处理的路数');
  }
}
