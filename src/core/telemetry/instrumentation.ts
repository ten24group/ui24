/**
 * Core Instrumentation Layer
 * 
 * Provides a clean, type-safe abstraction over OpenTelemetry for framework instrumentation.
 * All dev/prod checks are centralized here, making instrumentation code elsewhere clean and simple.
 * 
 * Key Features:
 * - Zero-overhead in production (all checks compile away)
 * - No OTel knowledge required by consumers
 * - Type-safe attribute handling
 * - Automatic error handling and cleanup
 */

import { IS_DEV } from '../constants';
import type { Span } from './api';

type Attributes = Record<string, string | number | boolean>;

/**
 * Handle for a manually-managed span.
 * Allows setting attributes and ending the span.
 */
export class InstrumentHandle {
  private span: Span | null = null;
  
  /**
   * Set an attribute on the span.
   * No-op in production or if span doesn't exist.
   */
  setAttribute(key: string, value: string | number | boolean): void {
    if (this.span && IS_DEV) {
      this.span.setAttribute(key, value);
    }
  }
  
  /**
   * End the span and clean up.
   * No-op in production or if already ended.
   */
  end(): void {
    if (this.span && IS_DEV) {
      this.span.end();
      this.span = null;
    }
  }
}

/**
 * Core instrumentation API.
 * All methods are no-ops in production for zero overhead.
 */
export const instrument = {
  /**
   * Create and immediately end a span (fire-and-forget).
   * Use for instant actions like button clicks, modal close, etc.
   * 
   * @example
   * instrument.event('modal.close', { 'modal.reason': 'cancel' });
   */
  event(name: string, attrs?: Attributes): void {
    if (!IS_DEV) return;
    
    const { getTracer, context } = require('./api');
    const tracer = getTracer('ui24.core');
    const span = tracer.startSpan(name, {
      attributes: { ...attrs, 'span.level': 'debug' }
    }, context.active());
    span.end();
  },
  
  /**
   * Create a span that must be manually ended.
   * Use when you need to set attributes or control lifetime.
   * 
   * @example
   * const handle = instrument.begin('config.load', 'async', { phase: 'app' });
   * try {
   *   await loadConfig();
   *   handle.setAttribute('success', true);
   * } finally {
   *   handle.end();
   * }
   */
  begin(name: string, type: string, attrs?: Attributes): InstrumentHandle {
    const handle = new InstrumentHandle();
    if (!IS_DEV) return handle;
    
    const { getTracer, context } = require('./api');
    const tracer = getTracer('ui24.core');
    handle['span'] = tracer.startSpan(name, {
      attributes: {
        'span.type': type,
        'span.level': 'debug',
        ...attrs
      }
    }, context.active());
    
    return handle;
  },
  
  /**
   * Wrap a synchronous function with automatic span lifecycle.
   * The span is created on call and ended on return/throw.
   * 
   * @example
   * const instrumented = instrument.wrap(myFunction, 'myFunction', { module: 'utils' });
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    attrs?: Attributes
  ): T {
    if (!IS_DEV) return fn;
    
    return ((...args: any[]) => {
      const handle = instrument.begin(name, 'function', attrs);
      try {
        const result = fn(...args);
        handle.end();
        return result;
      } catch (error) {
        handle.setAttribute('error', true);
        handle.end();
        throw error;
      }
    }) as T;
  },
  
  /**
   * Wrap an async function with automatic span lifecycle.
   * The span is created on call and ended on resolve/reject.
   * 
   * @example
   * const instrumented = instrument.wrapAsync(fetchData, 'fetchData', { api: 'rest' });
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string,
    attrs?: Attributes
  ): T {
    if (!IS_DEV) return fn;
    
    return (async (...args: any[]) => {
      const handle = instrument.begin(name, 'async.function', attrs);
      try {
        const result = await fn(...args);
        handle.end();
        return result;
      } catch (error) {
        handle.setAttribute('error', true);
        handle.end();
        throw error;
      }
    }) as T;
  }
};
