/** 武学页 —— 构筑决策归拢处：武学升级 / 机制节点 / 路线机制 / 乘区透视 / 换路线 */
import { useState } from 'react';
import { computeAttributes } from '../engine/attributes';
import { REALMS, skillUpgradeCost, type RouteId } from '../engine/content';
import { bossDmgBonus } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { RouteSwitch } from '../overlays/RouteSwitch';
import { useGameStore } from '../store/gameStore';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${(v * 100).toFixed(1)}pp`;

export function SkillPane() {
  const s = useGameStore();
  const route = ROUTES[s.route!];
  const otherRoutes = (Object.keys(ROUTES) as RouteId[]).filter((r) => r !== s.route);
  // `#switch=1` 调试直达：截图/自检用
  const [switchTo, setSwitchTo] = useState<RouteId | null>(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('switch') === '1' ? otherRoutes[0] : null);
  const bossBonus = bossDmgBonus(s.ownedRepNodes);
  const cap = REALMS[s.realm - 1].skillCap;
  const next = s.skillLevel + 1;
  const atCap = next > cap;
  const cost = atCap ? null : skillUpgradeCost(next);
  const affordable = cost !== null && s.dantian >= cost;
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const nextNode = route.mechNodes.find((n) => !s.ownedMechNodes.includes(n.id));

  return (
    <div className="pane-wrap">
      <div className="pane-grid">
        <div>
          <section className="panel">
            <div className="panel-head">武学 · {route.skillName} <span className="sub">上限 = 境界×2</span></div>
            <div className="panel-body">
              <div className="skill-row">
                <span className="sname">{route.skillName}</span>
                <span className="slv">Lv {s.skillLevel} / {cap}</span>
                <span className="seff"><SkillEffects routeId={s.route!} level={s.skillLevel} /></span>
                <button
                  className="skill-btn"
                  disabled={atCap || !affordable}
                  onClick={s.upgradeSkill}
                  title={atCap ? `突破至更高境界解锁 Lv ${next}` : undefined}
                >
                  {atCap ? '已达上限' : `升级 ${fmt(cost!)}`}
                </button>
              </div>
              <div className="skill-row">
                <span className="sname">机制节点</span>
                <span className="slv">{s.ownedMechNodes.length} / {route.mechNodes.length}</span>
                <span className="seff">
                  {s.ownedMechNodes.length > 0
                    ? route.mechNodes.filter((n) => s.ownedMechNodes.includes(n.id)).map((n) => n.label).join('；') + '（已购）'
                    : '尚未购买'}
                </span>
                {nextNode && (
                  <button
                    className="skill-btn"
                    disabled={s.xp < nextNode.cost}
                    onClick={() => s.buyMechNode(nextNode.id)}
                  >
                    {nextNode.label} · {nextNode.cost} 阅历
                  </button>
                )}
              </div>
              <div className="cap-note">
                武学等级上限 {cap}（境界 {s.realm} × 2）
                {s.realm < REALMS.length && `；突破至境界 ${s.realm + 1} 后解锁 Lv ${cap + 1}–${REALMS[s.realm].skillCap}`}
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
                  {' '}= <span className="result">{attrs.atk}</span>
                </div>
                <div className="zone-legend">
                  <span className="perm">永久加成</span>
                  <span className="temp">本轮加成（{route.skillName} Lv{s.skillLevel}）</span>
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
              <RouteMechList routeId={s.route!} level={s.skillLevel} />
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

function RouteMechList({ routeId, level }: { routeId: keyof typeof ROUTES; level: number }) {
  const g = ROUTES[routeId].grant;
  const p = ROUTES[routeId].perLevel;
  switch (routeId) {
    case 'tangmen': {
      const coef = (g.poisonCoef ?? 0) + (p.poisonCoefPP ?? 0) * level;
      return (
        <>
          <li>第 0 回合自动<b>施毒 {g.poisonInit} 层</b>，每次命中 <b>+{g.poisonPerHit} 层</b></li>
          <li>毒伤 = 攻击 × <b>{Math.round(coef * 1000) / 10}%</b>（基础 12% + 武学 {pp((p.poisonCoefPP ?? 0) * level)}）× 层数</li>
          <li>毒<b>无视防御、绕过护盾</b>，不可暴击</li>
          <li>层数上限 <b>{g.poisonCap}</b>，满层触发<b>毒爆 {pct(g.poisonBurstPct!)}</b></li>
          <li>代价：普攻伤害 <b>×{g.basicAtkMult!.toFixed(2)}</b></li>
        </>
      );
    }
    case 'huashan':
      return (
        <>
          <li>暴击率 <b>+{pp(g.critRatePP!)}</b>，暴击伤害 <b>+{pp(g.critDmgPP!)}</b></li>
          <li><b>开战首击必定暴击</b></li>
          <li>剑意满 5 层自动施展<b>爆发剑招（400%）</b></li>
        </>
      );
    case 'shaolin':
      return (
        <>
          <li>开战自动获得 <b>{pct(g.shieldPctHP!)} 气血护盾</b></li>
          <li>受击自动反伤 <b>{pct(g.thornsPct!)}</b>（减免后、护盾吸收前）</li>
          <li>防御 <b>+{pct(g.defPct!)}</b></li>
        </>
      );
  }
}
