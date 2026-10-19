/**
 * 出关演出 —— 定稿原型 docs/design/ui-overhaul-prototype.html `#d-offline`（jh-ceremony.calm）。
 * 资源已在 store.init 入账，本组件只呈现同一份 OfflineSettleResult（A1 三处同源之 UI 处）。
 * 构成公式仅观察员通道显示，放进悬停（裁决 ②）；数值自零滚动入账，reduced-motion 降级为直接显示（裁决 ④）。
 */
import { useEffect, useRef } from 'react';
import type { OfflineSettleResult } from '../engine/offlineRewards';
import { gearFullName, type GearItem } from '../engine/gear';
import { SECTS, SECT_TASKS, type SectTaskKind } from '../engine/sect';
import { useGameStore } from '../store/gameStore';
import { fmtBig as fmt, fmtRate, minText, shichenText } from '../fmt';

/** 离开时长的玩家侧措辞（原始时长，非截断值） */
function awayText(rawSec: number): string {
  return `离开 ${minText(rawSec)}`;
}

/** 关卡键里的关数（'m1t0s38' → 38） */
const idleStageNo = (key: string) => key.match(/s(\d+)$/)?.[1] ?? key;

function fmtLeft(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} 小时 ${min % 60} 分` : `${min} 分`;
}

export function OfflineSettlement(props: {
  result: OfflineSettleResult;
  observer: boolean;
  /** 闭关期间到点结算的门派任务（store 目前未透出，接上后显示「已归」一行） */
  sectDone?: { kind: SectTaskKind; contrib: number } | null;
  /** 闭关期间挂机拾得的装备 */
  loot?: { count: number; best: GearItem | null; sold: number; books?: number; pages?: number } | null;
  onClose: () => void;
}) {
  const { result: r, sectDone, loot } = props;
  const sect = useGameStore((s) => s.sect);
  const sectTask = useGameStore((s) => s.sectTask);
  const errand = (k: SectTaskKind) => (sect ? SECTS[sect].errands[k === 'short' ? 0 : 1] : SECT_TASKS[k].name);

  // count-up：直接写 textContent（等宽数字列不晃，不走 60fps 的 React 重渲染）
  const neiliRef = useRef<HTMLElement>(null);
  const silverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const items = [
      { el: neiliRef.current!, to: r.neili, delay: 0 },
      { el: silverRef.current!, to: r.silver, delay: 150 },
    ];
    const f = (v: number) => `+${fmt(v)}`;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const i of items) i.el.textContent = f(i.to);
      return;
    }
    const DUR = 850;
    const t0 = performance.now();
    for (const i of items) { i.el.textContent = f(0); i.el.classList.add('counting'); }
    let raf = 0;
    const frame = (t: number) => {
      let live = false;
      for (const i of items) {
        const p = Math.min(Math.max((t - t0 - 400 - i.delay) / DUR, 0), 1);
        i.el.textContent = f(i.to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) live = true; else i.el.classList.remove('counting');
      }
      if (live) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [r]);

  const obsTip = `${r.effectiveMin.toFixed(1)} 分${r.capped ? '（上限截断）' : ''} × ${fmtRate(r.neiliPerSec)} 内力/秒 × 60`
    + ` × ${Math.round(r.efficiency * 100)}% 闭关折算 = ${fmt(r.neili)}`;

  return (
    <div className="jh-ceremony calm" role="dialog" aria-label="出关">
      <div>
        <div className="kick">出 关</div>
        <h2 className="mid">{shichenText(r.effectiveMin)}</h2>
        <div className="d">
          {awayText(r.rawSec)}
          {r.capped && ` · 收益以 ${Math.round(r.capMin / 60)} 小时计`}
        </div>
        <div className="gains">
          <span>内力</span><span><b ref={neiliRef} /></span>
          <span>银两</span><span><b ref={silverRef} /></span>
          {r.idle && (
            <><span>挂机</span><span>第 {idleStageNo(r.idle.stageKey)} 关 · <b>{r.idle.fights}</b> 场 · 胜 {r.idle.wins}</span></>
          )}
          {loot && loot.count > 0 && (
            <><span>拾得</span><span><b>{loot.count}</b> 件{loot.best && <> · <span className={`g${loot.best.grade}`}>{gearFullName(loot.best)}</span></>}{loot.sold > 0 && ` · 放不下的卖得 ${loot.sold} 两`}</span></>
          )}
          {loot && ((loot.books ?? 0) + (loot.pages ?? 0)) > 0 && (
            <><span>书匣</span><span>{(loot.books ?? 0) > 0 && <>全本 <b>{loot.books}</b> 门</>}{(loot.books ?? 0) > 0 && (loot.pages ?? 0) > 0 && ' · '}{(loot.pages ?? 0) > 0 && <>残页 <b>{loot.pages}</b> 张</>}</span></>
          )}
          {sectDone ? (
            <><span>门派任务</span><span>{errand(sectDone.kind)}已归 · <b>+{sectDone.contrib}</b> 贡献</span></>
          ) : sectTask && (
            <><span>门派任务</span><span>{errand(sectTask.kind)} · 还剩 {fmtLeft(sectTask.endsAt - Date.now())}</span></>
          )}
        </div>
        {props.observer && (
          <div className="obs">
            <span data-tip={obsTip}>观察员 · 内力构成</span>
            {r.debugCap && ' · 调试上限'}
          </div>
        )}
        <div className="acts">
          <button type="button" className="jh-btn" style={{ minWidth: 240 }} onClick={props.onClose}>回归江湖</button>
        </div>
      </div>
    </div>
  );
}
