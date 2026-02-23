// Thin API — safe to import from any application code path
export { getTracer, SpanStatusCode } from './api';
export type { Span } from './api';

// DevTools span store — reactive hooks for panels
export { useTraceStore, clearTraceStore, getTraceStoreSnapshot, type TraceSpan, type SpanLevel } from './DevToolsSpanProcessor';

// Lightweight span stack for parent-child relationships (no React Context overhead)
export { 
  pushActiveSpan, 
  popActiveSpan, 
  getActiveSpan, 
  getActiveSpanId 
} from './activeSpanStack';

// Reusable hook for span management
export { useSpan } from './useSpan';

// HTTP span utility for non-React code (e.g., ApiContext)
export { createHttpSpan } from './httpSpan';

// Core instrumentation API — clean abstraction over OTel
export { instrument, InstrumentHandle } from './instrumentation';

// React integration hooks — automatic instrumentation for common patterns
export {
  useModalInstrumentation,
  useModalContentSpan,
  useNavigationSpan,
  usePageSpan,
  useSectionSpan,
  useFormSubmitInstrumentation,
  useComponentSpan,
} from './react';

// NOTE: initTracing (SDK) is NOT exported here.
// Import it directly from './sdk' in DevTools code only.
