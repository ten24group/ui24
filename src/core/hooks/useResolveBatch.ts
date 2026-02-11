/**
 * useResolveBatch — evaluate multiple ConditionalValue<T> to their resolved values.
 * 
 * Same as useResolve but for arrays. Sync-only.
 * 
 * @example
 * const renderers = useResolveBatch(fields.map(f => f.renderer));
 * // renderers is now string[]
 */

import { useMemo } from 'react';
import { ConditionalValue, NewEvaluationContext, isConditionalValue } from '../types/evaluation';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';

export function useResolveBatch<T>(
  values: ReadonlyArray<T | ConditionalValue<T> | undefined>,
  additionalContext?: Record<string, unknown>
): Array<T | undefined> {
  const baseContext = useNewEvaluationContext();

  const context = useMemo((): NewEvaluationContext => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return { ...baseContext, ...additionalContext };
  }, [baseContext, additionalContext]);

  return useMemo(() => {
    return values.map(value => {
      if (value === undefined || value === null) return undefined;

      if (isConditionalValue<T>(value)) {
        return conditionEvaluator.resolveValue(value, context);
      }

      return value as T;
    });
  }, [values, context]);
}
