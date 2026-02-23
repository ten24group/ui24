/**
 * Network capture store for DevTools.
 * Collects Axios request/response data from ApiContext in dev mode.
 * Ring buffer — oldest entries dropped when MAX_ENTRIES is reached.
 */

import { useSyncExternalStore } from 'react';
import { IS_DEV } from '../../constants';

export type NetworkStatus = 'pending' | 'success' | 'error';

export interface NetworkEntry {
  id: string;
  method: string;
  /** Full URL including base URL */
  url: string;
  /** Path portion only (e.g. /admin/socialaccount) */
  endpoint: string;
  status?: number;
  statusText?: string;
  /** ms from request to response */
  duration?: number;
  requestPayload?: unknown;
  requestHeaders?: Record<string, string>;
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
  timestamp: number;
  /** 'pending' until response arrives */
  networkStatus: NetworkStatus;
  /** spanId from telemetry for cross-linking with TraceViewer */
  spanId?: string;
  errorMessage?: string;
}

const MAX_ENTRIES = 100;

let _entries: NetworkEntry[] = [];
let _snapshot: readonly NetworkEntry[] = [];
const _listeners = new Set<() => void>();
let _counter = 0;

function emit() {
  _snapshot = [..._entries];
  _listeners.forEach(fn => fn());
}

function generateNetworkId(): string {
  return `net_${Date.now()}_${++_counter}`;
}

function extractEndpoint(url: string): string {
  try {
    // Handle relative URLs (e.g. /admin/foo) and absolute URLs
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname;
  } catch {
    // Fallback: take everything before the query string
    return url.split('?')[0] || url;
  }
}

/** Called when a request is outgoing. Returns an id to update with the response. */
export function captureRequest(opts: {
  method: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
  spanId?: string;
}): string {
  if (!IS_DEV) return '';

  const id = generateNetworkId();
  const entry: NetworkEntry = {
    id,
    method: opts.method.toUpperCase(),
    url: opts.url,
    endpoint: extractEndpoint(opts.url),
    requestPayload: opts.payload,
    requestHeaders: opts.headers,
    timestamp: Date.now(),
    networkStatus: 'pending',
    spanId: opts.spanId,
  };

  _entries = [..._entries, entry];
  if (_entries.length > MAX_ENTRIES) {
    _entries = _entries.slice(_entries.length - MAX_ENTRIES);
  }
  emit();
  return id;
}

/** Called when a response arrives (success or error). */
export function captureResponse(id: string, opts: {
  status: number;
  statusText?: string;
  duration: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
}): void {
  if (!IS_DEV || !id) return;

  _entries = _entries.map(e => {
    if (e.id !== id) return e;
    return {
      ...e,
      status: opts.status,
      statusText: opts.statusText,
      duration: opts.duration,
      responseBody: opts.responseBody,
      responseHeaders: opts.responseHeaders,
      networkStatus: opts.errorMessage || (opts.status >= 400) ? 'error' : 'success',
      errorMessage: opts.errorMessage,
    };
  });
  emit();
}

export function clearNetworkEntries(): void {
  _entries = [];
  emit();
}

export function useNetworkStore(): readonly NetworkEntry[] {
  if (!IS_DEV) return [];
  return useSyncExternalStore(
    (listener) => { _listeners.add(listener); return () => _listeners.delete(listener); },
    () => _snapshot,
    () => []
  );
}
