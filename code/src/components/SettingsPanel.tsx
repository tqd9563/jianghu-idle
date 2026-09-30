/**
 * 设置面板 —— 侧栏齿轮弹出（原型「设置」节；BACKLOG「设置统一入口」并入）。
 * 卡片底色存 localStorage，index.html 启动脚本先行套用，避免首帧闪烁；画面主题沿用 SkinPicker。
 */
import { useEffect, useRef, useState } from 'react';
import { SkinPicker } from './SkinPicker';

export type CardTone = 'gray' | 'teal' | 'wood' | 'lacquer';
const KEY = 'jianghu-idle:card:v1';
const TONES: { id: CardTone; name: string; swatch: string }[] = [
  { id: 'gray', name: '冷灰', swatch: 'linear-gradient(135deg, oklch(0.3 0.017 262), oklch(0.22 0.014 262))' },
  { id: 'teal', name: '墨青', swatch: 'linear-gradient(160deg, oklch(0.3 0.035 215), oklch(0.21 0.02 228))' },
  { id: 'wood', name: '檀木', swatch: 'linear-gradient(160deg, oklch(0.3 0.035 58), oklch(0.2 0.018 50))' },
  { id: 'lacquer', name: '漆底描金', swatch: 'oklch(0.12 0.01 262)' },
];

function readTone(): CardTone {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'gray' || v === 'teal' || v === 'wood' || v === 'lacquer') return v;
  } catch { /* 隐私模式读不到时退回默认 */ }
  return 'gray';
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [tone, setTone] = useState<CardTone>(readTone);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element;
      // 皮肤弹窗挂在面板外（全屏遮罩），点它不算点外面
      if (ref.current?.contains(t) || t.closest('.skin-modal, .modal-backdrop, .js-settings-toggle')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const pick = (id: CardTone) => {
    setTone(id);
    document.documentElement.setAttribute('data-card', id);
    try { localStorage.setItem(KEY, id); } catch { /* 存不下就只对本次生效 */ }
  };

  return (
    <div ref={ref} className="jh-settings" role="dialog" aria-label="设置">
      <div className="st-h">设置</div>
      <div className="st-k">卡片底色</div>
      <div className="st-opts" role="radiogroup" aria-label="卡片底色">
        {TONES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} aria-pressed={tone === t.id} onClick={() => pick(t.id)}>
            <i style={{ background: t.swatch, boxShadow: t.id === 'lacquer' ? 'inset 0 1px 0 oklch(0.75 0.075 76 / 0.6)' : undefined }} />{t.name}
          </button>
        ))}
      </div>
      <div className="st-k" style={{ marginTop: 14 }}>画面主题</div>
      <SkinPicker />
    </div>
  );
}
