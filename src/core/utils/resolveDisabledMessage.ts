/**
 * Utility to resolve disabledMessage templates against evaluation context.
 * 
 * Replaces manual `conditionEvaluator.resolveTemplate(msg, ctx)` calls
 * scattered across 6+ component files.
 * 
 * @example
 * const msg = resolveDisabledMessage('Contact {record.owner} to edit', ctx);
 * // → 'Contact john@acme.com to edit'
 */

import { NewEvaluationContext } from '../types/evaluation';
import { conditionEvaluator } from './ConditionEvaluator';

/**
 * Resolve a disabledMessage template string, returning undefined if no message.
 * 
 * @param msg - The raw template string (may contain {placeholder} syntax)
 * @param ctx - The evaluation context to resolve placeholders against
 * @param overrides - Optional additional context values merged on top of ctx
 * @returns The resolved string, or undefined if msg is falsy
 */
export function resolveDisabledMessage(
  msg: string | undefined,
  ctx: NewEvaluationContext,
  overrides?: Record<string, unknown>
): string | undefined {
  if (!msg) return undefined;
  const mergedCtx = overrides
    ? { ...ctx, ...overrides } as NewEvaluationContext
    : ctx;
  return conditionEvaluator.resolveTemplate(msg, mergedCtx);
}
