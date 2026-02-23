/**
 * OTel SDK initialization — HEAVY imports, only loaded in dev.
 *
 * This file imports WebTracerProvider, SimpleSpanProcessor, etc.
 * It must NEVER be imported from application code paths.
 * UI24.tsx calls initTracing() on mount in dev mode.
 */
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { ExportResult } from '@opentelemetry/core';
import { pushSpan, type TraceSpan } from './DevToolsSpanProcessor';

let _initialized = false;

export function initTracing(): void {
  if (_initialized) return;
  _initialized = true;

  try {
    const devToolsExporter = {
      export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
        for (const span of spans) {
          const attrs = flattenAttributes(span.attributes);

          // Determine severity level from attributes or span status
          let level: TraceSpan['level'] = 'info';
          const attrLevel = attrs['span.level'];
          if (typeof attrLevel === 'string' && isValidLevel(attrLevel)) {
            level = attrLevel;
          } else if (span.status.code === 2) {
            level = 'error';
          } else if (span.name.includes('error') || span.name.includes('fail')) {
            level = 'error';
          } else if (span.name.includes('warn')) {
            level = 'warn';
          } else if (span.name.includes('debug')) {
            level = 'debug';
          }

          // parentSpanId is set at span-creation time via the '__parentSpanId' attribute.
          // The standard OTel parentSpanContext is also checked as a fallback.
          const parentSpanId =
            (attrs['__parentSpanId'] as string | undefined) ||
            span.parentSpanContext?.spanId ||
            undefined;

          // Remove internal tracking attribute from final output
          delete attrs['__parentSpanId'];

          const traceSpan: TraceSpan = {
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            parentSpanId,
            name: span.name,
            kind: span.kind,
            startTime: hrTimeToMs(span.startTime),
            endTime: hrTimeToMs(span.endTime),
            duration: hrTimeToMs(span.endTime) - hrTimeToMs(span.startTime),
            status: { code: span.status.code, message: span.status.message },
            attributes: attrs,
            events: (span.events || []).map(e => ({
              name: e.name,
              time: hrTimeToMs(e.time),
              attributes: e.attributes as Record<string, unknown> | undefined,
            })),
            level,
          };
          pushSpan(traceSpan);
        }
        resultCallback({ code: 0 });
      },
      shutdown() {
        return Promise.resolve();
      },
    };

    const provider = new WebTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(devToolsExporter as any)],
    });
    provider.register();
  } catch (err) {
    console.warn('[ui24 Telemetry] Failed to initialize OTel SDK:', err);
  }
}

function hrTimeToMs(hrTime: [number, number] | number): number {
  if (typeof hrTime === 'number') return hrTime;
  if (Array.isArray(hrTime)) return hrTime[0] * 1000 + hrTime[1] / 1e6;
  return 0;
}

type FlatAttributeValue = string | number | boolean | undefined;

function flattenAttributes(attrs: ReadableSpan['attributes']): Record<string, FlatAttributeValue> {
  if (!attrs) return {};
  const result: Record<string, FlatAttributeValue> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value != null) {
      result[key] = String(value);
    }
  }
  return result;
}

const VALID_LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error']);
function isValidLevel(v: string): v is TraceSpan['level'] {
  return VALID_LEVELS.has(v);
}
