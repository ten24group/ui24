/**
 * Re-exports from the split modules.
 * Kept for backward compatibility with existing imports.
 *
 * Application code should import from './api' (thin, no SDK).
 * DevTools code should import initTracing from './sdk' (heavy, SDK).
 */
export { getTracer, SpanStatusCode, context, withSpan, withSpanSync } from './api';
export type { Span, Context } from './api';
