/**
 * 突破演出 —— 视觉基准 docs/design/ui-overhaul-prototype.html `#d-break`（jh-ceremony 金色底）。
 * 小字题眼 → 境界名 → 一行说明 → 得失对照（含本次解锁）→ 按钮。
 */
import { Fragment } from 'react';
import type { FinalAttributes } from '../engine/attributes';
import { REALMS } from '../engine/content';
import { RUMOR } from '../engine/sect';
import { slotCount } from '../engine/wuxue';
import { fmtRate } from '../fmt';
import { effIdleRate, useGameStore } from '../store/gameStore';

/** 本次突破解锁了什么：境界 2 开内功与武学，境界 3 开门派，其后每境多一个武学槽 */
function unlocksOf(realmTo: number): string[] {
  if (realmTo === 2) return ['内功', '武学', '书肆'];
  const extra = slotCount(realmTo) > slotCount(realmTo - 1) ? [`武学第 ${slotCount(realmTo)} 槽`] : [];
  return realmTo === 3 ? ['门派', ...extra] : extra;
}

export function BreakthroughCeremony(props: {
  realmTo: number;
  prevAttrs: FinalAttributes;
  nextAttrs: FinalAttributes;
  onClose: () => void;
}) {
  const s = useGameStore();
  const def = REALMS[props.realmTo - 1];
  const { prevAttrs: a0, nextAttrs: a1 } = props;
  const unlocks = unlocksOf(props.realmTo);
  const rate0 = effIdleRate({ ...s, realm: props.realmTo - 1 });
  const rate1 = effIdleRate({ ...s, realm: props.realmTo });

  return (
    <div className="jh-ceremony bt-ceremony" role="dialog" aria-modal="true" aria-label={`境界突破 · ${def.name}`}>
      <div>
        <div className="kick">境 界 突 破</div>
        <h2>{def.name}</h2>
        <div className="d">内力鼓荡，脱胎换骨</div>
        <div className="gains">
          <span>气血</span><span>{a0.hp} → <b>{a1.hp}</b></span>
          <span>攻击</span><span>{a0.atk} → <b>{a1.atk}</b></span>
          <span>防御</span><span>{a0.def} → <b>{a1.def}</b></span>
          <span>挂机产出</span><span>{fmtRate(rate0)} → <b>{fmtRate(rate1)}</b> / 秒</span>
          {unlocks.length > 0 && (
            <>
              <span>解锁</span>
              {/* 新系统加粗，武学槽照常；不嵌 span，免得吃到 .gains span:nth-child 的对齐规则 */}
              <span>{unlocks.map((u, i) => (
                <Fragment key={u}>{i > 0 && ' · '}{u.startsWith('武学第') ? u : <b>{u}</b>}</Fragment>
              ))}</span>
            </>
          )}
        </div>
        {props.realmTo === 2 && (
          <div className="rumor"><span className="serif">江湖传闻</span>{RUMOR}</div>
        )}
        <button type="button" className="jh-btn" onClick={props.onClose}>
          {props.realmTo === 2 ? '继续 · 选择内功' : '继续'}
        </button>
      </div>
    </div>
  );
}
