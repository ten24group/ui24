/**
 * DevToolsSpanProcessor — custom OTel SpanProcessor that stores completed spans
 * in a ring buffer for consumption by DevTools panels.
 *
 * Acts as the "backend" for OTel traces in development mode.
 * Exposes a reactive hook (useTraceStore) for React components.
 */
import { useSyncExternalStore } from 'react';
import { IS_DEV, MAX_SPANS } from '../constants';


export type SpanLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: { code: number; message?: string };
  attributes: Record<string, string | number | boolean | undefined>;
  events: Array<{ name: string; time: number; attributes?: Record<string, unknown> }>;
  level: SpanLevel; // Severity level like backend fw24 logging
}

let _spans: TraceSpan[] = [];
const _listeners = new Set<() => void>();
let _snapshot: readonly TraceSpan[] = [];

function emit() {
  _snapshot = [ ..._spans ];
  _listeners.forEach(fn => fn());
}

export function pushSpan(span: TraceSpan): void {
  if (!IS_DEV) return;
  _spans.push(span);
  if (_spans.length > MAX_SPANS) {
    _spans = _spans.slice(-MAX_SPANS);
  }
  emit();
}

export function clearTraceStore(): void {
  if (!IS_DEV) return;
  _spans = [];
  emit();
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function getSnapshot(): readonly TraceSpan[] {
  return _snapshot;
}

const EMPTY: readonly TraceSpan[] = [];

export function useTraceStore(): readonly TraceSpan[] {
  if (!IS_DEV) return EMPTY;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getTraceStoreSnapshot(): readonly TraceSpan[] {
  return _snapshot;
}
