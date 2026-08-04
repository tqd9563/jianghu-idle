export type ThemeId = 'night' | 'xuan' | 'bronze' | 'mist' | 'pomo';

export interface ThemeDef {
  readonly id: ThemeId;
  readonly name: string;
}

export const THEMES: readonly ThemeDef[] = [
  { id: 'night', name: '夜雨账台' },
  { id: 'xuan', name: '宣纸武谱' },
  { id: 'bronze', name: '山门铜刻' },
  { id: 'mist', name: '雾江行旅' },
  { id: 'pomo', name: '泼墨山河' },
] as const;

export const DEFAULT_THEME: ThemeId = 'night';
const STORAGE_KEY = 'jianghu-idle:theme:v1';

function isDOMException(e: unknown): e is DOMException {
  return e instanceof DOMException;
}

function isThemeId(val: string | null): val is ThemeId {
  return val !== null && THEMES.some(t => t.id === val);
}

export function getTheme(): ThemeId {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(val)) {
      return val;
    }
  } catch (e) {
    if (isDOMException(e)) {
      return DEFAULT_THEME;
    }
    throw e;
  }
  return DEFAULT_THEME;
}

export function setTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    if (!isDOMException(e)) {
      throw e;
    }
  }
  applyTheme(theme);
}

export function initTheme(): void {
  applyTheme(getTheme());
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
}
