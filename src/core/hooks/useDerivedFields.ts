import { useMemo } from 'react';
import type { IDerivedFieldConfig } from '../types/field-config';
import { evaluateTemplate } from '../utils/template';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import type { NewEvaluationContext } from '../types/evaluation';

/**
 * Safely evaluate a simple arithmetic expression.
 * Only supports +, -, *, / and field references from context.
 * Returns undefined if evaluation fails.
 */
function evaluateExpression(expr: string, context: Record<string, unknown>): number | undefined {
  try {
    const resolved = expr.replace(/[a-zA-Z_]\w*(\.\w+)*/g, (match) => {
      const parts = match.split('.');
      let val: unknown = context;
      for (const part of parts) {
        if (val === null || val === undefined || typeof val !== 'object') return 'NaN';
        val = (val as Record<string, unknown>)[part];
      }
      return typeof val === 'number' ? String(val) : 'NaN';
    });
    if (/[^0-9+\-*/.()\s]/.test(resolved)) return undefined;
    const result = Function(`"use strict"; return (${resolved})`)() as unknown;
    return typeof result === 'number' && !isNaN(result) ? result : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compute the value for a derived field given form values and evaluation context.
 */
export function computeDerivedValue(
  config: IDerivedFieldConfig,
  formValues: Record<string, unknown>,
  evalCtx?: NewEvaluationContext
): unknown {
  if (config.template) {
    return evaluateTemplate(config.template, formValues);
  }

  if (config.expression) {
    return evaluateExpression(config.expression, formValues);
  }

  if (config.conditions && evalCtx) {
    for (const branch of config.conditions) {
      const result = conditionEvaluator.evaluateSync(branch.when, evalCtx);
      if (result) return branch.value;
    }
  }

  return undefined;
}

/**
 * Compute all derived field values for a given set of fields and form values.
 * Returns a map of fieldName -> computed value.
 */
export function useDerivedFieldValues(
  fields: ReadonlyArray<{ name?: string; derived?: IDerivedFieldConfig }>,
  formValues: Record<string, unknown>,
  evalCtx?: NewEvaluationContext
): Record<string, unknown> {
  return useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.derived && field.name) {
        result[field.name] = computeDerivedValue(field.derived, formValues, evalCtx);
      }
    }
    return result;
  }, [fields, formValues, evalCtx]);
}
