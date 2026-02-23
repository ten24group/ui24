/**
 * Lightweight active span tracking without React Context overhead.
 * Uses a simple stack to track the current "active" span for parent-child relationships.
 * 
 * This avoids the performance cost of React Context while maintaining trace hierarchy.
 */
import type { Span } from '@opentelemetry/api';
import { IS_DEV } from '../constants';

// Stack of currently active spans (only in dev mode)
// We use a global variable to ensure it's shared across all modules
// even if they are bundled separately (though in this project they are not).
const globalScope = typeof window !== 'undefined' ? window : global;
const STACK_KEY = '__UI24_ACTIVE_SPAN_STACK__';

if (!(globalScope)[ STACK_KEY ]) {
  (globalScope)[ STACK_KEY ] = [];
}

const activeSpanStack: Span[] = (globalScope)[ STACK_KEY ];

/**
 * Push a span onto the active stack. Call this when a span starts.
 */
export function pushActiveSpan(span: Span): void {
  if (!IS_DEV) return;
  activeSpanStack.push(span);
}

/**
 * Pop a span from the active stack. Call this when a span ends.
 */
export function popActiveSpan(): Span | undefined {
  if (!IS_DEV) return undefined;
  return activeSpanStack.pop();
}

/**
 * Get the current active span (the parent for new spans).
 * Returns undefined if no span is active or in production.
 */
export function getActiveSpan(): Span | undefined {
  if (!IS_DEV) return undefined;
  return activeSpanStack[ activeSpanStack.length - 1 ];
}

/**
 * Get the span ID of the current active span.
 * Returns undefined if no span is active or in production.
 */
export function getActiveSpanId(): string | undefined {
  const activeSpan = getActiveSpan();
  return activeSpan?.spanContext().spanId;
}

/**
 * Clear the entire stack (useful for testing or error recovery).
 */
export function clearActiveSpanStack(): void {
  activeSpanStack.length = 0;
}
