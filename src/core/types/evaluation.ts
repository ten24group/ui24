/**
 * Evaluation types for universal visibility/enablement system
 * 
 * These types are imported from backend (fw24) types for consistency.
 * Frontend adds evaluation context and result types.
 */

/**
 * Template reference for dynamic value resolution.
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type TemplateRef = {
  readonly $ref: string;
};

/**
 * Evaluation rule for visibility conditions.
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type EvaluationRule<T = any> = {
  readonly eq?: T | TemplateRef;
  readonly neq?: T | TemplateRef;
  readonly gt?: T | TemplateRef;
  readonly gte?: T | TemplateRef;
  readonly lt?: T | TemplateRef;
  readonly lte?: T | TemplateRef;
  readonly inList?: ReadonlyArray<T>;
  readonly notInList?: ReadonlyArray<T>;
  readonly custom?: string;
  readonly pattern?: string;
  readonly exists?: boolean;
  readonly empty?: boolean;
};

/**
 * Inline visibility condition (full structure).
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type InlineVisibilityCondition = {
  readonly actor?: {
    readonly [ path: string ]: EvaluationRule;
  };
  readonly record?: {
    readonly [ path: string ]: EvaluationRule;
  };
  readonly selectedRecords?: {
    readonly length?: EvaluationRule<number>;
    readonly all?: {
      readonly [ path: string ]: EvaluationRule;
    };
    readonly some?: {
      readonly [ path: string ]: EvaluationRule;
    };
    readonly none?: {
      readonly [ path: string ]: EvaluationRule;
    };
  };
  readonly queryParams?: {
    readonly [ key: string ]: EvaluationRule;
  };
  readonly context?: {
    readonly pageType?: EvaluationRule<'list' | 'view' | 'edit' | 'create'>;
    readonly modalDepth?: EvaluationRule<number>;
    readonly entityName?: EvaluationRule<string>;
    readonly [ key: string ]: EvaluationRule | undefined;
  };
  readonly formValues?: {
    readonly [ path: string ]: EvaluationRule;
  };
};

/**
 * Custom evaluator reference.
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type CustomVisibilityCondition = {
  readonly custom: string;
};

/**
 * Named conditions with scope.
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type NamedVisibilityCondition = {
  readonly conditions: ReadonlyArray<string>;
  readonly scope?: 'all' | 'any' | 'none';
};

/**
 * Shortcut visibility config for common cases.
 * Matches backend type from fw24/src/entity/base-entity.ts
 */
export type ShortcutVisibilityCondition = {
  readonly requiredRoles?: ReadonlyArray<string>;
  readonly excludedRoles?: ReadonlyArray<string>;
  readonly showWhen?: Record<string, any>;
  readonly hideWhen?: Record<string, any>;
};

/**
 * Visibility configuration (union type).
 * Matches backend type from fw24/src/entity/base-entity.ts
 * 
 * FIXED: Allow configs to have BOTH shortcut AND inline conditions
 */
export type VisibilityConfig = 
  | InlineVisibilityCondition
  | CustomVisibilityCondition
  | NamedVisibilityCondition
  | ShortcutVisibilityCondition
  | (InlineVisibilityCondition & ShortcutVisibilityCondition);

/**
 * Evaluation context for frontend evaluation.
 * Contains all data available for condition evaluation.
 */
export interface EvaluationContext {
  /**
   * Current actor (user) information from auth context
   */
  actor: {
    actorId?: string;
    cognito?: {
      groups?: string[];
      username?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  
  /**
   * Current record data (for row actions, view/edit pages)
   */
  record?: Record<string, any>;
  
  /**
   * Selected records (for bulk actions)
   */
  selectedRecords?: Array<Record<string, any>>;
  
  /**
   * Query parameters from URL
   */
  queryParams?: Record<string, any>;
  
  /**
   * Current page type
   */
  pageType?: 'list' | 'details' | 'form' | 'accordion' |  'dashboard' | 'system' | 'custom';
  
  /**
   * Current entity name
   */
  entityName?: string;
  
  /**
   * Modal nesting depth
   */
  modalDepth?: number;
  
  /**
   * Form values (for form button conditions)
   */
  formValues?: Record<string, any>;
  
  /**
   * Additional context properties
   */
  [key: string]: any;
}

/**
 * Result of evaluation
 */
export interface EvaluationResult {
  /**
   * Whether element should be visible
   */
  visible: boolean;
  
  /**
   * Whether element should be enabled
   */
  enabled: boolean;
  
  /**
   * Message to show when disabled
   */
  disabledMessage?: string;
  
  /**
   * Loading state (for async evaluations)
   */
  loading?: boolean;
  
  /**
   * Error state (if evaluation failed)
   */
  error?: string;
  
  /**
   * Additional result properties
   */
  [key: string]: any;
}

/**
 * Custom evaluator function type.
 * Can be synchronous or asynchronous.
 */
export type CustomEvaluatorFunction = (
  context: EvaluationContext
) => Promise<EvaluationResult> | EvaluationResult;

