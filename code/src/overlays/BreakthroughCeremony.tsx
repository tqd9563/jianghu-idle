/** 突破演出 —— 原型场景 5 的轻量演出（比归隐演出轻一档，The Midnight Rule） */
import type { FinalAttributes } from '../engine/attributes';
import { REALMS } from '../engine/content';
import { idleNeiliPerSec } from '../engine/formulas';

export function BreakthroughCeremony(props: {
  realmTo: number;
  prevAttrs: FinalAttributes;
  nextAttrs: FinalAttributes;
  onClose: () => void;
}) {
  const def = REALMS[props.realmTo - 1];
  return (
    <div className="breakthrough-flash open">
      <div className="c-inner">
        <div className="c-kicker fade-item">境 界 突 破</div>
        <h2 className="serif fade-item">{def.name}</h2>
        <div className="bt-sub fade-item">内力鼓荡，脱胎换骨——境界 {props.realmTo} / {REALMS.length}</div>
        <div className="bt-stats fade-item">
          <div className="kv"><span className="k">气血</span><span className="v">{props.prevAttrs.hp} → {props.nextAttrs.hp}</span></div>
          <div className="kv"><span className="k">攻击</span><span className="v">{props.prevAttrs.atk} → {props.nextAttrs.atk}</span></div>
          <div className="kv"><span className="k">防御</span><span className="v">{props.prevAttrs.def} → {props.nextAttrs.def}</span></div>
          <div className="kv"><span className="k">挂机产出</span><span className="v">{idleNeiliPerSec(props.realmTo - 1).toFixed(1)} → {idleNeiliPerSec(props.realmTo).toFixed(1)} / 秒</span></div>
          <div className="kv"><span className="k">武学上限</span><span className="v">Lv {REALMS[props.realmTo - 2].skillCap} → Lv {def.skillCap}</span></div>
        </div>
        <button className="btn fade-item" style={{ maxWidth: 280, margin: '26px auto 0' }} onClick={props.onClose}>
          {props.realmTo === 2 ? '继续 · 选择路线' : '继续'}
        </button>
      </div>
    </div>
  );
}
