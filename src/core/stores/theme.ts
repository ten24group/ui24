/**
 * Theme mode store — persists light/dark preference in localStorage.
 * Non-devtools, used by the top-level ConfigProvider in UI24.tsx.
 */
import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ui24_theme_mode';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {}
  return 'light';
}

let _mode: ThemeMode = readStored();
const _listeners = new Set<() => void>();

export function getThemeMode(): ThemeMode {
  return _mode;
}

export function setThemeMode(mode: ThemeMode): void {
  if (_mode === mode) return;
  _mode = mode;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  _listeners.forEach(fn => fn());
}

export function toggleThemeMode(): void {
  setThemeMode(_mode === 'light' ? 'dark' : 'light');
}

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(_mode);
  useEffect(() => {
    const handler = () => setMode(getThemeMode());
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);
  return mode;
}
