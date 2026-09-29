/** 武学页 —— 构筑决策归拢处：武学升级 / 机制节点 / 路线机制 / 乘区透视 / 换路线 */
import { useState } from 'react';
import { assertNever } from '../engine/exhaustive';
import { computeAttributes } from '../engine/attributes';
import type { Build } from '../engine/combat';
import { HUOHOU_PER_REALM, SHICHENG, huohouEffect, huohouRealms, skillUpgradeCost, zhaoshiLevel, type RouteId } from '../engine/content';
import { bossDmgBonus } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { RouteSwitch } from '../overlays/RouteSwitch';
import { playerBuild, useGameStore } from '../store/gameStore';

import { fmtBig } from '../fmt';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${(v * 100).toFixed(1)}pp`;
const CN_CHONG = ['', '一', '二', '三'];

export function SkillPane() {
  const s = useGameStore();
  const route = ROUTES[s.route!];
  const otherRoutes = (Object.keys(ROUTES) as RouteId[]).filter((r) => r !== s.route);
  // `#switch=1` 调试直达：截图/自检用
  const [switchTo, setSwitchTo] = useState<RouteId | null>(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('switch') === '1' ? otherRoutes[0] : null);
  const bossBonus = bossDmgBonus(s.ownedRepNodes);
  const next = s.skillLevel + 1;
  const cost = skillUpgradeCost(next);
  const affordable = s.dantian >= cost;
  const zhaoshi = zhaoshiLevel(s.skillLevel);
  const shicheng = s.skillLevel >= SHICHENG;
  const hhLevel = Math.max(0, s.skillLevel - SHICHENG);
  const fold = huohouRealms(s.skillLevel);
  const cells = Math.max(4, Math.ceil(fold + 0.001));
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const nextNode = route.mechNodes.find((n) => !s.ownedMechNodes.includes(n.id));
  const build = playerBuild(s);

  return (
    <div className="pane-wrap">
      <div className="pane-grid">
        <div>
          <section className="panel">
            <div className="panel-head">武学 · {route.skillName} <span className="sub">上限：不限</span></div>
            <div className="panel-body">
              <div className="skill-row">
                <span className="sname">招式</span>
                <span className="slv">{zhaoshi} / {SHICHENG}</span>
                <span className="seff"><SkillEffects routeId={s.route!} level={zhaoshi} /></span>
                {shicheng ? (
                  <span className="shicheng-tag">十成</span>
                ) : (
                  <button className="skill-btn" disabled={!affordable} onClick={s.upgradeSkill}>
                    修习 {fmtBig(cost)}
                  </button>
                )}
              </div>
              <div className={`huohou${shicheng ? '' : ' locked'}`}>
                <div className="hh-head">
                  <span className="hh-name serif">火候</span>
                  <span className="hh-lv">{shicheng ? `第 ${hhLevel} 重` : '招式十成后开启'}</span>
                  <span className="hh-rule">每 {HUOHOU_PER_REALM} 重折合一个境界</span>
                </div>
                <div className="hh-ruler" aria-label={`火候折合 ${fold.toFixed(2)} 个境界`}>
                  {Array.from({ length: cells }, (_, i) => (
                    <span key={i} className="cell"><i style={{ width: `${Math.max(0, Math.min(1, fold - i)) * 100}%` }} /></span>
                  ))}
                </div>
                <div className="hh-cap"><span>0</span><span>折合 {fold.toFixed(2)} 个境界</span><span>+{cells}</span></div>
                {shicheng && (
                  <button className="btn" disabled={!affordable} onClick={s.upgradeSkill}>
                    精进一重（{fmtBig(cost)} 内力）
                  </button>
                )}
                <div className="cap-note">
                  三派相同：每一重，气血、攻击、防御同涨约 2.7%，命中、闪避随之略增——和突破同一个方向，只是一重只走二十分之一步。价格每重 ×1.08，越往后越贵；归隐即散，每一世从头练起。
                </div>
              </div>
              <div className="skill-row">
                <span className="sname">武学参悟</span>
                <span className="slv">{s.ownedMechNodes.length} / {route.mechNodes.length}</span>
                <span className="seff">
                  {s.ownedMechNodes.length > 0
                    ? route.mechNodes.filter((n) => s.ownedMechNodes.includes(n.id)).map((n) => n.label).join('；') + '（已参悟）'
                    : '尚未参悟'}
                </span>
                {nextNode && (
                  <button
                    className="skill-btn"
                    disabled={s.xp < nextNode.cost}
                    onClick={() => s.buyMechNode(nextNode.id)}
                  >
                    {CN_CHONG[s.ownedMechNodes.length + 1]}重参悟 · {nextNode.label}（{nextNode.cost} 阅历）
                  </button>
                )}
              </div>
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
                  {shicheng && <>{' '}× <span className="temp">火候 {huohouEffect(s.skillLevel).statMult.toFixed(2)}</span></>}
                  {' '}= <span className="result">{attrs.atk}</span>
                </div>
                <div className="zone-legend">
                  <span className="perm">永久加成</span>
                  <span className="temp">本世加成（{route.skillName} 招式 {zhaoshi} 成）</span>
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

        <section className="panel">
          <div className="panel-head"><span className={`route-name serif route-${s.route}`}>{route.name}</span></div>
          <div className="panel-body">
            <ul className="route-mech">
              <RouteMechList routeId={s.route!} level={zhaoshi} build={build} />
            </ul>
            <button
              className="btn ghost"
              onClick={() => setSwitchTo(otherRoutes[0])}
              title="已投入阅历全额返还，仅收 200 银两盘缠"
            >
              换路线
            </button>
          </div>
        </section>
      </div>

      {switchTo && (
        <RouteSwitch to={switchTo} onPick={setSwitchTo} onClose={() => setSwitchTo(null)} />
      )}
    </div>
  );
}

function SkillEffects({ routeId, level }: { routeId: keyof typeof ROUTES; level: number }) {
  const p = ROUTES[routeId].perLevel;
  if (level === 0) return <>未修习</>;
  const parts: string[] = [];
  if (p.atkPct) parts.push(`攻 +${pct(p.atkPct * level)}`);
  if (p.hpPct) parts.push(`血 +${pct(p.hpPct * level)}`);
  if (p.defPct) parts.push(`防 +${pct(p.defPct * level)}`);
  if (p.critRatePP) parts.push(`暴率 +${pp(p.critRatePP * level)}`);
  if (p.critDmgPP) parts.push(`暴伤 +${pp(p.critDmgPP * level)}`);
  if (p.thornsPP) parts.push(`反伤 +${pp(p.thornsPP * level)}`);
  if (p.poisonCoefPP) parts.push(`毒系数 +${pp(p.poisonCoefPP * level)}`);
  return <>{parts.join(' · ')}</>;
}

/**
 * 路线机制参数一律显示**当前生效值**（含参悟修改；battle-copy §3.2 通用规则）——
 * 已参悟玩家读到过期基线值即文案撒谎；基线值只允许出现在路线选择卡。
 */
function RouteMechList({ routeId, level, build }: { routeId: keyof typeof ROUTES; level: number; build: Build }) {
  const g = ROUTES[routeId].grant;
  const p = ROUTES[routeId].perLevel;
  switch (routeId) {
    case 'tangmen':
      return (
        <>
          <li>第 0 回合自动<b>施毒 {build.poison.init} 层</b>，每次命中 <b>+{build.poison.perHit} 层</b></li>
          <li>毒伤 = 攻击 × <b>{Math.round(build.poison.coef * 1000) / 10}%</b>（基础 12% + 武学 {pp((p.poisonCoefPP ?? 0) * level)}）× 层数</li>
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
          <li>防御 <b>+{pct((g.defPct ?? 0) + (p.defPct ?? 0) * level)}</b></li>
          {build.lowhpDr > 0 && <li>气血低于 30% 时受到伤害 <b>−{pct(build.lowhpDr)}</b></li>}
        </>
      );
    default:
      // 新增路线必须在此补机制说明，否则编译期报错（不再静默渲染空白）
      return assertNever(routeId, 'RouteMechList 未处理的路线');
  }
}
