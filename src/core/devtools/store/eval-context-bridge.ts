/**
 * Eval context bridge — lets DevTools panels read the full evaluation context
 * even though they render OUTSIDE the page component tree (as a sibling of AppRouter).
 *
 * Page components (FormPage, TablePage, DetailPage) call publishEvalContext() via
 * useNewEvaluationContext's effect. DevTools components subscribe via useEvalContextBridge().
 *
 * Uses useSyncExternalStore (not use-context-selector) so subscribers are NEVER
 * notified synchronously during another component's render phase — this eliminates
 * the "Cannot update QuickActions while rendering Details/Form" React warnings.
 */
import { useSyncExternalStore } from 'react';
import type { NewEvaluationContext } from '../../types/evaluation';
import { IS_DEV } from './utils';

let _snapshot: NewEvaluationContext | undefined;
const _listeners = new Set<() => void>();

/**
 * Called by useNewEvaluationContext (inside the page tree) whenever context changes.
 * Only publishes when running in dev mode and there's an actual page context.
 */
export function publishEvalContext(ctx: NewEvaluationContext): void {
  if (!IS_DEV) return;
  _snapshot = ctx;
  _listeners.forEach(fn => fn());
}

/**
 * Get the current eval context snapshot without subscribing (for callbacks).
 */
export function getEvalContextSnapshot(): NewEvaluationContext | undefined {
  return _snapshot;
}

function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot(): NewEvaluationContext | undefined {
  return _snapshot;
}

/**
 * Subscribe to the eval context bridge from DevTools panels.
 * Safe to call outside the page context tree — uses useSyncExternalStore,
 * which does NOT trigger synchronous setState during other components' renders.
 */
export function useEvalContextBridge(): NewEvaluationContext | undefined {
  if (!IS_DEV) return undefined;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(subscribe, getSnapshot);
}
