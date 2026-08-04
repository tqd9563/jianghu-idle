/**
 * 外观 · 皮肤配置入口 —— 实现基准：docs/design/skin-entry-prototype.html（获批原型）
 * 菜单栏底部统一入口 + 皮肤弹窗（radiogroup 语义 / 方向键切换 / Esc 关闭 / 焦点还原）
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { THEMES, getTheme, setTheme } from '../theme/themePreference';
import type { ThemeId } from '../theme/themePreference';

export function SkinPicker(): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(getTheme);
  const [open, setOpen] = useState(false);
  const entryRef = useRef<HTMLButtonElement>(null);
  const activeCardRef = useRef<HTMLButtonElement>(null);

  const currentName = THEMES.find(t => t.id === theme)?.name ?? '';

  const pick = (id: ThemeId): void => {
    setThemeState(id);
    setTheme(id);
  };

  const close = (): void => {
    setOpen(false);
    entryRef.current?.focus();
  };

  // 打开时把焦点交给当前皮肤卡（弹窗内起点明确）
  useEffect(() => {
    if (open) activeCardRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      if (!forward && !back) return;
      e.preventDefault();
      const cur = THEMES.findIndex(t => t.id === theme);
      const next = THEMES[(cur + (forward ? 1 : -1) + THEMES.length) % THEMES.length];
      pick(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, theme]);

  // 皮肤切换后把焦点跟到新选中的卡上（方向键连续切换不丢焦点）
  useEffect(() => {
    if (open) activeCardRef.current?.focus();
  }, [theme, open]);

  return (
    <>
      <div className="rail-foot">
        <button
          ref={entryRef}
          className="appearance-entry"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="swatch" aria-hidden="true" />
          外观
          <span className="cur-skin">{currentName}</span>
        </button>
      </div>

      {open && (
        <div
          className="modal-backdrop open"
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="skin-modal" role="dialog" aria-modal="true" aria-labelledby="skin-modal-title">
            <div className="modal-head">
              <span id="skin-modal-title" className="title">外观</span>
              <span className="sub">选定即生效，自动保存</span>
              <button className="modal-close" onClick={close} aria-label="关闭">×</button>
            </div>
            <div className="modal-body">
              <div className="skin-grid" role="radiogroup" aria-label="界面皮肤">
                {THEMES.map(t => {
                  const active = t.id === theme;
                  return (
                    <button
                      key={t.id}
                      ref={active ? activeCardRef : undefined}
                      className="skin-card"
                      data-skin={t.id}
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => pick(t.id)}
                    >
                      <span className="sp" aria-hidden="true">
                        <span className="sp-rail">
                          <i className="on" /><i /><i /><i />
                        </span>
                        <span className="sp-col">
                          <span className="sp-top" />
                          <span className="sp-main">
                            <span className="t" />
                            <span className="l" />
                            <span className="segs">
                              <i className="full" /><i className="full" /><i className="full" /><i /><i />
                            </span>
                          </span>
                        </span>
                      </span>
                      <span className="meta">
                        <span className="name serif">{t.name}</span>
                        <span className="check">使用中</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="modal-foot">皮肤只改界面观感，不影响任何数值与进度。</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
