/**
 * Internal shared utilities for React telemetry hooks.
 * NOT exported - only used within the telemetry module.
 */

import { useRef, useEffect, useLayoutEffect } from 'react';
import { IS_DEV } from '../constants';
import type { Span } from './api';
import { getTracer, getActiveSpanId, pushActiveSpan, popActiveSpan, context } from './api';

interface BaseSpanOptions {
  tracer: string;
  spanName: string;
  attributes?: Record<string, any>;
  useActiveContext?: boolean;
}

/**
 * Shared logic for conditional spans (active/inactive pattern).
 * Used by useModalContentSpan, useSectionSpan.
 */
export function useConditionalSpan(
  active: boolean,
  options: BaseSpanOptions,
  deps: any[]
) {
  const spanRef = useRef<Span | undefined>(undefined);

  useEffect(() => {
    if (!IS_DEV) return;

    // Start span when active becomes true
    if (active && !spanRef.current) {
      const tracer = getTracer(options.tracer);
      const parentSpanId = getActiveSpanId();

      const spanContext = options.useActiveContext ? context.active() : undefined;

      spanRef.current = tracer.startSpan(options.spanName, {
        attributes: {
          'span.level': 'trace',
          ...(parentSpanId && { '__parentSpanId': parentSpanId }),
          ...options.attributes
        }
      }, spanContext);

      pushActiveSpan(spanRef.current);
    }

    // End span when active becomes false
    if (!active && spanRef.current) {
      popActiveSpan();
      spanRef.current.end();
      spanRef.current = undefined;
    }
  }, [active, ...deps]);

  return spanRef;
}

/**
 * Shared logic for component lifecycle spans.
 * Used by useComponentSpan.
 */
export function useLifecycleSpan(
  options: BaseSpanOptions & { enabled?: boolean },
  deps: any[]
) {
  const spanRef = useRef<Span | undefined>(undefined);

  useLayoutEffect(() => {
    if (!IS_DEV || options.enabled === false) {
      return;
    }

    const tracer = getTracer(options.tracer);
    const parentSpanId = getActiveSpanId();

    spanRef.current = tracer.startSpan(options.spanName, {
      attributes: {
        'span.level': 'debug',
        ...(parentSpanId && { '__parentSpanId': parentSpanId }),
        ...options.attributes
      }
    });

    return () => {
      if (spanRef.current) {
        spanRef.current.end();
        spanRef.current = undefined;
      }
    };
  }, deps);

  return spanRef;
}

/**
 * Shared logic for Strict Mode aware page spans.
 * Handles double-mount by tracking mount state.
 */
export function useStrictModePageSpan(
  pageKey: string,
  options: BaseSpanOptions
) {
  const spanRef = useRef<Span | undefined>(undefined);
  const isMountedRef = useRef(false);
  const pageKeyRef = useRef<string>('');

  useLayoutEffect(() => {
    if (!IS_DEV) return;

    const isNewPage = pageKeyRef.current !== pageKey;

    // New page - end old span
    if (isNewPage && spanRef.current) {
      popActiveSpan();
      spanRef.current.end();
      spanRef.current = undefined;
      isMountedRef.current = false;
    }

    // Re-mount: push existing span back
    if (isMountedRef.current && spanRef.current) {
      pushActiveSpan(spanRef.current);
      return () => {
        popActiveSpan();
      };
    }

    // First mount: create span
    isMountedRef.current = true;
    pageKeyRef.current = pageKey;

    const tracer = getTracer(options.tracer);
    const parentSpanId = getActiveSpanId();

    spanRef.current = tracer.startSpan(options.spanName, {
      attributes: {
        'span.level': 'info',
        ...(parentSpanId && { '__parentSpanId': parentSpanId }),
        ...options.attributes
      }
    });

    pushActiveSpan(spanRef.current);

    return () => {
      if (spanRef.current) {
        popActiveSpan();
      }
    };
  }, [pageKey]);

  // Final cleanup
  useEffect(() => {
    return () => {
      if (spanRef.current && IS_DEV) {
        spanRef.current.end();
        spanRef.current = undefined;
        isMountedRef.current = false;
      }
    };
  }, [pageKey]);

  return spanRef;
}

/**
 * Shared logic for navigation span creation.
 * Uses a layout effect to avoid render-phase side effects.
 * Creates a new span whenever `key` changes, ending the previous one.
 */
export function useNavigationSpanInternal(
  key: string,
  options: BaseSpanOptions
) {
  const spanRef = useRef<Span | undefined>(undefined);
  const keyRef = useRef<string>('');

  useLayoutEffect(() => {
    if (!IS_DEV) return;

    // Clean up previous span if key changed
    if (spanRef.current && keyRef.current !== key) {
      popActiveSpan();
      spanRef.current.end();
      spanRef.current = undefined;
    }

    // Create span for this key (guard: only if not already created)
    if (!spanRef.current) {
      const tracer = getTracer(options.tracer);
      const parentSpanId = getActiveSpanId();

      spanRef.current = tracer.startSpan(options.spanName, {
        attributes: {
          'span.level': 'info',
          ...(parentSpanId && { '__parentSpanId': parentSpanId }),
          ...options.attributes
        }
      });

      pushActiveSpan(spanRef.current);
      keyRef.current = key;
    }

    return () => {
      if (spanRef.current && IS_DEV) {
        popActiveSpan();
      }
    };
  }, [key]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (spanRef.current && IS_DEV) {
        popActiveSpan();
        spanRef.current.end();
        spanRef.current = undefined;
      }
    };
  }, []);

  return spanRef;
}
