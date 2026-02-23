/**
 * Thin OTel API wrapper — ZERO SDK imports.
 *
 * This file only depends on @opentelemetry/api (~5KB gzip), which provides
 * no-op implementations when no SDK is registered. Safe to import from
 * any hot path (ConditionEvaluator, Form, Table, etc.) without pulling
 * in the SDK.
 *
 * The actual SDK initialization lives in ./sdk.ts and is only ever imported
 * by ConfigDevTools when the user opens DevTools.
 */
import { trace, context, type Tracer, SpanStatusCode, type Span, type Context } from '@opentelemetry/api';

export { SpanStatusCode, context, trace };
export type { Span, Context };
export { getActiveSpan, getActiveSpanId, pushActiveSpan, popActiveSpan } from './activeSpanStack';

export function getTracer(name: string = 'ui24'): Tracer {
  return trace.getTracer(name, '1.0.0');
}

/**
 * Execute a function within a span context (enables parent/child relationships).
 * Usage:
 *   const span = tracer.startSpan('myOperation');
 *   await withSpan(span, async () => {
 *     // Any spans started here will automatically be children of 'span'
 *     await doWork();
 *   });
 */
export async function withSpan<T>(span: Span, fn: () => Promise<T>): Promise<T> {
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      return await fn();
    } finally {
      span.end();
    }
  });
}

/**
 * Synchronous version of withSpan.
 */
export function withSpanSync<T>(span: Span, fn: () => T): T {
  return context.with(trace.setSpan(context.active(), span), () => {
    try {
      return fn();
    } finally {
      span.end();
    }
  });
}
