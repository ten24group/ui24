/**
 * useCondition — evaluate a Condition to a boolean.
 * 
 * Primary hook for visibility, enablement, expandability, etc.
 * Returns boolean (not EvaluationResult).
 * 
 * Handles async conditions (custom evaluators) internally:
 * - Returns false (fail-safe) while async evaluation is in flight
 * - Re-renders with actual result when async completes
 * 
 * @example
 * const isVisible = useCondition(field.visibility);
 * const isEnabled = useCondition(field.enablement);
 * 
 * if (!isVisible) return null;
 * return <Field disabled={!isEnabled} />;
 */

import { useMemo, useState, useEffect } from 'react';
import { Condition, NewEvaluationContext } from '../types/evaluation';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { NeedsAsyncError } from '../utils/NeedsAsyncError';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';

export function useCondition(
  condition: Condition | undefined,
  additionalContext?: Record<string, unknown>
): boolean {
  const baseContext = useNewEvaluationContext();

  // Merge additional context if provided
  const context = useMemo((): NewEvaluationContext => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return { ...baseContext, ...additionalContext };
  }, [baseContext, additionalContext]);

  // Track async state
  const [asyncResult, setAsyncResult] = useState<boolean | null>(null);

  // Try sync evaluation first
  const syncResult = useMemo(() => {
    if (condition === undefined || condition === null) return { value: true, needsAsync: false };
    if (typeof condition === 'boolean') return { value: condition, needsAsync: false };

    try {
      const result = conditionEvaluator.evaluateSync(condition, context);
      return { value: result, needsAsync: false };
    } catch (error) {
      if (error instanceof NeedsAsyncError) {
        return { value: false, needsAsync: true }; // fail-safe while loading
      }
      return { value: false, needsAsync: false }; // error → fail-safe
    }
  }, [condition, context]);

  // Handle async evaluation + reset async result when condition/context changes
  useEffect(() => {
    if (!syncResult.needsAsync) {
      // Sync evaluation succeeded; clear any stale async result
      setAsyncResult(null);
      return;
    }

    // Reset and start async evaluation
    setAsyncResult(null);
    let cancelled = false;

    conditionEvaluator.evaluateAsync(condition!, context).then(result => {
      if (!cancelled) {
        setAsyncResult(result);
      }
    });

    return () => { cancelled = true; };
  }, [condition, context, syncResult.needsAsync]);

  // Return async result if available, otherwise sync result
  if (syncResult.needsAsync && asyncResult !== null) {
    return asyncResult;
  }
  return syncResult.value;
}
