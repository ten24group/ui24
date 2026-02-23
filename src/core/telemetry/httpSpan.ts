import { getTracer } from './api';
import { getActiveSpanId } from './activeSpanStack';
import type { Span } from './api';

interface CreateHttpSpanOptions {
  method: string;
  url: string;
}

interface HttpSpanResult {
  span: Span;
  endpointName: string;
}

/**
 * Creates an OpenTelemetry span for HTTP requests with automatic parent linking.
 * Used by ApiContext for tracing API calls.
 */
export function createHttpSpan({ method, url }: CreateHttpSpanOptions): HttpSpanResult {
  // Extract endpoint name from URL
  let endpointName = url;
  try {
    const urlPath = new URL(url, 'http://dummy').pathname;
    const pathParts = urlPath.split('/').filter(Boolean);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      if (!/^[0-9a-f-]{36}$/.test(part) && !/^\d+$/.test(part) && !['api', 'v1', 'v2', 'query'].includes(part)) {
        endpointName = part;
        break;
      }
    }
  } catch {
    // If URL parsing fails, use the full URL
  }

  const spanName = `${method}: ${endpointName}`;
  const tracer = getTracer('ui24.api');
  const parentSpanId = getActiveSpanId();

  const span = tracer.startSpan(spanName, {
    attributes: {
      'span.type': 'http.request',
      'http.method': method,
      'http.url': url,
      'http.endpoint': endpointName,
      'span.level': 'debug',
      ...(parentSpanId && { '__parentSpanId': parentSpanId }),
    },
  });

  return { span, endpointName };
}
