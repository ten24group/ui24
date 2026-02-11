/**
 * useResolve — evaluate a ConditionalValue<T> to its resolved T value.
 * 
 * If the input is a plain T value (not a ConditionalValue), returns it as-is.
 * If it's a ConditionalValue<T>, evaluates rules and returns the first match
 * or the default.
 * 
 * Sync-only (ConditionalValue rules should use inline conditions, refs,
 * or boolean literals — not custom evaluators).
 * 
 * @example
 * const renderer = useResolve(field.renderer); // string | ConditionalValue<string>
 * // renderer is now just a string
 */

import { useMemo } from 'react';
import { ConditionalValue, NewEvaluationContext, isConditionalValue } from '../types/evaluation';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';

export function useResolve<T>(
  value: T | ConditionalValue<T> | undefined,
  additionalContext?: Record<string, unknown>
): T | undefined {
  const baseContext = useNewEvaluationContext();

  const context = useMemo((): NewEvaluationContext => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return { ...baseContext, ...additionalContext };
  }, [baseContext, additionalContext]);

  return useMemo(() => {
    if (value === undefined || value === null) return undefined;

    if (isConditionalValue<T>(value)) {
      return conditionEvaluator.resolveValue(value, context);
    }

    // Plain value — return as-is
    return value as T;
  }, [value, context]);
}
