/**
 * Extension Registry Module
 * 
 * Central extensibility system for UI24.
 */

export { ExtensionRegistry } from './ExtensionRegistry';
export { useResolverContext, buildResolverContext } from './useResolverContext';
export type { UseResolverContextOptions } from './useResolverContext';

// Non-hook functions (safe to call in loops)
export {
  getFieldRenderer,
  buildFormFieldProps,
  buildDetailFieldProps,
  getColumnRenderer,
  getWidgetRenderer
} from './hooks';

// Deprecated hook versions (kept for backward compat - do NOT use in loops)
export {
  useFieldRenderer,
  useWidgetRenderer,
  useColumnRenderer
} from './hooks';

// Re-export types
export type {
  // Context types
  ResolverContext,
  RouteParams,
  UserContext,
  FeatureFlags,

  // Page types
  OverridablePageType,
  PageComponentProps,
  OriginalPageConfig,

  // Field types
  FieldContext,
  BaseFieldRendererProps,
  FormFieldRendererProps,
  DetailFieldRendererProps,
  ColumnRendererProps,
  FieldOption,
  ValidationRule,
  FormFieldConfig,
  DetailFieldConfig,
  ColumnConfig,
  TemplateConfig,

  // Widget types
  TimePeriod,
  WidgetRendererProps,
  WidgetConfig,

  // Registration config types
  PageTypeRegistrationConfig,
  EntityPageRegistrationConfig,
  FieldRendererRegistrationConfig,
  FieldTypeOverrideConfig,
  EntityFieldRegistrationConfig,
  WidgetRegistrationConfig,
  WidgetTypeOverrideConfig,

  // Conditional types
  RegistrationCondition,
  ConditionFn,
  ConditionalRegistrationConfig,

  // Info types
  RegistrationInfo,
  RegistrationCategory,
} from './types';
