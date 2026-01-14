/**
 * @fileoverview Extension Registry Type Definitions
 * 
 * Type system for the UI24 extensibility framework.
 * All types are strict with readonly modifiers.
 */

import type { ComponentType } from 'react';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Route parameters - URL params and dynamic values.
 */
export interface RouteParams {
  readonly [ key: string ]: string | number | undefined;
}

/**
 * User context for role-based resolution.
 */
export interface UserContext {
  readonly id: string;
  readonly roles: ReadonlyArray<string>;
  readonly permissions?: ReadonlyArray<string>;
}

/**
 * Feature flags for conditional resolution.
 */
export interface FeatureFlags {
  readonly [ key: string ]: boolean;
}

/**
 * Complete context available during resolution.
 */
export interface ResolverContext {
  readonly entityName?: string;
  readonly pageType?: string;
  readonly fieldName?: string;
  readonly fieldType?: string;
  readonly user?: Readonly<UserContext>;
  readonly featureFlags?: Readonly<FeatureFlags>;
  readonly routeParams: Readonly<RouteParams>;
  readonly parentData?: unknown;
  readonly depth: number;
}

// ============================================================================
// PAGE TYPES
// ============================================================================

/**
 * Standard page types that can be overridden per entity.
 */
export type OverridablePageType = 'list' | 'details' | 'form' | 'create';

/**
 * Props for page components.
 */
export interface PageComponentProps {
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
  readonly entityName?: string;
  readonly identifiers?: string | number;
  readonly pageConfig: Readonly<Record<string, unknown>>;
  readonly originalConfig?: Readonly<OriginalPageConfig>;
}

/**
 * Original page config shape (for entity override components).
 */
export interface OriginalPageConfig {
  readonly listPageConfig?: Readonly<{
    readonly entityName?: string;
    readonly [ key: string ]: unknown;
  }>;
  readonly detailsPageConfig?: Readonly<{
    readonly entityName?: string;
    readonly [ key: string ]: unknown;
  }>;
  readonly formPageConfig?: Readonly<{
    readonly entityName?: string;
    readonly [ key: string ]: unknown;
  }>;
}

// ============================================================================
// FIELD RENDERER TYPES
// ============================================================================

/**
 * Context for field rendering.
 */
export type FieldContext = 'form' | 'detail' | 'table';

/**
 * Base props for all field renderers.
 */
export interface BaseFieldRendererProps {
  readonly name: string;
  readonly fieldType: string;
  readonly value: unknown;
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
}

/**
 * Props for form field renderers.
 */
export interface FormFieldRendererProps extends BaseFieldRendererProps {
  readonly onChange: (value: unknown) => void;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<FieldOption>;
  readonly validationRules?: ReadonlyArray<ValidationRule>;
  readonly config: Readonly<FormFieldConfig>;
}

/**
 * Props for detail field renderers.
 */
export interface DetailFieldRendererProps extends BaseFieldRendererProps {
  readonly label?: string;
  readonly config: Readonly<DetailFieldConfig>;
}

/**
 * Props for table column renderers.
 */
export interface ColumnRendererProps {
  readonly value: unknown;
  readonly record: Readonly<Record<string, unknown>>;
  readonly column: Readonly<ColumnConfig>;
  readonly rowIndex: number;
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
}

/**
 * Field option for select/radio/checkbox fields.
 */
export interface FieldOption {
  readonly label: string;
  readonly value: string | number | boolean;
  readonly disabled?: boolean;
}

/**
 * Validation rule configuration.
 */
export interface ValidationRule {
  readonly required?: boolean;
  readonly pattern?: string;
  readonly min?: number;
  readonly max?: number;
  readonly message?: string;
}

/**
 * Form field configuration.
 */
export interface FormFieldConfig {
  readonly name: string;
  readonly fieldType: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly rendererConfig?: Readonly<Record<string, unknown>>;
  readonly [ key: string ]: unknown;
}

/**
 * Detail field configuration.
 */
export interface DetailFieldConfig {
  readonly name?: string;
  readonly fieldType?: string;
  readonly label?: string;
  readonly [ key: string ]: unknown;
}

/**
 * Column configuration.
 */
export interface ColumnConfig {
  readonly name: string;
  readonly dataIndex: string;
  readonly fieldType?: string;
  readonly template?: string | TemplateConfig;
  readonly renderer?: string;
  readonly [ key: string ]: unknown;
}

/**
 * Template configuration.
 */
export interface TemplateConfig {
  readonly template: string;
  readonly composite?: ReadonlyArray<string>;
}

// ============================================================================
// WIDGET TYPES
// ============================================================================

/**
 * Time period configuration for widgets.
 */
export interface TimePeriod {
  readonly start?: string;
  readonly end?: string;
  readonly preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
}

/**
 * Props for widget renderers.
 */
export interface WidgetRendererProps {
  readonly widget: Readonly<WidgetConfig>;
  readonly data?: unknown;
  readonly isLoading?: boolean;
  readonly timePeriod?: Readonly<TimePeriod>;
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
}

/**
 * Widget configuration.
 */
export interface WidgetConfig {
  readonly type: string;
  readonly title?: string;
  readonly [ key: string ]: unknown;
}

// ============================================================================
// REGISTRATION CONFIG TYPES
// ============================================================================

/**
 * Page type registration configuration.
 */
export interface PageTypeRegistrationConfig {
  readonly key: string;
  readonly component: ComponentType<PageComponentProps>;
  readonly description?: string;
}

/**
 * Entity page override registration configuration.
 */
export interface EntityPageRegistrationConfig {
  readonly entity: string;
  readonly pageType: OverridablePageType;
  readonly component: ComponentType<PageComponentProps>;
  readonly description?: string;
}

/**
 * Field renderer registration configuration.
 */
export interface FieldRendererRegistrationConfig {
  readonly key: string;
  readonly contexts: ReadonlyArray<FieldContext>;
  readonly component: ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>;
  readonly description?: string;
}

/**
 * Field type override registration configuration.
 */
export interface FieldTypeOverrideConfig {
  readonly fieldType: string;
  readonly context: FieldContext | 'all';
  readonly component: ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>;
  readonly description?: string;
}

/**
 * Entity field override registration configuration.
 */
export interface EntityFieldRegistrationConfig {
  readonly entity: string;
  readonly field: string;
  readonly context: FieldContext | 'all';
  readonly component: ComponentType<FormFieldRendererProps | DetailFieldRendererProps | ColumnRendererProps>;
  readonly description?: string;
}

/**
 * Widget registration configuration.
 */
export interface WidgetRegistrationConfig {
  readonly key: string;
  readonly component: ComponentType<WidgetRendererProps>;
  readonly description?: string;
}

/**
 * Widget type override configuration.
 */
export interface WidgetTypeOverrideConfig {
  readonly widgetType: string;
  readonly component: ComponentType<WidgetRendererProps>;
  readonly description?: string;
}

// ============================================================================
// CONDITIONAL REGISTRATION
// ============================================================================

/**
 * Condition object for conditional registration.
 */
export interface RegistrationCondition {
  readonly entity?: string;
  readonly field?: string;
  readonly fieldType?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
}

/**
 * Condition function for complex conditions.
 */
export type ConditionFn = (context: Readonly<ResolverContext>) => boolean;

/**
 * Conditional registration configuration.
 */
export interface ConditionalRegistrationConfig<C extends ComponentType<unknown>> {
  readonly condition: RegistrationCondition | ConditionFn;
  readonly key: string;
  readonly component: C;
  readonly description?: string;
}

// ============================================================================
// REGISTRY INFO TYPES
// ============================================================================

/**
 * Registration info for listing.
 */
export interface RegistrationInfo {
  readonly key: string;
  readonly type: 'page' | 'field' | 'widget' | 'entityOverride' | 'conditional' | 'component';
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Category for filtering registrations.
 */
export type RegistrationCategory =
  | 'page'
  | 'field'
  | 'widget'
  | 'entityOverride'
  | 'conditional'
  | 'component';
