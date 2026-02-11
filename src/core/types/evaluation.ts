/**
 * Evaluation types for the Unified Condition System.
 * 
 * Core types: Condition, InlineCondition, ConditionalValue<T>, EvaluationRule<T>
 * Context types: NewEvaluationContext, CustomConditionFn
 * 
 * Reference: CONDITION_SYSTEM_DESIGN.md
 */

// ════════════════════════════════════════════════════════════════════════════
// NEW CONDITION SYSTEM TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Template reference for dynamic value resolution from evaluation context.
 * Used in EvaluationRule comparisons to compare against runtime data.
 * 
 * @example
 * // Compare record.ownerId with the current user's actorId
 * { record: { ownerId: { eq: { $ref: 'actor.actorId' } } } }
 * 
 * // Compare record.assignedTeam with a subscription context value
 * { record: { assignedTeam: { eq: { $ref: 'subscription.teamId' } } } }
 */
export type TemplateRef = {
  readonly $ref: string;
};

/**
 * A single comparison rule. Operators are checked in definition order;
 * the first present operator wins.
 * 
 * When the actual value is an array (e.g., user groups), `inList` checks
 * if ANY element of the value array is in the list.
 * 
 * `between` is inclusive: value >= min && value <= max.
 * `contains` is case-insensitive substring match.
 */
export type EvaluationRule<T = any> = {
  // Comparison
  readonly eq?: T | TemplateRef;
  readonly neq?: T | TemplateRef;
  readonly gt?: T | TemplateRef;
  readonly gte?: T | TemplateRef;
  readonly lt?: T | TemplateRef;
  readonly lte?: T | TemplateRef;
  readonly between?: readonly [T | TemplateRef, T | TemplateRef];

  // Set membership
  readonly inList?: ReadonlyArray<T>;
  readonly notInList?: ReadonlyArray<T>;

  // Existence
  readonly exists?: boolean;   // value != null
  readonly empty?: boolean;    // value is null/undefined/''/[]

  // Pattern / String
  readonly pattern?: string;   // regex
  readonly contains?: string;  // simple substring match (case-insensitive)

};

/**
 * Inline condition — the main workhorse. Each field checks a category
 * of runtime data. All fields present are implicitly ANDed.
 * 
 * Known framework fields: actor, record, formValues, selectedRecords,
 * queryParams, context, featureFlags, device, tenant.
 * 
 * App-defined fields: any other key is looked up in EvaluationContext
 * and rules are evaluated against that data. This enables apps to add
 * subscription, permissions, preferences, network, experiments, etc.
 * without framework changes.
 */
export type InlineCondition = {
  // Tier 1: App-level (rarely changes)
  readonly actor?: { readonly [path: string]: EvaluationRule };
  readonly featureFlags?: { readonly [flag: string]: EvaluationRule<boolean | string> };
  readonly device?: {
    readonly isMobile?: EvaluationRule<boolean>;
    readonly isTablet?: EvaluationRule<boolean>;
    readonly isDesktop?: EvaluationRule<boolean>;
    readonly viewport?: EvaluationRule<'xs' | 'sm' | 'md' | 'lg' | 'xl'>;
  };
  readonly tenant?: { readonly [path: string]: EvaluationRule };

  // Tier 2: Page-level (changes on navigation)
  readonly context?: {
    readonly pageType?: EvaluationRule<string>;
    readonly modalDepth?: EvaluationRule<number>;
    readonly entityName?: EvaluationRule<string>;
    readonly [key: string]: EvaluationRule | undefined;
  };
  readonly queryParams?: { readonly [key: string]: EvaluationRule };

  // Tier 3-5: Dynamic (changes on interaction)
  readonly record?: { readonly [path: string]: EvaluationRule };
  readonly formValues?: { readonly [path: string]: EvaluationRule };
  readonly selectedRecords?: {
    readonly length?: EvaluationRule<number>;
    readonly all?: { readonly [path: string]: EvaluationRule };
    readonly some?: { readonly [path: string]: EvaluationRule };
    readonly none?: { readonly [path: string]: EvaluationRule };
  };

  // App-defined fields (extensible)
  // Any key not listed above is looked up in EvaluationContext.
  // Using `any` here because known fields have complex nested types
  // that TypeScript's index signature can't reconcile with a single union.
  readonly [key: string]: any;
};

/**
 * Condition — a boolean expression. The core type used everywhere
 * for visibility, enablement, expandability, etc.
 * 
 * The core boolean expression type for visibility, enablement, expandability, etc.
 */
export type Condition =
  | InlineCondition                            // field-level checks (implicit AND)
  | { readonly custom: string }                // registered async evaluator function
  | { readonly ref: string }                   // named/reusable condition reference
  | { readonly and: ReadonlyArray<Condition> }  // ALL must be true
  | { readonly or: ReadonlyArray<Condition> }   // ANY must be true
  | { readonly not: Condition }                // negate
  | boolean;                                   // literal true/false

// ════════════════════════════════════════════════════════════════════════════
// CONDITION TYPE GUARDS
// ════════════════════════════════════════════════════════════════════════════

/** Type guard: `{ and: Condition[] }` */
export function isAndCondition(c: Condition): c is { readonly and: ReadonlyArray<Condition> } {
  return typeof c === 'object' && c !== null && 'and' in c;
}

/** Type guard: `{ or: Condition[] }` */
export function isOrCondition(c: Condition): c is { readonly or: ReadonlyArray<Condition> } {
  return typeof c === 'object' && c !== null && 'or' in c;
}

/** Type guard: `{ not: Condition }` — excludes InlineCondition with `notInList` */
export function isNotCondition(c: Condition): c is { readonly not: Condition } {
  return typeof c === 'object' && c !== null && 'not' in c && !('notInList' in c);
}

/** Type guard: `{ ref: string }` */
export function isRefCondition(c: Condition): c is { readonly ref: string } {
  return typeof c === 'object' && c !== null && 'ref' in c && typeof (c as { ref: unknown }).ref === 'string';
}

/** Type guard: `{ custom: string }` */
export function isCustomCondition(c: Condition): c is { readonly custom: string } {
  return typeof c === 'object' && c !== null && 'custom' in c && typeof (c as { custom: unknown }).custom === 'string';
}

// ════════════════════════════════════════════════════════════════════════════
// CONDITIONAL VALUE
// ════════════════════════════════════════════════════════════════════════════

/**
 * A non-boolean conditional value. Evaluates a list of rules and returns
 * the value from the first matching rule, or the default.
 * 
 * Used for: renderer names, labels, placeholders, pageType, className, etc.
 * 
 * @example
 * // Resolve field renderer based on device
 * const renderer: ConditionalValue<string> = {
 *   rules: [
 *     { when: { device: { isMobile: { eq: true } } }, value: 'CompactEditor' },
 *     { when: { preferences: { experienceLevel: { eq: 'expert' } } }, value: 'AdvancedEditor' },
 *   ],
 *   default: 'StandardEditor',
 * };
 */
export type ConditionalValue<T> = {
  readonly rules: ReadonlyArray<{
    readonly when: Condition;
    readonly value: T;
  }>;
  readonly default: T;
};

/**
 * Type guard: is this value a ConditionalValue<T> or a plain T?
 * 
 * Performs a deep check: verifies `rules` is an array and its first
 * element (if any) has `when` and `value` properties.
 */
export function isConditionalValue<T>(value: T | ConditionalValue<T>): value is ConditionalValue<T> {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.rules)) return false;
  if (!('default' in candidate)) return false;
  // Deep check: first rule should have when + value
  if ((candidate.rules as unknown[]).length > 0) {
    const firstRule = (candidate.rules as unknown[])[0];
    return firstRule !== null && typeof firstRule === 'object' &&
      'when' in (firstRule as Record<string, unknown>) &&
      'value' in (firstRule as Record<string, unknown>);
  }
  return true; // empty rules array with a default is valid
}

/**
 * Extract a plain string from a value that may be `string | ConditionalValue<string>`.
 * If the value is a `ConditionalValue`, returns its `default` value.
 * If it's already a string, returns it directly.
 * If undefined/null, returns the fallback (defaults to '').
 * 
 * Use this in components that need a plain string from a config property
 * that may be a ConditionalValue. For proper condition-based resolution,
 * use `useResolve` or `useResolveBatch` hooks at the parent component level.
 */
export function resolveStringOrDefault(
  value: string | ConditionalValue<string> | undefined | null,
  fallback: string = ''
): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (isConditionalValue<string>(value)) return value.default;
  return fallback;
}

/**
 * Note: Template type for dynamic string resolution is defined in field-config.ts.
 * Use that Template type for disabledMessage and other dynamic strings.
 * Placeholders use {path} syntax, resolved via $ref-style path lookup.
 * 
 * @example
 * 'Upgrade from {subscription.tier} to unlock this feature'
 * 'Contact {record.lockedBy} to edit this record'
 */

// ════════════════════════════════════════════════════════════════════════════
// NEW EVALUATION CONTEXT TYPE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Complete evaluation context composed from all 5 tiers + app-defined providers.
 * This is the data available to all condition evaluations.
 */
export interface NewEvaluationContext {
  // Tier 1: App static (framework built-in)
  actor: {
    actorId: string;
    groups: string[];
    permissions?: string[];
    username?: string;
    email?: string;
    [key: string]: any;
  };
  featureFlags: Record<string, boolean | string>;
  tenant?: { tenantId: string; name: string; [key: string]: any };
  device: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    viewport: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };

  // Tier 2: Page static
  pageType?: string;
  entityName?: string;
  route?: { params: Record<string, any>; queryParams: Record<string, any> };
  modal?: { depth: number; isModal: boolean };
  queryParams?: Record<string, any>;
  modalDepth?: number;

  // Tier 3: Form state
  record?: Record<string, any>;
  formValues?: Record<string, any>;
  isDirty?: boolean;
  isValid?: boolean;

  // Tier 4: Table state
  selectedRecords?: Array<Record<string, any>>;
  filters?: Record<string, any>;
  searchQuery?: string;

  // App-defined context (from contextProviders)
  [key: string]: any;
}

/**
 * New custom evaluator function type.
 * Returns boolean (not EvaluationResult). Can be async.
 */
export type CustomConditionFn = (
  context: NewEvaluationContext
) => boolean | Promise<boolean>;

