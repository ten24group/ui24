/**
 * useConditionBatch — evaluate multiple Conditions to booleans.
 * 
 * Sync-only (batch doesn't support async — returns false for custom conditions).
 * Used by components that need to evaluate many conditions at once
 * (e.g., form fields, table columns, page actions).
 * 
 * @example
 * const visibilities = useConditionBatch(
 *   fields.map(f => f.visibility)
 * );
 * const visibleFields = fields.filter((_, i) => visibilities[i]);
 */

import { useMemo } from 'react';
import { Condition, NewEvaluationContext } from '../types/evaluation';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';

export function useConditionBatch(
  conditions: ReadonlyArray<Condition | undefined>,
  additionalContext?: Record<string, unknown>
): boolean[] {
  const baseContext = useNewEvaluationContext();

  const context = useMemo((): NewEvaluationContext => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return { ...baseContext, ...additionalContext };
  }, [baseContext, additionalContext]);

  return useMemo(() => {
    return conditions.map(condition => {
      if (condition === undefined || condition === null) return true;
      if (typeof condition === 'boolean') return condition;

      try {
        return conditionEvaluator.evaluateSync(condition, context);
      } catch {
        // Async required or error → fail-safe false
        return false;
      }
    });
  }, [conditions, context]);
}
