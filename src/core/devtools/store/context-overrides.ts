import { useSyncExternalStore } from 'react';
import { IS_DEV } from './utils';

let _contextOverrides: Record<string, unknown> = {};
const _ctxListeners = new Set<() => void>();
let _ctxSnapshot: Readonly<Record<string, unknown>> = {};

function emitCtx() {
  _ctxSnapshot = { ..._contextOverrides };
  _ctxListeners.forEach(fn => fn());
}

export function setContextOverride(path: string, value: unknown): void {
  if (!IS_DEV) return;
  _contextOverrides[path] = value;
  emitCtx();
}

export function removeContextOverride(path: string): void {
  if (!IS_DEV) return;
  delete _contextOverrides[path];
  emitCtx();
}

export function clearContextOverrides(): void {
  if (!IS_DEV) return;
  _contextOverrides = {};
  emitCtx();
}

export function getContextOverrides(): Readonly<Record<string, unknown>> {
  return _ctxSnapshot;
}

export function getContextOverrideCount(): number {
  return Object.keys(_contextOverrides).length;
}

function subscribeCtx(listener: () => void): () => void {
  _ctxListeners.add(listener);
  return () => _ctxListeners.delete(listener);
}

function getCtxSnapshot(): Readonly<Record<string, unknown>> {
  return _ctxSnapshot;
}

const EMPTY_CTX: Readonly<Record<string, unknown>> = {};

export function useContextOverrides(): Readonly<Record<string, unknown>> {
  if (!IS_DEV) return EMPTY_CTX;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribeCtx, getCtxSnapshot);
}
