/**
 * 伤势详情面板 —— 原型 docs/design/injury-prototype.html §2。
 * 三类伤各一行（压了什么、还剩多久养好）+ 挂机产出来源分解（账台精神：每笔压制可核对）。
 */
import {
  INJURY_IDS, INJURY_DEFS, SEVERITY_NAME, SEVERITY_PRESS, SEVERITY_HEAL_MIN,
  healRealmFactor, idleOutputMultiplier, isHurt,
  type Injuries, type InjuryId, type Severity,
} from '../engine/injury';
import { idleNeiliPerSec } from '../engine/formulas';
import { SOUL_WEAK_MULT } from '../engine/reincarnation';
import { SeverityMeter } from './WoundChip';

const TYPE_CLASS: Record<InjuryId, string> = { wai: 't-wai', nei: 't-nei', du: 't-du' };

/** 各伤型压了哪些战斗属性（spec §1 combat 列），按当前严重度展开为文案 */
function combatEffectText(id: InjuryId, severity: Severity): string {
  const p = SEVERITY_PRESS[severity as Exclude<Severity, 0>];
  const pct = (v: number) => `−${Math.round(v * 100)}%`;
  if (id === 'wai') return `防御 ${pct(p)} · 血上限 ${pct(p * 0.66)}`;
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

export function WoundPanel({ injuries, realm, soulUnsettled = false }: {
  injuries: Injuries; realm: number;
  /** 魂魄未稳（reincarnation/spec.md §4.1）：与伤势压制同一乘法链，列进同一张来源分解 */
  soulUnsettled?: boolean;
}) {
  const hurt = isHurt(injuries);
  const factor = healRealmFactor(realm);
  const baseRate = idleNeiliPerSec(realm);
  const mult = idleOutputMultiplier(injuries) * (soulUnsettled ? SOUL_WEAK_MULT : 1);

  // 无伤且魂魄安稳：收成一行，不铺三个空位
  if (!hurt && !soulUnsettled) {
    return (
      <section className="panel wound-panel healthy">
        <header>
          <h3>身体状况</h3>
          <span className="hint">并无伤病</span>
        </header>
      </section>
    );
  }

  return (
    <section className="panel wound-panel">
      <header>
        <h3>身体状况</h3>
        <span className="hint">{hurt ? '挂机静养中 · 离线同样恢复' : '魂魄未稳 · 首次突破后自复'}</span>
      </header>
      <div className="body">
        {hurt && INJURY_IDS.map((id) => {
          const { severity, healAccMin } = injuries[id];
          const def = INJURY_DEFS[id];
          if (severity === 0) {
            return (
              <div className="wrow none" key={id}>
                <div className="wtype">
                  <SeverityMeter severity={0} />
                  <span className="nm">{def.name}</span>
                </div>
                <div className="weff">无</div>
                <div className="wheal" />
              </div>
            );
          }
          const stageNeed = SEVERITY_HEAL_MIN[severity as Exclude<Severity, 0>] * factor;
          const left = Math.max(0, stageNeed - healAccMin);
          return (
            <div className="wrow" key={id}>
              <div className={`wtype ${TYPE_CLASS[id]}`}>
                <SeverityMeter severity={severity} />
                <span className="nm">{def.name} · {SEVERITY_NAME[severity]}</span>
              </div>
              <div className="weff">
                {combatEffectText(id, severity)}
                {' · 挂机内力 '}
                <b>−{Math.round(idlePressPct(id, severity) * 100)}%</b>
                <div className={`healbar ${TYPE_CLASS[id]}`}>
                  <i style={{ width: `${Math.min(100, (healAccMin / stageNeed) * 100)}%` }} />
                </div>
              </div>
              <div className="wheal">
                <div className="t">{fmtMin(left)}</div>
                <div className="l">{severity === 1 ? '痊愈' : `转为${SEVERITY_NAME[(severity - 1) as Severity]}伤`}</div>
              </div>
            </div>
          );
        })}

        {(hurt || soulUnsettled) && (
          <div className="breakdown">
            <div className="bt">挂机内力产出 · 来源分解</div>
            <div className="brow">
              <span className="k">境界 {realm} 基础产出</span>
              <span className="v">+{baseRate.toFixed(1)}/秒</span>
            </div>
            {INJURY_IDS.filter((id) => injuries[id].severity > 0).map((id) => (
              <div className="brow" key={id}>
                <span className="k">{INJURY_DEFS[id].name} · {SEVERITY_NAME[injuries[id].severity]}</span>
                <span className="v neg">×{(1 - idlePressPct(id, injuries[id].severity)).toFixed(4)}</span>
              </div>
            ))}
            {soulUnsettled && (
              <div className="brow">
                <span className="k">魂魄未稳</span>
                <span className="v neg">×{SOUL_WEAK_MULT.toFixed(4)}</span>
              </div>
            )}
            <div className="brow total">
              <span className="k">当前实得</span>
              <span className="v">+{(baseRate * mult).toFixed(1)}/秒</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
