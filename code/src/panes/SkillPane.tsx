/** 武学页 —— 构筑决策归拢处：武学升级 / 机制节点 / 路线机制 / 乘区透视 / 换路线 */
import { useState } from 'react';
import { assertNever } from '../engine/exhaustive';
import { computeAttributes } from '../engine/attributes';
import type { Build } from '../engine/combat';
import { REALMS, skillUpgradeCost, type RouteId } from '../engine/content';
import { bossDmgBonus } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { RouteSwitch } from '../overlays/RouteSwitch';
import { playerBuild, useGameStore } from '../store/gameStore';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
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
  const cap = REALMS[s.realm - 1].skillCap;
  const next = s.skillLevel + 1;
  const atCap = next > cap;
  const cost = atCap ? null : skillUpgradeCost(next);
  const affordable = cost !== null && s.dantian >= cost;
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const nextNode = route.mechNodes.find((n) => !s.ownedMechNodes.includes(n.id));
  const build = playerBuild(s);

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
              <RouteMechList routeId={s.route!} level={s.skillLevel} build={build} />
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
