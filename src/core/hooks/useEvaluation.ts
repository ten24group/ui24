/**
 * React hooks for visibility/enablement evaluation.
 * 
 * FIXED: Uses useMemo with sync evaluation (no useState + useEffect anti-pattern)
 * 
 * Hooks:
 * - useEvaluation: Evaluate single visibility config
 * - useEvaluationBatch: Evaluate multiple configs efficiently
 * - useEvaluator: Imperative evaluator for on-demand use
 */

import { useMemo } from 'react';
import { useEvaluationContext } from '../context/EvaluationContext';
import { universalEvaluator } from '../utils/UniversalEvaluator';
import {
  VisibilityConfig,
  EvaluationResult,
  EvaluationContext
} from '../types/evaluation';

/**
 * Evaluate a visibility configuration.
 * FIXED: Proper React hook pattern with useMemo
 * 
 * @param config - Visibility configuration to evaluate
 * @param additionalContext - Additional context to merge (e.g., formValues)
 * @returns Evaluation result with visible, enabled, and loading states
 * 
 * @example
 * const { visible, enabled, disabledMessage } = useEvaluation(
 *   action.visibility,
 *   { formValues }
 * );
 * 
 * if (!visible) return null;
 * return <Button disabled={!enabled}>{action.label}</Button>;
 */
export function useEvaluation(
  config: VisibilityConfig | undefined,
  additionalContext?: Partial<EvaluationContext>
): EvaluationResult {
  
  const baseContext = useEvaluationContext();
  
  // CRITICAL FIX: Only create new object if additionalContext exists
  const context = useMemo(() => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return {
      ...baseContext,
      ...additionalContext
    };
  }, [baseContext, additionalContext]);
  
  // FIXED: Try sync first, fall back to optimistic state for async
  const result = useMemo(() => {
    if (!config) {
      return { visible: true, enabled: true };
    }
    
    try {
      // Try synchronous evaluation (preferred)
      return universalEvaluator.evaluateSync(config, context);
    } catch (e) {
      // Async required - show optimistic state with loading flag
      // In production, consider using Suspense or React Query
      return {
        visible: true,
        enabled: true,
        loading: true
      };
    }
  }, [config, context]);
  
  return result;
}

/**
 * Evaluate multiple visibility configurations efficiently.
 * FIXED: Batch evaluation with proper error handling
 * 
 * @param configs - Array of visibility configs to evaluate
 * @param additionalContext - Additional context to merge
 * @returns Array of evaluation results
 * 
 * @example
 * const evaluations = useEvaluationBatch(
 *   actions.map(a => a.visibility)
 * );
 * 
 * const visibleActions = actions.filter((_, i) => evaluations[i]?.visible);
 */
export function useEvaluationBatch(
  configs: Array<VisibilityConfig | undefined>,
  additionalContext?: Partial<EvaluationContext>
): EvaluationResult[] {
  
  const baseContext = useEvaluationContext();
  
  // CRITICAL FIX: Only create new object if additionalContext exists
  const context = useMemo(() => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return baseContext;
    }
    return {
      ...baseContext,
      ...additionalContext
    };
  }, [baseContext, additionalContext]);
  
  // Evaluate all configs synchronously where possible
  const results = useMemo(() => {
    return configs.map(config => {
      if (!config) {
        return { visible: true, enabled: true };
      }
      
      try {
        return universalEvaluator.evaluateSync(config, context);
      } catch (e) {
        // Async required - show optimistic state
        return { visible: true, enabled: true, loading: true };
      }
    });
  }, [configs, context]);
  
  return results;
}

/**
 * Imperative evaluator for on-demand use.
 * Use when you need to evaluate outside render cycle.
 * 
 * @returns Async evaluator function
 * 
 * @example
 * const evaluate = useEvaluator();
 * 
 * const handleClick = async () => {
 *   const result = await evaluate(config, { customData });
 *   if (result.visible) {
 *     // do something
 *   }
 * };
 */
export function useEvaluator() {
  const baseContext = useEvaluationContext();
  
  return async (
    config: VisibilityConfig | undefined,
    additionalContext?: Partial<EvaluationContext>
  ): Promise<EvaluationResult> => {
    const context = { ...baseContext, ...additionalContext };
    
    if (!config) {
      return { visible: true, enabled: true };
    }
    
    return await universalEvaluator.evaluate(config, context);
  };
}

