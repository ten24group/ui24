import { useCallback } from 'react';
import { runPipeline, defaultPipeline, type PipelineStep, type PipelineRecord, type PipelineFieldConfig, type ResolvedFieldProps } from './pipeline';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';
import { fieldTypeRegistry } from '../registry/FieldTypeRegistry';

interface UseRenderPipelineOptions {
  renderContext: 'table' | 'form' | 'detail';
  routeParams?: Record<string, string>;
  pipeline?: PipelineStep[];
}

export interface PipelineResult {
  isVisible: boolean;
  isEnabled: boolean;
  transformedValue: unknown;
  resolvedProps: ResolvedFieldProps;
}

/**
 * React hook that wraps the rendering pipeline (#95).
 * 
 * Provides a `processField` callback that runs a field through the pipeline,
 * injecting the current condition evaluator, evaluation context, field type registry, etc.
 * 
 * Usage:
 * ```tsx
 * const { processField } = useRenderPipeline({ renderContext: 'table', routeParams });
 * // In column renderer:
 * const result = processField(column, value, record, rowIndex);
 * if (!result.isVisible) return null;
 * // Use result.transformedValue, result.resolvedProps, etc.
 * ```
 */
export function useRenderPipeline({
  renderContext,
  routeParams = {},
  pipeline = defaultPipeline,
}: UseRenderPipelineOptions) {
  const evaluationContext = useNewEvaluationContext();

  const processField = useCallback(
    (
      field: PipelineFieldConfig,
      value: unknown,
      record: PipelineRecord,
      rowIndex?: number,
    ): PipelineResult => {
      const ctx = runPipeline(field, value, record, {
        renderContext,
        routeParams,
        rowIndex,
        conditionEvaluator,
        evaluationContext,
        fieldTypeRegistry,
      }, pipeline);

      return {
        isVisible: ctx.isVisible,
        isEnabled: ctx.isEnabled,
        transformedValue: ctx.transformedValue,
        resolvedProps: ctx.resolvedProps,
      };
    },
    [renderContext, routeParams, evaluationContext, pipeline]
  );

  return { processField };
}
