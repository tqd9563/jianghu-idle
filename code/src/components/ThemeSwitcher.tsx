import { useState } from 'react';
import type { JSX } from 'react';
import { THEMES, getTheme, setTheme } from '../theme/themePreference';
import type { ThemeId } from '../theme/themePreference';

export function ThemeSwitcher(): JSX.Element {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getTheme);

  const handleChange = (id: ThemeId): void => {
    setCurrentTheme(id);
    setTheme(id);
  };

  return (
    <fieldset className="theme-switcher">
      <legend className="sr-only">界面风格</legend>
      {THEMES.map(theme => (
        <label key={theme.id} className={`theme-radio ${currentTheme === theme.id ? 'active' : ''}`}>
          <input
            type="radio"
            name="app-theme"
            value={theme.id}
            checked={currentTheme === theme.id}
            onChange={() => handleChange(theme.id)}
            className="sr-only"
          />
          <span className="theme-label">{theme.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
