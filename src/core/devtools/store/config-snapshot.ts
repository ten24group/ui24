/**
 * Config snapshot store — pins a baseline page config to localStorage.
 * Used by ConfigDiffPanel to show what changed vs. the baseline.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ui24:devtools:config-snapshot';

export interface ConfigSnapshot {
  /** Page label at time of snapshot */
  label: string;
  /** Page type (list / form / detail) */
  pageType: string;
  /** The full config object that was active */
  config: unknown;
  /** ISO timestamp */
  savedAt: string;
}

let _current: ConfigSnapshot | null = loadFromStorage();
const _listeners = new Set<() => void>();

function loadFromStorage(): ConfigSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit() {
  _listeners.forEach(fn => fn());
}

export function saveSnapshot(snapshot: ConfigSnapshot): void {
  _current = snapshot;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch { /* localStorage may be full */ }
  emit();
}

export function clearSnapshot(): void {
  _current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  emit();
}

export function getSnapshot(): ConfigSnapshot | null {
  return _current;
}

export function useConfigSnapshot(): ConfigSnapshot | null {
  return useSyncExternalStore(
    (listener) => { _listeners.add(listener); return () => _listeners.delete(listener); },
    () => _current,
    () => null
  );
}
