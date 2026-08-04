/**
 * 周天年轮 —— 实现基准：docs/design/zhoutian-mandala-prototype.html（获批原型）
 * 权威来源：docs/systems/zhoutian/spec.md §1（呈现一致性三层语义）+ design.md §3（数值）
 *          + docs/rules/copy/zhoutian.md（冻结文案，逐字使用）
 *
 * 呈现一致性三层语义在本组件的落点（spec §1 验收项）：
 *   进度回落 → 周天环当前段的填充比例（内力支取后如实回落）
 *   印记常亮 → 段外侧珠点，按 chargeHighWater 常亮，不随回落消失
 *   气势条   → QishiBar 独立成条，与充能进度语义分离
 *
 * 结构：buildMandalaModel 为纯视图模型（几何与状态推导，可单测），
 * 组件只负责把模型画成 SVG。窍穴池/经脉分组见 engine/acupoints，周天段数见 content.REALMS——
 * 后续增脉增穴只改数据，本图自行生长，无需改布局代码。
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { QISHI_FULL, qishiToBonus } from '../engine/acupoints';
import { effBreakCost, useGameStore } from '../store/gameStore';
import {
  buildMandalaModel, fmt, slotGeometry, acuLabelLayout, polar, arcPath, arcLen,
  VIEW_W, VIEW_H, CX, CY, R_ZT, R_PEARL, R_QI, R_M, R_M_LABEL, ZT_GAP_DEG,
} from './zhoutianMandalaModel';
import type { MandalaAcupoint, MandalaSlot } from './zhoutianMandalaModel';

/** 气势条（spec §1 第三层语义：丹田充满后溢出可见，与充能进度语义分离） */
export function QishiBar(): JSX.Element {
  const qishi = useGameStore(s => s.qishi ?? 0);
  const bonus = qishiToBonus(qishi);
  const pct = Math.min(100, (qishi / QISHI_FULL) * 100);
  return (
    <div className="qishi-bar" aria-label={`气势 ${Math.floor(qishi)} / ${QISHI_FULL}`}>
      <span className="k">气势</span>
      <span className="mini-bar"><i style={{ width: `${pct}%` }} /></span>
      <span className="v">{Math.floor(qishi)} / {QISHI_FULL} · +{Math.round(bonus * 100)}pp</span>
    </div>
  );
}

export function ZhoutianMandala(): JSX.Element | null {
  const s = useGameStore();
  const [feedback, setFeedback] = useState<string | null>(null);

  const model = buildMandalaModel({
    realm: s.realm,
    dantian: s.dantian,
    breakCost: effBreakCost(s),
    chargeHighWater: s.chargeHighWater,
    chongxueChances: s.chongxueChances ?? 0,
    qishi: s.qishi ?? 0,
    acupointProgress: s.acupointProgress ?? {},
  });
  if (model === null) return null;

  const onAttempt = (slot: Extract<MandalaSlot, { locked: false }>, acu: MandalaAcupoint): void => {
    const before = useGameStore.getState().acupointProgress?.[acu.id] ?? { failCount: 0, opened: false };
    s.attemptAcupoint(acu.id);
    const after = useGameStore.getState();
    const now = after.acupointProgress?.[acu.id] ?? before;
    if (!now.opened) {
      setFeedback('窍穴松动几分');                                     // 冻结文案 §1
      return;
    }
    // 第 3 次必成（design.md §3.3 必成兜底）：措辞与普通成功区分
    const line = before.failCount >= 2
      ? `气血已通 · ${acu.name}`                                       // 冻结文案 §1
      : `行气冲穴 · ${acu.name} 已通`;                                  // 冻结文案 §1
    const justThrough = slot.openedCount + 1 === slot.total;
    setFeedback(justThrough ? `${line} · 经脉贯通 · ${slot.name}` : line);   // 冻结文案 §4
  };

  return (
    <div className="zhoutian-mandala">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mandala-svg"
        role="img"
        aria-label={`周天年轮：丹田内力 ${fmt(model.dantianShown)} / ${fmt(model.cost)}，周天 ${model.segments.filter(x => x.filled >= 1).length} / ${model.n}`}
      >
        {/* ── 外圈：经脉弧与窍穴（未解锁脉位虚线占位） ── */}
        {model.slots.map((slot, si) => {
          const { mid, span } = slotGeometry(si);
          const d = arcPath(R_M, mid - span / 2, mid + span / 2);
          const [lx, ly] = polar(R_M_LABEL, mid);

          if (slot.locked) {
            return (
              <g key={`slot-${si}`} className="m-slot locked">
                <path d={d} className="m-arc locked" />
                <text x={lx} y={ly} className="m-name serif locked" textAnchor="middle">{slot.name}</text>
                <text x={lx} y={ly + 15} className="m-bonus" textAnchor="middle">
                  境界 {slot.unlockRealm ?? '—'} 解锁
                </text>
              </g>
            );
          }

          return (
            <g key={slot.id} className={`m-slot${slot.through ? ' through' : ''}`}>
              <path d={d} className="m-arc" />
              <path d={d} className="m-flow" />
              {slot.acupoints.map((acu, ai) => {
                const deg = mid - span / 2 + (span * (ai + 0.5)) / slot.acupoints.length;
                const [nx, ny] = polar(R_M, deg);
                const label = acuLabelLayout(deg);
                const [tx, ty] = polar(label.r, deg);
                return (
                  <g key={acu.id}>
                    <circle
                      cx={nx} cy={ny} r={9}
                      className={`acu${slot.through ? ' through' : acu.opened ? ' opened' : ''}${acu.actionable ? ' actionable' : ''}`}
                      role="button"
                      tabIndex={acu.actionable ? 0 : -1}
                      aria-disabled={!acu.actionable}
                      aria-label={
                        acu.opened
                          ? `${acu.name} 已通`
                          : model.chances > 0
                            ? `${acu.name} 未通，冲穴成功率 ${Math.round(acu.rate * 100)}%`
                            : `${acu.name} 未通 · 冲穴机会不足 · 运转周天获取`
                      }
                      onClick={() => { if (acu.actionable) onAttempt(slot, acu); }}
                      onKeyDown={e => {
                        if (acu.actionable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onAttempt(slot, acu);
                        }
                      }}
                    />
                    <text x={tx} y={ty + 4} className={`acu-t${acu.opened ? ' opened' : ''}`} textAnchor={label.anchor}>
                      {acu.name}
                    </text>
                    {acu.actionable && (
                      <text x={tx} y={ty + 16} className="acu-rate" textAnchor={label.anchor}>
                        {Math.round(acu.rate * 100)}%{acu.failCount > 0 ? ` · 松动${acu.failCount}` : ''}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={lx} y={ly} className="m-name serif" textAnchor="middle">{slot.name}</text>
              <text x={lx} y={ly + 15} className="m-bonus" textAnchor="middle">
                {slot.through ? '贯通' : `${slot.openedCount}/${slot.total}`}
              </text>
            </g>
          );
        })}

        {/* ── 内圈：丹田周天环（分段充能 + 高水位印记） ── */}
        {model.segments.map((seg, i) => {
          const step = 360 / model.n;
          const d0 = -90 + step * i + ZT_GAP_DEG / 2;
          const d1 = -90 + step * (i + 1) - ZT_GAP_DEG / 2;
          const d = arcPath(R_ZT, d0, d1);
          const len = arcLen(R_ZT, d1 - d0);
          return (
            <g key={`zt-${i}`}>
              <path d={d} className="zt-track" />
              {seg.filled > 0 && (
                <path d={d} className="zt-fill" strokeDasharray={`${len * seg.filled} ${len}`} />
              )}
              {/* 印记常亮（spec §1）：已圆满的周天在内侧留一道常亮金轨，不随进度回落消失 */}
              {seg.pearl && <path d={arcPath(R_PEARL, d0, d1)} className="zt-pearl" />}
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={R_QI} className="zt-flow" />

        <text x={CX} y={CY - 20} className="zt-l" textAnchor="middle">丹田内力</text>
        <text x={CX} y={CY + 3} className="zt-v" textAnchor="middle">{fmt(model.dantianShown)}</text>
        <text x={CX} y={CY + 19} className="zt-l" textAnchor="middle">/ {fmt(model.cost)}</text>
        <text x={CX} y={CY + 38} className="zt-c" textAnchor="middle">{model.centerText}</text>
      </svg>

      <div className="mandala-status" role="status">{feedback ?? model.statusText}</div>
    </div>
  );
}
