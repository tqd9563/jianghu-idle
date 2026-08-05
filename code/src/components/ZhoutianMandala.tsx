/**
 * 周天年轮 —— 实现基准：docs/design/zhoutian-liquid-v9.html（获批原型）
 * 权威来源：docs/systems/zhoutian/spec.md §1（呈现一致性三层语义）+ design.md §3（数值）
 *          + docs/rules/copy/zhoutian.md（冻结文案，逐字使用）
 *
 * 呈现一致性三层语义在本组件的落点（spec §1 验收项）：
 *   进度回落 → 丹田墨池的液面高度（内力支取后如实退落）
 *   印记常亮 → 池沿周天刻度，按 chargeHighWater 转金，不随回落消失
 *   气势条   → QishiBar 独立成条，与充能进度语义分离
 *
 * 潮落的时机是「周天圆满」而非「冲穴」：冲穴消耗的是机会不是内力，
 * 液面不因冲穴而动；段内液面 = 内力对每周天消耗的取模，涨满即翻转归零。
 *
 * 结构：buildMandalaModel 为纯视图模型（几何与状态推导，可单测），
 * 组件只负责把模型画成 SVG；液面与气粒子由 rAF 直接改属性，不触发 React 重渲染。
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { QISHI_FULL, qishiToBonus } from '../engine/acupoints';
import { effBreakCost, effChongxueChances, useGameStore } from '../store/gameStore';
import {
  buildMandalaModel, fmt, slotGeometry, acuLabelLayout, polar, arcPath, liquidPath, surfaceY,
  VIEW_W, VIEW_H, CX, CY, R_POOL, R_SEG, R_M, R_M_LABEL, SEG_GAP_DEG,
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

// ── 气粒子：墨色微粒自水面之下升起，抵达水面即散 ──
// 只在完全透明的那一帧重生，因此不会出现「凭空冒出」的瞬移。
const QI_COUNT = 14;
const POOL_BOTTOM = CY + R_POOL - 4;

interface Qi {
  el: SVGCircleElement;
  t: number; x: number; y0: number; rise: number; dur: number; phase: number; dead: boolean;
}

function spawnQi(p: Qi, surfY: number, stagger: boolean): void {
  const span = POOL_BOTTOM - surfY;
  if (span < 8) { p.dead = true; p.el.style.opacity = '0'; return; }   // 水太浅，无处可生
  p.dead = false;
  const depth = 8 + Math.random() * (span - 8);
  const y = surfY + depth;
  const half = Math.sqrt(Math.max(0, R_POOL * R_POOL - (y - CY) * (y - CY)));
  p.x = CX + (Math.random() - 0.5) * 1.6 * Math.max(3, half - 7);
  p.y0 = y;
  p.rise = depth - 2;                       // 恰好升到液面附近即散
  p.dur = 2.2 + Math.random() * 2.0;
  p.phase = Math.random() * Math.PI * 2;
  p.t = stagger ? Math.random() : 0;
  p.el.setAttribute('r', (1.5 + Math.random() * 2.0).toFixed(1));
}

function stepQi(list: Qi[], dt: number, surfY: number): void {
  for (const p of list) {
    p.t += dt / (p.dur || 3);
    if (p.t >= 1) spawnQi(p, surfY, false);
    if (p.dead) continue;
    // 液面已退到生点之上（支取内力）：就地加速淡出，而不是瞬移
    if (p.y0 < surfY - 2) p.t = Math.max(p.t, 0.78);
    const k = p.t;
    const op = (k < 0.18 ? k / 0.18 : k > 0.7 ? (1 - k) / 0.3 : 1) * 0.42;
    p.el.setAttribute('cx', (p.x + Math.sin(k * Math.PI * 2 + p.phase) * 1.6).toFixed(1));
    p.el.setAttribute('cy', (p.y0 - p.rise * k).toFixed(1));
    // inline style：CSS 规则优先级高于 presentation attribute，用属性会被盖掉
    p.el.style.opacity = op.toFixed(3);
  }
}

export function ZhoutianMandala(): JSX.Element | null {
  const s = useGameStore();
  const [feedback, setFeedback] = useState<string | null>(null);

  const model = buildMandalaModel({
    realm: s.realm,
    dantian: s.dantian,
    breakCost: effBreakCost(s),
    chargeHighWater: s.chargeHighWater,
    chongxueChances: effChongxueChances(s),
    qishi: s.qishi ?? 0,
    acupointProgress: s.acupointProgress ?? {},
  });

  const poolPct = model?.poolPct ?? 0;
  const targetRef = useRef(poolPct);
  const bodyRef = useRef<SVGPathElement>(null);
  const surfRef = useRef<SVGPathElement>(null);
  const liquidClipRef = useRef<SVGPathElement>(null);
  const qiGroupRef = useRef<SVGGElement>(null);
  const centerRef = useRef<SVGGElement>(null);

  useEffect(() => { targetRef.current = poolPct; }, [poolPct]);

  /** 沉入水下的文字改用亮色——墨是深的，深墨字压在深墨上读不出来 */
  const markSubmerged = (surfY: number): void => {
    const nodes = centerRef.current?.querySelectorAll<SVGTextElement>('[data-sy]');
    nodes?.forEach(el => {
      const y = Number(el.dataset.sy);
      el.classList.toggle('submerged', surfY < y - 4);
    });
  };

  useEffect(() => {
    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 降级：静止液面（path 由 render 直出），只跟着模型更新文字对比
    if (reduce) { markSubmerged(surfaceY(poolPct)); return; }

    const qis: Qi[] = [];
    qiGroupRef.current?.querySelectorAll('circle').forEach(el => {
      qis.push({ el, t: 1, x: CX, y0: POOL_BOTTOM, rise: 0, dur: 3, phase: 0, dead: false });
    });
    qis.forEach(p => spawnQi(p, surfaceY(targetRef.current), true));

    let disp = targetRef.current;
    let prev = performance.now();
    let raf = 0;
    const step = (now: number): void => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      // 平滑追踪：周天圆满时目标由 1 跳回 0，这里即呈现为约 0.6s 的潮落
      disp += (targetRef.current - disp) * Math.min(1, dt * 7);
      const baseY = surfaceY(disp);
      const lp = liquidPath(baseY, 2.2, 2.6, (now / 1000) * 0.9);
      bodyRef.current?.setAttribute('d', lp.body);
      liquidClipRef.current?.setAttribute('d', lp.body);
      surfRef.current?.setAttribute('d', lp.top);
      stepQi(qis, dt, baseY);
      markSubmerged(baseY);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model === null]);

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

  const still = liquidPath(surfaceY(poolPct), 0, 2.6, 0);   // 首帧/降级用的静止液面

  return (
    <div className="zhoutian-mandala">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mandala-svg"
        role="img"
        aria-label={`周天年轮：丹田内力 ${fmt(model.dantianShown)} / ${fmt(model.cost)}，周天 ${model.segFull} / ${model.n}`}
      >
        <defs>
          <clipPath id="zt-pool-clip">
            <circle cx={CX} cy={CY} r={R_POOL - 3} />
          </clipPath>
          {/* 水体形状本身也是一层裁剪：暗流与气粒只在水面之下可见，
              否则它们会浮在液面之上的空池里，读作划痕与浮尘 */}
          <clipPath id="zt-liquid-clip">
            <path ref={liquidClipRef} d={still.body} />
          </clipPath>
          {/* 水体：自池底浓墨向液面渐淡的半透明墨——墨是透的，故中心数字始终可读 */}
          <linearGradient id="zt-liquid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" className="lq-0" />
            <stop offset="35%" className="lq-1" />
            <stop offset="75%" className="lq-2" />
            <stop offset="100%" className="lq-3" />
          </linearGradient>
        </defs>

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
              {/* 经脉=管道，流光=管中之气：两者异色，否则同色叠同色看不见流动 */}
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

        {/* ── 池沿周天刻度：印记常亮（spec §1 第二层），不随回落消失 ── */}
        {model.segments.map((seg, i) => {
          const step = 360 / model.n;
          const d = arcPath(R_SEG, -90 + step * i + SEG_GAP_DEG / 2, -90 + step * (i + 1) - SEG_GAP_DEG / 2);
          return <path key={`seg-${i}`} d={d} className={`zt-seg${seg.pearl ? ' pearl' : ''}`} />;
        })}

        {/* ── 丹田墨池：液面 = 段内进度（spec §1 第一层） ── */}
        <circle cx={CX} cy={CY} r={R_POOL} className={`zt-pool-rim${model.ready ? ' ready' : ''}`} />
        <path ref={bodyRef} d={still.body} fill="url(#zt-liquid)" clipPath="url(#zt-pool-clip)" />
        <path ref={surfRef} d={still.top} className="zt-surface" clipPath="url(#zt-pool-clip)" />
        <g clipPath="url(#zt-pool-clip)">
          <g clipPath="url(#zt-liquid-clip)">
            {/* 池内暗流：极淡墨弧缓转，示意内力在运转 */}
            <g className="zt-currents">
              <path className="zt-current inner" d={[18, 28, 42].map(r =>
                [0, 1, 2, 3].map(k => arcPath(r, -90 + k * 95 + 15, -90 + k * 95 + 75)).join(' ')).join(' ')} />
              <path className="zt-current outer" d={[52, 65].map(r =>
                [0, 1, 2, 3].map(k => arcPath(r, -90 + k * 95 + 15, -90 + k * 95 + 75)).join(' ')).join(' ')} />
            </g>
            <g ref={qiGroupRef}>
              {Array.from({ length: QI_COUNT }, (_, i) => (
                <circle key={`qi-${i}`} cx={CX} cy={POOL_BOTTOM} r={2} className="qi-particle" />
              ))}
            </g>
          </g>
        </g>

        <g ref={centerRef} className="zt-center">
          <text x={CX} y={CY - 20} data-sy={CY - 20} className="zt-l" textAnchor="middle">丹田内力</text>
          <text x={CX} y={CY + 3} data-sy={CY + 3} className="zt-v" textAnchor="middle">{fmt(model.dantianShown)}</text>
          <text x={CX} y={CY + 19} data-sy={CY + 19} className="zt-l" textAnchor="middle">/ {fmt(model.cost)}</text>
          <text x={CX} y={CY + 38} data-sy={CY + 38} className={`zt-c${model.ready ? ' ready' : ''}`} textAnchor="middle">
            {model.centerText}
          </text>
        </g>
      </svg>

      <div className="mandala-status" role="status">{feedback ?? model.statusText}</div>
    </div>
  );
}
