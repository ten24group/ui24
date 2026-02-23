import { useSyncExternalStore } from 'react';
import { IS_DEV } from './utils';
import { conditionEvaluator } from '../../utils/ConditionEvaluator';

export interface DebugState {
  conditionDebug: boolean;
  conditionProfiling: boolean;
}

let _debugState: DebugState = { conditionDebug: false, conditionProfiling: false };
const _debugListeners = new Set<() => void>();
let _debugSnapshot: Readonly<DebugState> = { ..._debugState };

function emitDebug() {
  _debugSnapshot = { ..._debugState };
  _debugListeners.forEach(fn => fn());
}

export function setConditionDebug(enabled: boolean): void {
  if (!IS_DEV) return;
  conditionEvaluator.enableDebug(enabled);
  _debugState = { ..._debugState, conditionDebug: enabled };
  emitDebug();
}

export function setConditionProfiling(enabled: boolean): void {
  if (!IS_DEV) return;
  conditionEvaluator.enableProfiling(enabled);
  _debugState = { ..._debugState, conditionProfiling: enabled };
  emitDebug();
}

function subscribeDebug(listener: () => void): () => void {
  _debugListeners.add(listener);
  return () => _debugListeners.delete(listener);
}

function getDebugSnapshot(): Readonly<DebugState> {
  return _debugSnapshot;
}

const EMPTY_DEBUG: Readonly<DebugState> = { conditionDebug: false, conditionProfiling: false };

export function useDebugState(): Readonly<DebugState> {
  if (!IS_DEV) return EMPTY_DEBUG;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribeDebug, getDebugSnapshot);
}
