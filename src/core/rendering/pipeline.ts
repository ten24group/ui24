/**
 * Unified Rendering Pipeline (#95)
 * 
 * Composable per-field pipeline replacing scattered rendering logic.
 * Each step transforms a FieldRenderContext, building up the final
 * rendered output through a chain of: evaluate → transform → resolve → select → format.
 * 
 * @example
 * const result = renderField(field, value, { record, routeParams, evaluationContext });
 * if (result.isVisible) {
 *   return result.element;
 * }
 */

import type { ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/** Record type that may carry the original unformatted data under `__raw__`. */
export type PipelineRecord = Record<string, unknown> & { __raw__?: Record<string, unknown> };

/**
 * Minimum field configuration shape the pipeline can process.
 * 
 * IMPORTANT: This is a `type` alias (NOT an interface) so that all field config
 * interfaces (IDetailFieldConfig, ITablePropertiesConfig, IFormField, etc.) are
 * naturally assignable to it through structural subtyping — without requiring
 * explicit index signatures or type assertions at call sites.
 * 
 * Only properties actually read by pipeline steps are listed here.
 * Callers may pass objects with additional properties (no excess check on variables).
 */
export type PipelineFieldConfig = {
  /** Field type identifier (e.g. 'text', 'select', 'boolean') */
  fieldType?: string;
  /** Conditional props — may be plain strings or ConditionalValue<string> objects */
  label?: unknown;
  placeholder?: unknown;
  helpText?: unknown;
  description?: unknown;
  tooltip?: unknown;
  /** Condition for conditional visibility */
  visibility?: unknown;
  /** Condition for conditional enablement */
  enablement?: unknown;
  /** Custom renderer key or ConditionalValue */
  renderer?: unknown;
  /** Boolean field display labels */
  booleanLabels?: { true?: unknown; false?: unknown };
  /** Conditional formatting rules */
  formatting?: unknown[];
};

/** Keys on PipelineFieldConfig that may hold ConditionalValue<string> and are resolved to strings. */
const CONDITIONAL_PROP_KEYS = ['label', 'placeholder', 'helpText', 'description', 'tooltip'] as const;
type ConditionalPropKey = typeof CONDITIONAL_PROP_KEYS[number];

/**
 * Resolved props produced by the pipeline.
 * Includes conditional values resolved to strings and formatting metadata.
 * Note: Registry component lookups are done directly by consumers via fieldTypeRegistry.get()
 * to preserve proper type safety (ComponentType<BuiltInFormFieldProps> vs ComponentType<BuiltInDetailFieldProps> etc).
 */
export interface ResolvedFieldProps {
  // Conditional prop resolutions (from resolveConditionalProps step)
  label?: string;
  placeholder?: string;
  helpText?: string;
  description?: string;
  tooltip?: string;
  
  // Explicit renderer name (from selectRenderer step) — used by ExtensionRegistry
  _explicitRenderer?: string;
  
  // Smart defaults from registry (from selectRenderer step)
  _registryDefaults?: Record<string, unknown>;
  
  // Formatting metadata (from applyFormatting step)
  _formattingStyles?: Record<string, string | number>;
  _formattingClassName?: string;
  _formattingBadge?: { status: string };
  _formattingIcon?: { name: string; color?: string };
}

/**
 * Context passed through each pipeline step.
 * Each step reads from and writes to this shared context.
 */
export interface FieldRenderContext {
  /** The field configuration (column config, form field config, detail item config) */
  field: PipelineFieldConfig;
  /** The raw value from the record */
  value: unknown;
  /** The full record (row data). May include `__raw__` with the original unformatted record. */
  record: PipelineRecord;
  /** Route parameters for URL substitution */
  routeParams: Record<string, string>;

  // Pipeline outputs (built up by steps)
  /** Whether the field is visible (set by evaluateConditions) */
  isVisible: boolean;
  /** Whether the field is enabled/editable (set by evaluateConditions) */
  isEnabled: boolean;
  /** Transformed value (set by transformValue) */
  transformedValue: unknown;
  /** Resolved props — conditional values flattened + formatting metadata (set by pipeline steps) */
  resolvedProps: ResolvedFieldProps;
  /** Selected renderer component or function (set by selectRenderer) */
  renderer: ((value: unknown, record: Record<string, unknown>, index: number) => ReactNode) | null;
  /** Final rendered element (set by applyFormatting or selectRenderer) */
  element: ReactNode | null;

  /** Rendering context: table, form, or detail */
  renderContext: 'table' | 'form' | 'detail';
  /** Row index (table context only) */
  rowIndex?: number;
  /** Condition evaluator instance (injected by caller) */
  conditionEvaluator?: { 
    evaluateSync: (condition: unknown, ctx: Record<string, unknown>) => boolean; 
    resolveValue: (value: unknown, ctx: Record<string, unknown>) => unknown;
  };
  /** Evaluation context (user, record, etc.) */
  evaluationContext?: Record<string, unknown>;
  /** Field type registry instance */
  fieldTypeRegistry?: { 
    get: <C extends 'form' | 'detail' | 'table'>(type: string, context: C) => React.ComponentType<any> | null;
    getDefaults: (type: string, context: 'form' | 'detail' | 'table') => Record<string, unknown> | null;
  };
}

/**
 * A single step in the rendering pipeline.
 * Takes context, returns modified context.
 */
export type PipelineStep = (ctx: FieldRenderContext) => FieldRenderContext;

// ============================================================================
// PIPELINE STEPS
// ============================================================================

/**
 * Step 1: Evaluate visibility and enablement conditions.
 * Sets `isVisible` and `isEnabled` on context.
 */
export const evaluateConditions: PipelineStep = (ctx) => {
  const { field, conditionEvaluator, evaluationContext, record } = ctx;

  const rawRecord = record.__raw__ || record;

  // Visibility condition
  if (field.visibility && conditionEvaluator) {
    try {
      ctx.isVisible = conditionEvaluator.evaluateSync(field.visibility, {
        ...evaluationContext,
        record: rawRecord,
      });
    } catch {
      ctx.isVisible = true; // fail-safe: show the field
    }
  }

  // Enablement condition
  if (field.enablement && conditionEvaluator) {
    try {
      ctx.isEnabled = conditionEvaluator.evaluateSync(field.enablement, {
        ...evaluationContext,
        record: rawRecord,
      });
    } catch {
      ctx.isEnabled = true; // fail-safe: keep enabled
    }
  }

  return ctx;
};

/**
 * Step 2: Transform the raw value.
 * Applies format config, template interpolation, type coercion.
 */
export const transformValue: PipelineStep = (ctx) => {
  const { field, value } = ctx;

  let transformed = value;

  // Boolean label transformation — field.booleanLabels is typed as { true?: unknown; false?: unknown }
  if (field.fieldType === 'boolean' && field.booleanLabels) {
    const boolVal = transformed === true || transformed === 'true' || transformed === 1;
    transformed = boolVal ? field.booleanLabels.true : field.booleanLabels.false;
  }

  ctx.transformedValue = transformed;
  return ctx;
};

/**
 * Step 3: Resolve conditional props.
 * Flattens ConditionalValue<T> on label, placeholder, helpText, etc.
 * 
 * Uses CONDITIONAL_PROP_KEYS (const tuple) so TypeScript narrows the key type
 * to the union of literal keys, enabling type-safe indexing on both
 * PipelineFieldConfig and ResolvedFieldProps without casts.
 */
export const resolveConditionalProps: PipelineStep = (ctx) => {
  const { field, conditionEvaluator, evaluationContext, record } = ctx;

  const rawRecord = record.__raw__ || record;
  const resolveCtx = { ...evaluationContext, record: rawRecord };

  for (const key of CONDITIONAL_PROP_KEYS) {
    const propValue = field[key]; // PipelineFieldConfig[ConditionalPropKey] → unknown
    if (propValue === undefined) continue;

    // ConditionalValue objects have a `rules` array
    if (typeof propValue === 'object' && propValue !== null && 'rules' in propValue && conditionEvaluator) {
      try {
        const resolved = conditionEvaluator.resolveValue(propValue, resolveCtx);
        ctx.resolvedProps[key] = typeof resolved === 'string' ? resolved : undefined;
      } catch {
        // Fall back to the default value if condition evaluation fails
        const fallback = 'default' in propValue ? propValue.default : undefined;
        ctx.resolvedProps[key] = typeof fallback === 'string' ? fallback : undefined;
      }
    } else {
      // Plain string value — assign directly with runtime narrowing
      ctx.resolvedProps[key] = typeof propValue === 'string' ? propValue : undefined;
    }
  }

  return ctx;
};

/**
 * Step 4: Select the appropriate renderer.
 * Priority: explicit renderer → ExtensionRegistry → FieldTypeRegistry → fallback.
 */
export const selectRenderer: PipelineStep = (ctx) => {
  const { field, fieldTypeRegistry, renderContext } = ctx;
  const fieldType = field.fieldType ? field.fieldType.toLowerCase() : '';

  // Priority 1: Explicit renderer name on the field config
  if (typeof field.renderer === 'string' && field.renderer) {
    // Handled externally (Extension registry lookups are component-based, not pure functions)
    // We mark it so the consumer knows to use the extension registry
    ctx.resolvedProps._explicitRenderer = field.renderer;
    return ctx;
  }

  // Priority 2: FieldTypeRegistry — only store defaults here, component lookup done by consumers
  if (fieldType && fieldTypeRegistry) {
    // Merge smart defaults from registry (#98)
    const defaults = fieldTypeRegistry.getDefaults(fieldType, renderContext);
    if (defaults) {
      ctx.resolvedProps._registryDefaults = defaults;
    }
  }

  return ctx;
};

/**
 * Step 5: Apply formatting rules (cell/row formatting).
 * Wraps the rendered element with conditional styles, badges, icons.
 */
export const applyFormatting: PipelineStep = (ctx) => {
  const { field, record, conditionEvaluator, evaluationContext } = ctx;

  if (!field.formatting || field.formatting.length === 0) {
    return ctx;
  }

  const rawRecord = record.__raw__ || record;
  const styles: Record<string, string | number> = {};
  let className = '';
  let badge: { status: string } | undefined;
  let icon: { name: string; color?: string } | undefined;

  for (const rawRule of field.formatting) {
    // Runtime validation: each rule must be a non-null object with a `when` condition
    if (!conditionEvaluator || !rawRule || typeof rawRule !== 'object') continue;
    if (!('when' in rawRule)) continue;

    try {
      const match = conditionEvaluator.evaluateSync(rawRule.when, {
        ...evaluationContext,
        record: rawRecord,
      });
      if (match) {
        if ('style' in rawRule && rawRule.style && typeof rawRule.style === 'object') {
          Object.assign(styles, rawRule.style);
        }
        if ('className' in rawRule && typeof rawRule.className === 'string') {
          className += (className ? ' ' : '') + rawRule.className;
        }
        if ('badge' in rawRule && rawRule.badge && typeof rawRule.badge === 'object' && 'status' in rawRule.badge && typeof rawRule.badge.status === 'string' && !badge) {
          badge = { status: rawRule.badge.status };
        }
        if ('icon' in rawRule && rawRule.icon && typeof rawRule.icon === 'object' && 'name' in rawRule.icon && typeof rawRule.icon.name === 'string' && !icon) {
          icon = { name: rawRule.icon.name, color: 'color' in rawRule.icon && typeof rawRule.icon.color === 'string' ? rawRule.icon.color : undefined };
        }
      }
    } catch {
      // fail-safe: skip
    }
  }

  ctx.resolvedProps._formattingStyles = Object.keys(styles).length > 0 ? styles : undefined;
  ctx.resolvedProps._formattingClassName = className || undefined;
  ctx.resolvedProps._formattingBadge = badge;
  ctx.resolvedProps._formattingIcon = icon;

  return ctx;
};

// ============================================================================
// DEFAULT PIPELINE
// ============================================================================

/**
 * Default pipeline steps in order.
 * Consumers can customize by adding/removing/reordering steps.
 */
export const defaultPipeline: PipelineStep[] = [
  evaluateConditions,
  transformValue,
  resolveConditionalProps,
  selectRenderer,
  applyFormatting,
];

// ============================================================================
// PIPELINE RUNNER
// ============================================================================

export type PipelineOptions = {
  routeParams?: Record<string, string>;
  renderContext: 'table' | 'form' | 'detail';
  rowIndex?: number;
  conditionEvaluator?: FieldRenderContext['conditionEvaluator'];
  evaluationContext?: Record<string, unknown>;
  fieldTypeRegistry?: FieldRenderContext['fieldTypeRegistry'];
};

/**
 * Create initial FieldRenderContext with sensible defaults.
 */
export function createFieldContext(
  field: PipelineFieldConfig,
  value: unknown,
  record: PipelineRecord,
  options: PipelineOptions
): FieldRenderContext {
  return {
    field,
    value,
    record,
    routeParams: options.routeParams || {},
    isVisible: true,
    isEnabled: true,
    transformedValue: value,
    resolvedProps: {},
    renderer: null,
    element: null,
    renderContext: options.renderContext,
    rowIndex: options.rowIndex,
    conditionEvaluator: options.conditionEvaluator,
    evaluationContext: options.evaluationContext,
    fieldTypeRegistry: options.fieldTypeRegistry,
  };
}

/**
 * Run the rendering pipeline on a field.
 * 
 * @param field - Field configuration
 * @param value - Raw value from the record
 * @param record - Full record data
 * @param options - Pipeline options (evaluator, registry, context, etc.)
 * @param pipeline - Pipeline steps to run (default: defaultPipeline)
 * @returns Pipeline result with isVisible, isEnabled, resolvedProps, etc.
 * 
 * @example
 * const result = runPipeline(column, record[column.dataIndex], record, {
 *   renderContext: 'table',
 *   conditionEvaluator,
 *   evaluationContext,
 *   fieldTypeRegistry,
 *   routeParams,
 * });
 * 
 * if (!result.isVisible) return null;
 * // Use result.resolvedProps, result.transformedValue, etc.
 */
export function runPipeline(
  field: PipelineFieldConfig,
  value: unknown,
  record: PipelineRecord,
  options: PipelineOptions,
  pipeline: PipelineStep[] = defaultPipeline
): FieldRenderContext {
  let ctx = createFieldContext(field, value, record, options);

  for (const step of pipeline) {
    ctx = step(ctx);
    // Short-circuit if field is not visible (no need to continue)
    if (!ctx.isVisible) break;
  }

  return ctx;
}
