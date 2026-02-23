import { useRef, useLayoutEffect } from 'react';
import { getTracer, type Span } from './api';
import { getActiveSpanId, pushActiveSpan, popActiveSpan } from './activeSpanStack';
import { IS_DEV } from '../constants';

interface UseSpanOptions {
  name?: string;
  entityName?: string;
  apiUrl?: string;
  identifiers?: any;
  type: string;
  attributes?: Record<string, any>;
  enabled?: boolean;
}

export function useSpan({
  name,
  entityName,
  apiUrl,
  identifiers,
  type,
  attributes = {},
  enabled = true,
}: UseSpanOptions) {
  const spanRef = useRef<Span | undefined>(undefined);
  // Stable tracer ref — getTracer() can return new instances on each call,
  // so we capture it once to avoid the useLayoutEffect re-running every render.
  const tracerRef = useRef(IS_DEV ? getTracer('ui24.core') : null);

  useLayoutEffect(() => {
    if (!IS_DEV || !enabled) return;

    const tracer = tracerRef.current!;

    // Smart entity name resolution
    let finalEntityName = entityName;

    // Fallback 1: Extract from API URL
    if (!finalEntityName && apiUrl) {
      try {
        const urlPath = new URL(apiUrl, 'http://dummy').pathname;
        const pathParts = urlPath.split('/').filter(Boolean);
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i];
          if (!/^[0-9a-f-]{36}$/.test(part) &&
              !/^\d+$/.test(part) &&
              !['api', 'v1', 'v2', 'query', 'detail', 'view', 'list', 'add', 'update', 'create', 'edit'].includes(part)) {
            finalEntityName = part;
            break;
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    }

    // Fallback 2: Default
    if (!finalEntityName) {
      finalEntityName = 'Unknown';
    }

    const spanName = name || `${type}: ${finalEntityName}`;
    const parentSpanId = getActiveSpanId();

    spanRef.current = tracer.startSpan(spanName, {
      attributes: {
        'span.type': type,
        'entity.name': finalEntityName,
        'span.level': 'info',
        ...(identifiers ? { 'entity.identifier': typeof identifiers === 'string' ? identifiers : JSON.stringify(identifiers) } : {}),
        ...(parentSpanId && { '__parentSpanId': parentSpanId }),
        ...attributes,
      },
    });

    pushActiveSpan(spanRef.current);

    return () => {
      if (spanRef.current) {
        popActiveSpan();
        spanRef.current.end();
        spanRef.current = undefined;
      }
    };
  }, [name, entityName, apiUrl, identifiers, type, enabled]);

  const updateSpan = (attrs: Record<string, any>) => {
    if (spanRef.current && IS_DEV) {
      for (const [key, value] of Object.entries(attrs)) {
        spanRef.current.setAttribute(key, value);
      }
    }
  };

  return { span: spanRef.current, updateSpan };
}
