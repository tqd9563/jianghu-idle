/**
 * 出关结算（MVP-1）—— 实现基准：原型场景 11（合并一屏）+ 规格 §6 呈现裁决 ①–④。
 * 资源已在 store.init 入账，本组件只呈现同一份 OfflineSettleResult（A1 三处同源之 UI 处）。
 * 构成公式行仅观察员通道显示（裁决 ②）；数值自零滚动入账，reduced-motion 降级为直接显示（裁决 ④）。
 */
import { useEffect, useRef } from 'react';
import { REALMS } from '../engine/content';
import { getStage, mapName, MAP_STAGE_COUNT, type EnemyDef } from '../engine/enemies';
import type { OfflineSettleResult } from '../engine/offlineRewards';
import { effBreakCost, mapUnlocked, nextStageOf, useGameStore, type MapNo } from '../store/gameStore';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

/** 离开时长的玩家侧措辞（原始时长，非截断值——截断在「有效闭关」行表达） */
function awayText(rawSec: number): string {
  const min = Math.floor(rawSec / 60);
  if (min < 60) return `离开 ${min} 分钟`;
  return `离开 ${Math.floor(min / 60)} 小时 ${min % 60} 分`;
}

export function OfflineSettlement(props: {
  result: OfflineSettleResult;
  observer: boolean;
  onClose: () => void;
}) {
  const { result: r } = props;
  const s = useGameStore();

  // 回归检查现状（与主界面同源：store + engine，不另行计算）
  const realmDef = REALMS[s.realm - 1];
  const breakCost = effBreakCost(s);
  const breakReady = breakCost !== null && s.dantian >= breakCost;
  let curMap: MapNo = 1;
  for (const m of [5, 4, 3, 2, 1] as MapNo[]) {
    if (mapUnlocked(m, s.clearedStages)) { curMap = m; break; }
  }
  const nextStage = nextStageOf(curMap, s.clearedStages);
  const nextBoss: EnemyDef | null = nextStage !== null ? getStage(curMap, MAP_STAGE_COUNT[curMap]) : null;

  // count-up：直接写 textContent（等宽数字列不晃，不走 60fps 的 React 重渲染）
  const durRef = useRef<HTMLSpanElement>(null);
  const neiliRef = useRef<HTMLSpanElement>(null);
  const silverRef = useRef<HTMLSpanElement>(null);
  const xpRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const items = [
      { el: durRef.current!, to: r.effectiveMin, f: (v: number) => `${v.toFixed(1)} 分钟`, delay: 0 },
      { el: neiliRef.current!, to: r.neili, f: (v: number) => `+${fmt(Math.round(v))}`, delay: 150 },
      { el: silverRef.current!, to: r.silver, f: (v: number) => `+${Math.round(v)}`, delay: 280 },
      { el: xpRef.current!, to: r.xp, f: (v: number) => `+${Math.round(v)}`, delay: 410 },
    ];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const i of items) i.el.textContent = i.f(i.to);
      return;
    }
    const DUR = 850;
    const t0 = performance.now();
    for (const i of items) { i.el.textContent = i.f(0); i.el.classList.add('counting'); }
    let raf = 0;
    const frame = (t: number) => {
      let live = false;
      for (const i of items) {
        const p = Math.min(Math.max((t - t0 - i.delay) / DUR, 0), 1);
        const e = 1 - Math.pow(1 - p, 4);
        i.el.textContent = i.f(i.to * e);
        if (p < 1) live = true; else i.el.classList.remove('counting');
      }
      if (live) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [r]);

  return (
    <div className="settle-overlay" role="dialog" aria-label="出关结算">
      <div className="settle-card panel">
        <div className="panel-head">
          出关结算 <span className="sub">{awayText(r.rawSec)}</span>
        </div>
        <div className="panel-body">
          <div className="settle-row dur">
            <span className="k">有效闭关</span>
            <span>
              <span className="v" ref={durRef} />
              {r.capped && <span className="settle-cap-tag">已达上限 {r.capMin} 分钟</span>}
              {r.debugCap && <span className="settle-cap-tag debug">调试上限</span>}
            </span>
          </div>
          <div className="settle-row neili"><span className="k">内力（入丹田）</span><span className="v" ref={neiliRef} /></div>
          <div className="settle-row"><span className="k">银两</span><span className="v" ref={silverRef} /></div>
          <div className="settle-row"><span className="k">阅历</span><span className="v" ref={xpRef} /></div>
          {r.capped && (
            <div className="settle-cap-line">丹田盈满，闭关收益已达上限——早些回来，莫让修为白流。</div>
          )}
          <div className="settle-keep">闭关期间：未突破 · 未挑战 · 未归隐——一切如你离开时。</div>
          {props.observer && (
            <div className="settle-observer">
              <span className="ob-tag">观察员</span>
              {r.effectiveMin.toFixed(1)} 分{r.capped ? '（上限截断）' : ''} × {r.tier.neiliPerMin} 内力/分
              × {Math.round(r.efficiency * 100)}% 闭关折算 = {fmt(r.neili)}
            </div>
          )}
          <div className="settle-sec">回归检查 · 你不在的这段江湖</div>
          <div className="settle-row info">
            <span className="k">境界</span>
            <span className="v">
              <span className="serif">{realmDef.name}</span> · 丹田{' '}
              {breakCost !== null
                ? <b className={breakReady ? 'gold' : undefined}>{fmt(s.dantian)} / {fmt(breakCost)}</b>
                : <b>{fmt(s.dantian)}</b>}
            </span>
          </div>
          <div className="settle-row info">
            <span className="k">推进</span>
            <span className="v">{mapName(curMap)}{nextStage !== null ? ` 第 ${nextStage} 关` : ' 已全通'}</span>
          </div>
          {nextBoss && (
            <div className="settle-row info">
              <span className="k">下一强敌</span>
              <span className="v">{nextBoss.name}（推荐境界 {nextBoss.recommendedRealm}）</span>
            </div>
          )}
          {breakReady && (
            <div className="settle-keep gold">五周天圆满，突破就绪——闭关不会替你突破，这一下要你亲手来。</div>
          )}
          <button className="btn" style={{ marginTop: 14 }} onClick={props.onClose}>出关 · 回归江湖</button>
        </div>
      </div>
    </div>
  );
}
