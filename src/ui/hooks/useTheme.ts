import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ah-theme';

/**
 * Resolve the effective theme from a stored preference and the OS preference.
 * Precedence: stored value → OS `prefers-color-scheme: light` → dark default.
 * Pure and side-effect free so it can be unit-tested without a DOM.
 */
export function resolveTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}

/** Resolve the initial theme from browser state (localStorage + matchMedia). */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (private mode)
  }
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  return resolveTheme(stored, prefersLight);
}

/** Apply the theme to the document root so CSS token overrides take effect. */
function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

/**
 * useTheme — manages the light/dark theme with persistence.
 * Dark is the default. Sets `data-theme` on <html> and mirrors to localStorage.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore persistence failures
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, setTheme, toggle };
}
