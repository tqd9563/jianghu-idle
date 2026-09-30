/**
 * 悬停解释层 —— DESIGN.md：公式与推导放进悬停，不铺在界面上。
 * 任何元素加 data-tip="文字"（可含 <br>）即可；全局只挂一个浮层，position: fixed 不会被容器裁掉。
 */
import { useEffect, useRef } from 'react';

export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current!;
    const over = (e: MouseEvent) => {
      const t = (e.target as Element | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!t || !t.dataset.tip) return;
      tip.innerHTML = t.dataset.tip;
      tip.classList.add('on');
      const r = t.getBoundingClientRect();
      const w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = `${r.bottom + 8 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8}px`;
    };
    const out = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-tip]')) tip.classList.remove('on');
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('mouseout', out); };
  }, []);
  return <div ref={ref} className="jh-tip" role="tooltip" />;
}
