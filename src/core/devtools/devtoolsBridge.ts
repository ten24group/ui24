/**
 * DevTools Bridge — module-level store for cross-boundary state inspection.
 *
 * Two stores:
 * 1. Snapshot store (Map) — providers report() current state, DevTools subscribes.
 * 2. Activity log (ring buffer) — append-only event log for API calls, navigation, errors.
 *
 * Production: all exports are no-ops with zero overhead.
 */
import { useSyncExternalStore, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────

export type BridgeEntryType = 'page' | 'form' | 'table' | 'detail' | 'pageData';

export interface BridgeEntry {
  id: string;
  type: BridgeEntryType;
  label: string;
  data: unknown;
  timestamp: number;
  modalDepth?: number;
}

export type ActivityEventType = 'api-request' | 'api-response' | 'api-error' | 'navigation' | 'form-submit' | 'error' | 'warning';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  label: string;
  data?: unknown;
  timestamp: number;
  duration?: number;
  status?: number;
  /** Links request to its response */
  requestId?: string;
}

// ── Shared ─────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== 'production';

let _idCounter = 0;

function generateId(): string {
  return `dt_${++_idCounter}_${Date.now().toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════
// SNAPSHOT STORE (providers report current state)
// ═══════════════════════════════════════════════════════════════════

const _store = new Map<string, BridgeEntry>();
const _storeListeners = new Set<() => void>();
let _storeSnapshot: ReadonlyMap<string, BridgeEntry> = new Map();

function emitStore() {
  _storeSnapshot = new Map(_store);
  _storeListeners.forEach(fn => fn());
}

export function report(type: BridgeEntryType, label: string, data: unknown, modalDepth?: number): string {
  if (!IS_DEV) return '';
  const id = generateId();
  _store.set(id, { id, type, label, data, timestamp: Date.now(), modalDepth });
  emitStore();
  return id;
}

export function update(id: string, data: unknown): void {
  if (!IS_DEV || !id) return;
  const entry = _store.get(id);
  if (entry) {
    _store.set(id, { ...entry, data, timestamp: Date.now() });
    emitStore();
  }
}

export function remove(id: string): void {
  if (!IS_DEV || !id) return;
  if (_store.delete(id)) {
    emitStore();
  }
}

function subscribeStore(listener: () => void): () => void {
  _storeListeners.add(listener);
  return () => _storeListeners.delete(listener);
}

function getStoreSnapshot(): ReadonlyMap<string, BridgeEntry> {
  return _storeSnapshot;
}

const EMPTY_MAP: ReadonlyMap<string, BridgeEntry> = new Map();

export function useDevToolsStore(): ReadonlyMap<string, BridgeEntry> {
  if (!IS_DEV) return EMPTY_MAP;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribeStore, getStoreSnapshot);
}

export function useDevToolsReport(type: BridgeEntryType, label: string, data: unknown, modalDepth?: number): void {
  if (!IS_DEV) return;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const idRef = useRef<string>('');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    idRef.current = report(type, label, data, modalDepth);
    return () => {
      remove(idRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (idRef.current) {
      update(idRef.current, data);
    }
  }, [data]);
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY LOG (append-only ring buffer for events)
// ═══════════════════════════════════════════════════════════════════

const MAX_LOG_SIZE = 200;
let _log: ActivityEvent[] = [];
const _logListeners = new Set<() => void>();
let _logSnapshot: readonly ActivityEvent[] = [];

function emitLog() {
  _logSnapshot = [..._log];
  _logListeners.forEach(fn => fn());
}

/**
 * Append an event to the activity log. Returns the event id.
 */
export function logActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>): string {
  if (!IS_DEV) return '';
  const id = generateId();
  const full: ActivityEvent = { ...event, id, timestamp: Date.now() };
  _log.push(full);
  if (_log.length > MAX_LOG_SIZE) {
    _log = _log.slice(-MAX_LOG_SIZE);
  }
  emitLog();
  return id;
}

/**
 * Update an existing activity event (e.g., add response data to a request).
 */
export function updateActivity(id: string, patch: Partial<ActivityEvent>): void {
  if (!IS_DEV || !id) return;
  const idx = _log.findIndex(e => e.id === id);
  if (idx !== -1) {
    _log[idx] = { ..._log[idx], ...patch };
    emitLog();
  }
}

export function clearActivityLog(): void {
  if (!IS_DEV) return;
  _log = [];
  emitLog();
}

function subscribeLog(listener: () => void): () => void {
  _logListeners.add(listener);
  return () => _logListeners.delete(listener);
}

function getLogSnapshot(): readonly ActivityEvent[] {
  return _logSnapshot;
}

const EMPTY_LOG: readonly ActivityEvent[] = [];

export function useActivityLog(): readonly ActivityEvent[] {
  if (!IS_DEV) return EMPTY_LOG;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribeLog, getLogSnapshot);
}
