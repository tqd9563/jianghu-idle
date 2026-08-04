import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEMES, DEFAULT_THEME, getTheme, setTheme, initTheme } from './themePreference';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  clear: vi.fn(() => { for (const key in store) delete store[key]; })
};
vi.stubGlobal('localStorage', mockLocalStorage);

const mockDocumentElement = {
  getAttribute: vi.fn((attr) => store[`attr_${attr}`] || null),
  setAttribute: vi.fn((attr, val) => { store[`attr_${attr}`] = val; }),
  removeAttribute: vi.fn((attr) => { delete store[`attr_${attr}`]; })
};
vi.stubGlobal('document', { documentElement: mockDocumentElement });

describe('themePreference', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockDocumentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  it('provides readonly theme catalog', () => {
    expect(THEMES.length).toBe(5);
    expect(THEMES.map(t => t.id)).toEqual(['night', 'xuan', 'bronze', 'mist', 'pomo']);
    expect(DEFAULT_THEME).toBe('night');
  });

  it('returns default theme when localStorage is empty', () => {
    expect(getTheme()).toBe('night');
  });

  it('returns default theme when localStorage is invalid', () => {
    store['jianghu-idle:theme:v1'] = 'invalid-theme';
    expect(getTheme()).toBe('night');
  });

  it('reads valid theme from localStorage', () => {
    store['jianghu-idle:theme:v1'] = 'xuan';
    expect(getTheme()).toBe('xuan');
  });

  it('setTheme writes to localStorage and updates documentElement', () => {
    setTheme('bronze');
    expect(store['jianghu-idle:theme:v1']).toBe('bronze');
    expect(store['attr_data-theme']).toBe('bronze');
    
    // Explicitly assert it never touches game save
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('jianghu-idle:save:v1', expect.anything());
  });

  it('initTheme reads from storage and updates documentElement', () => {
    store['jianghu-idle:theme:v1'] = 'mist';
    initTheme();
    expect(store['attr_data-theme']).toBe('mist');
  });

  it('getTheme falls back on DOMException and rethrows unexpected error', () => {
    const domEx = new DOMException('QuotaExceeded', 'QuotaExceededError');
    mockLocalStorage.getItem.mockImplementationOnce(() => { throw domEx; });
    expect(getTheme()).toBe('night');

    const err = new Error('Unexpected');
    mockLocalStorage.getItem.mockImplementationOnce(() => { throw err; });
    expect(() => getTheme()).toThrow('Unexpected');
  });

  it('setTheme swallows DOMException and rethrows unexpected error', () => {
    const domEx = new DOMException('QuotaExceeded', 'QuotaExceededError');
    mockLocalStorage.setItem.mockImplementationOnce(() => { throw domEx; });
    expect(() => setTheme('mist')).not.toThrow();
    // Verify it still applies to DOM
    expect(store['attr_data-theme']).toBe('mist');

    const err = new Error('Unexpected');
    mockLocalStorage.setItem.mockImplementationOnce(() => { throw err; });
    expect(() => setTheme('mist')).toThrow('Unexpected');
  });
});
