/**
 * 魂魄芯片 —— 原型 docs/design/reincarnation-prototype.html §1-C；文案 docs/rules/copy/reincarnation.md §2。
 * 与身体芯片同一形制并排。它不是伤，所以不用伤势三色，用墨金——「已成」之色的反面：未成、未稳。
 * 魂魄安稳时不渲染：没到那一步就不露出，免得解释负担。
 */
export function SoulChip({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="wound-chip soul-chip"
      onClick={onClick}
      title="仓促离世，魂魄受创。首次突破后自复。"
      aria-label="魂魄未稳：修炼六成，首次突破后自复"
    >
      <span className="wlabel">魂魄</span>
      <span className="wname">未稳</span>
      <span className="wcount">修炼六成 · 突破后自复</span>
    </button>
  );
}
