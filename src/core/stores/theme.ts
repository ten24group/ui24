/**
 * Theme store with OS preference detection.
 * 
 * Supports:
 * - 'system': Follow OS theme preference (default)
 * - 'light': Always light mode
 * - 'dark': Always dark mode
 * 
 * Persists preference in localStorage with app-specific namespace and respects system theme changes.
 */
import { useState, useEffect } from 'react';

/**
 * User's theme preference (also the resolved mode)
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Actual theme that gets applied (light or dark)
 */
export type ThemeMode = 'light' | 'dark';

let _appNamespace: string = 'ui24';

/**
 * Initialize theme store with app-specific namespace
 * Call this once on app init with the app name from config
 */
export function initThemeStore(appName: string): void {
  const namespace = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  _appNamespace = `ui24_${namespace}`;

  // Re-read preference with new namespace
  _preference = readStoredPreference();
  _resolvedMode = resolveThemeMode(_preference);
  _listeners.forEach(fn => fn());
}

function getStorageKey(): string {
  return `${_appNamespace}_theme_preference`;
}

/**
 * Check if system prefers dark mode
 */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Read stored theme preference
 */
function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(getStorageKey());
    if (v === 'system' || v === 'light' || v === 'dark') return v;
  } catch { }
  return 'light';
}

/**
 * Resolve actual theme mode based on preference
 */
function resolveThemeMode(preference: ThemePreference): ThemeMode {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

// Internal state
let _preference: ThemePreference = readStoredPreference();
let _resolvedMode: ThemeMode = resolveThemeMode(_preference);
const _listeners = new Set<() => void>();

/**
 * Get current theme preference
 */
export function getThemePreference(): ThemePreference {
  return _preference;
}

/**
 * Get currently applied theme mode (light or dark)
 */
export function getThemeMode(): ThemeMode {
  return _resolvedMode;
}

/**
 * Set theme preference
 */
export function setThemePreference(preference: ThemePreference): void {
  if (_preference === preference) return;
  _preference = preference;

  try {
    localStorage.setItem(getStorageKey(), preference);
  } catch { }

  const newMode = resolveThemeMode(_preference);
  if (newMode !== _resolvedMode) {
    _resolvedMode = newMode;
  }

  // Always notify listeners when preference changes, even if resolved mode is same
  // This ensures UI active states update correctly
  _listeners.forEach(fn => fn());
}

/**
 * Legacy - kept for backward compatibility
 */
export function setThemeMode(mode: ThemeMode): void {
  setThemePreference(mode);
}

/**
 * Legacy - kept for backward compatibility
 */
export function toggleThemeMode(): void {
  setThemePreference(_resolvedMode === 'light' ? 'dark' : 'light');
}

/**
 * React hook to get current theme preference
 */
export function useThemePreference(): ThemePreference {
  const [ preference, setPreference ] = useState<ThemePreference>(_preference);
  useEffect(() => {
    const handler = () => setPreference(getThemePreference());
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);
  return preference;
}

/**
 * React hook to get currently applied theme mode (light or dark)
 */
export function useThemeMode(): ThemeMode {
  const [ mode, setMode ] = useState<ThemeMode>(_resolvedMode);

  useEffect(() => {
    const handler = () => setMode(getThemeMode());
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  // Listen to system theme changes when preference is 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemChangeHandler = () => {
      if (_preference === 'system') {
        const newMode = resolveThemeMode('system');
        if (newMode !== _resolvedMode) {
          _resolvedMode = newMode;
          _listeners.forEach(fn => fn());
        }
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', systemChangeHandler);
      return () => mediaQuery.removeEventListener('change', systemChangeHandler);
    }
  }, []);

  return mode;
}
