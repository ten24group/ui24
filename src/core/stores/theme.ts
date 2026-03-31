/**
 * Theme store with OS preference detection.
 * 
 * Supports:
 * - 'system': Follow OS theme preference (default)
 * - 'light': Always light mode
 * - 'dark': Always dark mode
 * 
 * Persists preference in localStorage with app-specific namespace and respects system theme changes.
 *
 * IMPORTANT: Module-level state deliberately starts as 'light' without reading localStorage.
 * The real preference is loaded once initThemeStore() is called with the app namespace,
 * ensuring we always read from the correct storage key.
 */
import { useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeMode = 'light' | 'dark';

let _appNamespace: string | null = null;
let _initialized = false;

export function initThemeStore(appName: string): void {
  const namespace = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  _appNamespace = `ui24_${namespace}`;
  _initialized = true;

  _preference = readStoredPreference();
  _resolvedMode = resolveThemeMode(_preference);
  _notify();
}

function getStorageKey(): string {
  if (!_appNamespace) return 'ui24_theme_preference';
  return `${_appNamespace}_theme_preference`;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredPreference(): ThemePreference {
  if (!_initialized) return 'light';
  try {
    const v = localStorage.getItem(getStorageKey());
    if (v === 'system' || v === 'light' || v === 'dark') return v;
  } catch { }
  return 'light';
}

function resolveThemeMode(preference: ThemePreference): ThemeMode {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

let _preference: ThemePreference = 'light';
let _resolvedMode: ThemeMode = 'light';
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export function getThemePreference(): ThemePreference {
  return _preference;
}

export function getThemeMode(): ThemeMode {
  return _resolvedMode;
}

export function setThemePreference(preference: ThemePreference): void {
  if (_preference === preference) return;
  _preference = preference;

  try {
    localStorage.setItem(getStorageKey(), preference);
  } catch { }

  _resolvedMode = resolveThemeMode(_preference);
  _notify();
}

export function setThemeMode(mode: ThemeMode): void {
  setThemePreference(mode);
}

export function toggleThemeMode(): void {
  setThemePreference(_resolvedMode === 'light' ? 'dark' : 'light');
}

function subscribe(onStoreChange: () => void): () => void {
  _listeners.add(onStoreChange);
  return () => { _listeners.delete(onStoreChange); };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, () => 'light' as ThemePreference);
}

export function useThemeMode(): ThemeMode {
  const mode = useSyncExternalStore(subscribe, getThemeMode, () => 'light' as ThemeMode);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemChangeHandler = () => {
      if (_preference === 'system') {
        const newMode = resolveThemeMode('system');
        if (newMode !== _resolvedMode) {
          _resolvedMode = newMode;
          _notify();
        }
      }
    };

    mediaQuery.addEventListener('change', systemChangeHandler);
    return () => mediaQuery.removeEventListener('change', systemChangeHandler);
  }, []);

  return mode;
}
