/**
 * 伤势卡 —— 视觉基准 docs/design/ui-overhaul-prototype.html `.card.wounds`，数据口径沿用 injury/spec.md。
 * 有伤（或魂魄未稳）才出现；无伤时侧栏已写「身无伤病」，这里不渲染。
 * 每处伤：名称·程度、压了什么、还剩多久、治愈细条；挂机内力的来源分解收进悬停。
 */
import {
  INJURY_IDS, INJURY_DEFS, SEVERITY_NAME, SEVERITY_PRESS, SEVERITY_HEAL_MIN,
  healRealmFactor, idleOutputMultiplier, isHurt,
  type Injuries, type InjuryId, type Severity,
} from '../engine/injury';
import { idleNeiliPerSec } from '../engine/formulas';
import { SOUL_WEAK_MULT } from '../engine/reincarnation';
import { fmtRate } from '../fmt';

/** 各伤型压了哪些战斗属性（spec §1 combat 列），按当前严重度展开为文案 */
function combatEffectText(id: InjuryId, severity: Severity): string {
  const p = SEVERITY_PRESS[severity as Exclude<Severity, 0>];
  const pct = (v: number) => `−${Math.round(v * 100)}%`;
  if (id === 'wai') return `防御 ${pct(p)} · 气血上限 ${pct(p * 0.66)}`;
  if (id === 'nei') return `攻击 ${pct(p)}`;
  return `命中 ${pct(p)} · 闪避 ${pct(p)}`;
}

/** 该伤型单独造成的挂机产出压制（spec §3） */
function idlePressPct(id: InjuryId, severity: Severity): number {
  return SEVERITY_PRESS[severity as Exclude<Severity, 0>] * INJURY_DEFS[id].idleWeight;
}

function fmtMin(min: number): string {
  const total = Math.max(0, Math.round(min * 60));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}分${String(sec).padStart(2, '0')}秒` : `${sec}秒`;
}

export function WoundPanel({ injuries, realm, soulUnsettled = false, outMult = 1 }: {
  injuries: Injuries; realm: number;
  /** 魂魄未稳（reincarnation/spec.md §4.1）：与伤势压制同一乘法链，列进同一张来源分解 */
  soulUnsettled?: boolean;
  /** 产出乘区 M（宿慧 + 修行感悟），让来源分解与侧栏速率对得上 */
  outMult?: number;
}) {
  const hurt = isHurt(injuries);
  if (!hurt && !soulUnsettled) return null;

  const factor = healRealmFactor(realm);
  const baseRate = idleNeiliPerSec(realm);
  const press = idleOutputMultiplier(injuries) * (soulUnsettled ? SOUL_WEAK_MULT : 1);
  const hurtIds = INJURY_IDS.filter((id) => injuries[id].severity > 0);

  // 来源分解：一行一笔，悬停可核对
  const srcTip = [
    `境界 ${realm} 基础产出　+${baseRate.toFixed(1)}/秒`,
    ...(outMult !== 1 ? [`宿慧与修行感悟　×${outMult.toFixed(2)}`] : []),
    ...hurtIds.map((id) =>
      `${INJURY_DEFS[id].name} · ${SEVERITY_NAME[injuries[id].severity]}　×${(1 - idlePressPct(id, injuries[id].severity)).toFixed(3)}`),
    ...(soulUnsettled ? [`魂魄未稳　×${SOUL_WEAK_MULT.toFixed(2)}`] : []),
    `<span class='l'>伤势再多，挂机产出也保底四成</span>`,
  ].join('<br>');

  return (
    <div className="jh-card cult-wounds">
      <div className="head">
        <span className="serif">伤势</span>
        <small>{hurt ? '挂机静养 · 离线同样恢复' : '魂魄未稳 · 十年后自复'}</small>
      </div>

      {hurtIds.map((id) => {
        const { severity, healAccMin } = injuries[id];
        const stageNeed = SEVERITY_HEAL_MIN[severity as Exclude<Severity, 0>] * factor;
        const left = Math.max(0, stageNeed - healAccMin);
        return (
          <div className="wound" key={id}>
            <span className="n">{INJURY_DEFS[id].name} · {SEVERITY_NAME[severity]}</span>
            <span className="e">
              {combatEffectText(id, severity)} · 挂机内力 −{Math.round(idlePressPct(id, severity) * 100)}%
            </span>
            <span className="t">
              {fmtMin(left)}
              <small>{severity === 1 ? '痊愈' : `转为${SEVERITY_NAME[(severity - 1) as Severity]}伤`}</small>
            </span>
            <div className="heal"><i style={{ width: `${Math.min(100, (healAccMin / stageNeed) * 100)}%` }} /></div>
          </div>
        );
      })}

      {soulUnsettled && (
        <div className="wound">
          <span className="n">魂魄未稳</span>
          <span className="e">挂机内力 −{Math.round((1 - SOUL_WEAK_MULT) * 100)}%</span>
        </div>
      )}

      <div className="src">
        挂机内力实得 <b className="jh-dotted" data-tip={srcTip}>+{fmtRate(baseRate * outMult * press)}/秒</b>
        {'　'}合计压制 −{Math.round((1 - press) * 100)}%
      </div>
    </div>
  );
}
