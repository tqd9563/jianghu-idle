/**
 * 伤势指示器 —— 原型 docs/design/injury-prototype.html §1、DESIGN.md「严重度指示器 severity-meter」。
 * 顶栏常驻：只显示最重的一处 + 另 N 处；完整三行留给详情面板。
 * 严重度用「颜色 + 格数 + 文字」三重编码，不以颜色为唯一区分（DESIGN.md Semantic Ink Rule）。
 */
import {
  INJURY_DEFS, SEVERITY_NAME, worstInjury, hurtCount,
  type Injuries, type InjuryId, type Severity,
} from '../engine/injury';

/** 伤型 → DESIGN.md 语义色：外伤血褐、内伤淤紫、毒伤毒翠 */
const TYPE_CLASS: Record<InjuryId, string> = { wai: 't-wai', nei: 't-nei', du: 't-du' };

export function SeverityMeter({ severity }: { severity: Severity }) {
  return (
    <span className={`sev s${severity}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

export function WoundChip({ injuries, onClick }: { injuries: Injuries; onClick?: () => void }) {
  const worst = worstInjury(injuries);
  const count = hurtCount(injuries);

  if (!worst) {
    return (
      <div className="wound-chip healthy">
        <span className="wlabel">身体</span>
        <span className="wname">安好</span>
      </div>
    );
  }

  const def = INJURY_DEFS[worst.id];
  const label = `${def.name} · ${SEVERITY_NAME[worst.severity]}`;
  return (
    <button
      type="button"
      className="wound-chip"
      onClick={onClick}
      aria-label={count > 1 ? `身体：${label}，另 ${count - 1} 处伤` : `身体：${label}`}
    >
      <span className="wlabel">身体</span>
      <span className={`wmain ${TYPE_CLASS[worst.id]}`}>
        <SeverityMeter severity={worst.severity} />
        <span className="wname">{label}</span>
      </span>
      {count > 1 && <span className="wcount">另 {count - 1} 处</span>}
    </button>
  );
}
