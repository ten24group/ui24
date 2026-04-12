/**
 * Recently mutated record ids (create/update/patch/delete-success flows).
 * Survives SPA navigation and sessionStorage refresh; supports multiple concurrent highlights.
 * Pathname-based handoffs removed — list/detail/card all read the same registry.
 */

import { IS_DEV } from '../constants';
import { UI24_DEFAULT_RECENT_SAVE_UI_MS } from './list-highlight';

const STORAGE_KEY = 'ui24:recentRecordTouches';
/** Cap stored ids so sessionStorage stays bounded */
const MAX_IDS = 64;

type TouchEntry = { expiresAt: number; touchedAt: number };

let touches = new Map<string, TouchEntry>();
const listeners = new Set<() => void>();

function prune(now = Date.now()): void {
  Array.from(touches.entries()).forEach(([ id, v ]) => {
    if (v.expiresAt <= now) touches.delete(id);
  });
}

function recomputeSnapshotKey(): string {
  prune();
  return Array.from(touches.keys()).sort().join('\0');
}

function loadFromSessionOnce(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as Record<string, number | { e: number; t?: number }>;
    const now = Date.now();
    for (const [ k, v ] of Object.entries(o)) {
      if (typeof k !== 'string' || k.length === 0) continue;
      if (typeof v === 'number' && v > now) {
        const expiresAt = v;
        const touchedAt = Math.min(now, Math.max(0, expiresAt - UI24_DEFAULT_RECENT_SAVE_UI_MS));
        touches.set(k, { expiresAt, touchedAt });
      } else if (v != null && typeof v === 'object' && typeof v.e === 'number' && v.e > now) {
        const expiresAt = v.e;
        const touchedAt =
          typeof v.t === 'number'
            ? v.t
            : Math.min(now, Math.max(0, expiresAt - UI24_DEFAULT_RECENT_SAVE_UI_MS));
        touches.set(k, { expiresAt, touchedAt });
      }
    }
  } catch {
    /* ignore */
  }
}

function persist(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const now = Date.now();
    const o: Record<string, { e: number; t: number }> = {};
    Array.from(touches.entries()).forEach(([ id, v ]) => {
      if (v.expiresAt > now) o[ id ] = { e: v.expiresAt, t: v.touchedAt };
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* quota / private mode */
  }
}

function notify(): void {
  recomputeSnapshotKey();
  listeners.forEach(fn => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ui24-recent-touches-changed'));
  }
}

if (typeof window !== 'undefined') {
  loadFromSessionOnce();
  recomputeSnapshotKey();
}

/**
 * Mark a record as recently mutated. TTL defaults to list highlight duration.
 * Calling again for the same id extends visibility (max expiry wins) and refreshes last touched time.
 */
export function touchRecentRecord(recordId: string, ttlMs: number = UI24_DEFAULT_RECENT_SAVE_UI_MS): void {
  if (!recordId) return;
  if (typeof window !== 'undefined' && touches.size === 0) loadFromSessionOnce();
  prune();
  const now = Date.now();
  const newExp = now + ttlMs;
  const prev = touches.get(recordId);
  const expiresAt = prev != null ? Math.max(prev.expiresAt, newExp) : newExp;
  const touchedAt = now;
  touches.set(recordId, { expiresAt, touchedAt });

  if (touches.size > MAX_IDS) {
    const sorted = Array.from(touches.entries()).sort((a, b) => a[ 1 ].expiresAt - b[ 1 ].expiresAt);
    while (touches.size > MAX_IDS && sorted.length > 0) {
      const drop = sorted.shift();
      if (drop) touches.delete(drop[ 0 ]);
    }
  }
  persist();
  notify();
}

/** Non-consuming read: ids still within TTL. */
export function getRecentlyTouchedRecordIds(): Set<string> {
  if (typeof window !== 'undefined' && touches.size === 0) loadFromSessionOnce();
  prune();
  return new Set(Array.from(touches.keys()));
}

export function isRecentlyTouchedRecord(recordId: string): boolean {
  if (!recordId) return false;
  if (typeof window !== 'undefined' && touches.size === 0) loadFromSessionOnce();
  prune();
  const e = touches.get(recordId);
  return e != null && e.expiresAt > Date.now();
}

/** Last mutation time (ms) for UI copy ("… ago"); undefined if not in registry or expired. */
export function getRecentRecordTouchTime(recordId: string): number | undefined {
  if (!recordId) return undefined;
  if (typeof window !== 'undefined' && touches.size === 0) loadFromSessionOnce();
  prune();
  const e = touches.get(recordId);
  if (e == null || e.expiresAt <= Date.now()) return undefined;
  return e.touchedAt;
}

/** For useSyncExternalStore — changes when membership/expiry set changes. */
export function getRecentTouchesSnapshotKey(): string {
  if (typeof window !== 'undefined' && touches.size === 0) loadFromSessionOnce();
  return recomputeSnapshotKey();
}

export function subscribeRecentRecordTouches(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

if (typeof window !== 'undefined' && IS_DEV) {
  (window as Window & { __ui24_debugTouchRecent?: typeof touchRecentRecord }).__ui24_debugTouchRecent = touchRecentRecord;
}
