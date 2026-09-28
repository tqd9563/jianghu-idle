/**
 * 年岁行 —— 原型 docs/design/reincarnation-prototype.html §1；文案 docs/rules/copy/reincarnation.md §1。
 * 挂在境界之下、同一身份块：年岁回答「这一世走到哪」，江湖历回答「世界走到哪」。
 * 平日只是两个数，不做倒计时、不画进度条——寿元是容量上限，不是沙漏。
 */
import { DUSK_MARGIN, currentEra, isDusk, lifespanCap } from '../engine/reincarnation';

export function AgeLine({ age, eraStart, lifespanLost }: { age: number; eraStart: number; lifespanLost: number }) {
  const dusk = isDusk(age, lifespanLost);
  const cap = lifespanCap(lifespanLost);
  const title = dusk
    ? `寿元 ${cap} 岁 · 再受一次重伤即寿终`
    : `寿元 ${cap} 岁 · 重伤一次折寿 ${DUSK_MARGIN} 年`;
  return (
    <div className={`age-line${dusk ? ' dusk' : ''}`} title={title}>
      <span className="age"><b>{Math.floor(age)}</b> 岁</span>
      {dusk && <span className="dusk-tag">垂暮</span>}
      <span className="era">江湖历 <b>{Math.floor(currentEra(eraStart, age))}</b> 年</span>
    </div>
  );
}
