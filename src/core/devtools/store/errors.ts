/**
 * Error capture store for DevTools.
 * Intercepts console.error, window.onerror, and unhandledrejection.
 * Ring buffer — oldest entries dropped when MAX_ENTRIES is reached.
 */
import { useSyncExternalStore } from 'react';
import { IS_DEV } from '../../constants';

export type ErrorSeverity = 'error' | 'warn';

export interface ErrorEntry {
  id: string;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  source?: string;
  timestamp: number;
  /** Deduplicated consecutive identical messages */
  count: number;
}

const MAX_ENTRIES = 200;

let _entries: ErrorEntry[] = [];
let _snapshot: readonly ErrorEntry[] = [];
const _listeners = new Set<() => void>();
let _counter = 0;
let _installed = false;

function emit(): void {
  _snapshot = [ ..._entries ];
  // Defer subscriber notification so console.warn/error during a component render
  // (e.g. antd Tabs deprecations) does not trigger useSyncExternalStore updates in the
  // same commit and cause "Cannot update a component while rendering a different component".
  queueMicrotask(() => {
    _listeners.forEach(fn => fn());
  });
}

function generateId(): string {
  return `err_${Date.now()}_${++_counter}`;
}

function normalizeMessage(msg: unknown): string {
  if (typeof msg === 'string') return msg;
  if (msg instanceof Error) return msg.message;
  try { return JSON.stringify(msg); } catch { return String(msg); }
}

export function captureError(
  severity: ErrorSeverity,
  message: string,
  stack?: string,
  source?: string,
): void {
  if (!IS_DEV) return;

  // Skip DevTools internals to avoid noise
  if (message.includes('[ui24-devtools]')) return;

  // Deduplicate: merge consecutive identical messages
  const last = _entries[ _entries.length - 1 ];
  if (last && last.message === message && last.severity === severity) {
    last.count++;
    last.timestamp = Date.now();
    emit();
    return;
  }

  const entry: ErrorEntry = {
    id: generateId(),
    severity,
    message,
    stack,
    source,
    timestamp: Date.now(),
    count: 1,
  };

  _entries.push(entry);
  if (_entries.length > MAX_ENTRIES) {
    _entries = _entries.slice(_entries.length - MAX_ENTRIES);
  }
  emit();
}

export function clearErrors(): void {
  _entries = [];
  emit();
}

export function getErrorCount(): number {
  return _entries.filter(e => e.severity === 'error').length;
}

/**
 * Install global error capture hooks (console.error, onerror, unhandledrejection).
 * Call once from the app root in dev mode.
 */
export function installErrorCapture(): void {
  if (!IS_DEV || _installed) return;
  _installed = true;

  // Intercept console.error
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    captureError('error', args.map(normalizeMessage).join(' '));
  };

  // Intercept console.warn
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    captureError('warn', args.map(normalizeMessage).join(' '));
  };

  const handleGlobalError = (ev: ErrorEvent) => {
    captureError(
      'error',
      ev.message || 'Unknown error',
      ev.error?.stack,
      ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
    );
  };

  const handleUnhandledRejection = (ev: PromiseRejectionEvent) => {
    const msg = ev.reason instanceof Error ? ev.reason.message : normalizeMessage(ev.reason);
    const stack = ev.reason instanceof Error ? ev.reason.stack : undefined;
    captureError('error', `Unhandled rejection: ${msg}`, stack);
  };

  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
}

export function useErrorStore(): readonly ErrorEntry[] {
  if (!IS_DEV) return [];
  return useSyncExternalStore(
    (listener) => { _listeners.add(listener); return () => _listeners.delete(listener); },
    () => _snapshot,
    () => [],
  );
}

export function useErrorCount(): { errors: number; warnings: number } {
  const entries = useErrorStore();
  let errors = 0;
  let warnings = 0;
  for (const e of entries) {
    if (e.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}
