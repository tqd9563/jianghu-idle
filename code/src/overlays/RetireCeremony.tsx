/**
 * 转世结算演出（规格书 §8.6-3）：声望入账的峰终庆典 + 本世总结；关闭后落地声望阁（§8.6-4）。
 * 与转世演出同一套 jh-ceremony.dusk 语言。文案逐字取自 docs/rules/copy/retire.md v2.3 §4；
 * 寿终 / 战死分岔见 copy/reincarnation.md v1.2 §3（死因行放在题眼位置）。
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const cnOrd = (n: number) => (n < CN.length ? CN[n] : String(n));

export function RetireCeremony({ onDone }: { onDone: () => void }) {
  const c = useGameStore((s) => s.retireCeremony);
  const repRef = useRef<HTMLSpanElement>(null);
  const total = c?.settle.total ?? 0;

  // 声望入账滚动计数；reduced-motion 直接显示终值
  useEffect(() => {
    const el = repRef.current;
    if (!el) return;
    const f = (v: number) => `声望 +${fmtBig(v)}`;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = f(total); return; }
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const p = Math.min(Math.max((t - t0 - 600) / 1100, 0), 1);
      el.textContent = f(total * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    el.textContent = f(0);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  if (!c) return null;
  // {T}：本世时长（在线 + 有效闭关）：不足 1 小时写分钟，不足 1 天写小时，否则写天（retire.md §4）
  const duration = c.lifeMinutes < 60 ? `${Math.round(c.lifeMinutes)} 分钟`
    : c.lifeMinutes < 1440 ? `${Math.round(c.lifeMinutes / 60)} 小时`
      : `${Math.round(c.lifeMinutes / 1440)} 天`;
  const battle = c.cause === 'battle';
  // {最远足迹} 措辞映射（retire.md §4）
  const footprint = c.boss3
    ? '踏平黑风寨，走完了华山古道'
    : c.maxMap === 3 ? '走到了华山古道'
      : c.maxMap === 2 ? '一路走到了洛阳近郊'
        : '足迹停在村外小径';

  return (
    <div className="jh-ceremony dusk" role="dialog" aria-label="转世结算">
      <div>
        <div className={c.cause ? 'kick cause' : 'kick'}>
          {c.cause ? <><b>{c.deathAge}</b> 岁 · {battle ? '重伤不治' : '寿终正寝'}</> : '转 世'}
        </div>
        <h2 className="mid">你的第{cnOrd(c.runEnded)}段江湖</h2>
        <div className="d">历时 {duration}，击败了 {c.strongFoes} 个强敌，{footprint}。</div>
        <div className="rep-in">
          <span className="l">江湖会记得你</span>
          <span className="v" ref={repRef}>声望 +{fmtBig(total)}</span>
          {battle && <span className="full">全额入账</span>}
        </div>
        {battle && (
          <div className="soul">
            <span className="serif">魂魄未稳</span>
            仓促离世，魂魄受了创。来世头十年，修炼只得六成。
          </div>
        )}
        <div className="acts">
          <button type="button" className="jh-btn" style={{ minWidth: 240 }} onClick={onDone}>
            {battle ? '转世 · 再入江湖' : '进入声望阁'}
          </button>
        </div>
      </div>
    </div>
  );
}
