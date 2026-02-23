import { useSyncExternalStore, useEffect, useRef } from 'react';
import { IS_DEV, generateId } from './utils';

export type BridgeEntryType = 'page' | 'form' | 'table' | 'detail' | 'pageData';

export interface BridgeEntry {
  id: string;
  type: BridgeEntryType;
  label: string;
  data: unknown;
  timestamp: number;
  modalDepth?: number;
}

const _store = new Map<string, BridgeEntry>();
const _storeListeners = new Set<() => void>();
let _storeSnapshot: ReadonlyMap<string, BridgeEntry> = new Map();

// History buffer for state diff tracking
const MAX_HISTORY = 50;
const _history = new Map<string, Array<{ timestamp: number; data: unknown }>>();

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

export function update(id: string, data: unknown, label?: string, modalDepth?: number): void {
  if (!IS_DEV || !id) return;
  const entry = _store.get(id);
  if (entry) {
    // Track history for state diffing (data changes only)
    let hist = _history.get(id);
    if (!hist) {
      hist = [];
      _history.set(id, hist);
    }
    try {
      hist.push({ timestamp: entry.timestamp, data: structuredClone(entry.data) });
      if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
    } catch {
      // structuredClone may fail on non-cloneable data
    }

    _store.set(id, {
      ...entry,
      data,
      timestamp: Date.now(),
      ...(label !== undefined && { label }),
      ...(modalDepth !== undefined && { modalDepth }),
    });
    emitStore();
  }
}

export function remove(id: string): void {
  if (!IS_DEV || !id) return;
  if (_store.delete(id)) {
    _history.delete(id);
    emitStore();
  }
}

export function getEntryHistory(id: string): ReadonlyArray<{ timestamp: number; data: unknown }> {
  return _history.get(id) || [];
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
  return useSyncExternalStore(subscribeStore, getStoreSnapshot);
}

export function useDevToolsReport(type: BridgeEntryType, label: string, data: unknown, modalDepth?: number): void {
  if (!IS_DEV) return;

  const idRef = useRef<string>('');

  // Register on mount, clean up on unmount
  useEffect(() => {
    idRef.current = report(type, label, data, modalDepth);
    return () => {
      remove(idRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data whenever it changes
  useEffect(() => {
    if (idRef.current) {
      update(idRef.current, data);
    }
  }, [data]);

  // Update label whenever it changes (e.g., entityName resolves later)
  useEffect(() => {
    if (idRef.current) {
      update(idRef.current, data, label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // Update modalDepth whenever it changes
  useEffect(() => {
    if (idRef.current) {
      update(idRef.current, data, undefined, modalDepth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalDepth]);
}
