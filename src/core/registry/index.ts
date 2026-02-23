/**
 * Extension Registry Module
 * 
 * Central extensibility system for UI24.
 * 
 * Resolution order for field renderers:
 * 1. ExtensionRegistry — custom renderers (explicit, conditional, entity-field, field-type override, custom)
 * 2. FieldTypeRegistry — built-in renderers (registered from field-types/ files at startup)
 * 3. Consumer fallback (e.g. default text input)
 */

export { ExtensionRegistry } from './ExtensionRegistry';
export { fieldTypeRegistry, type FieldTypeRegistration } from './FieldTypeRegistry';
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

// Condition-aware hooks
export { useFieldRendererWithConditions } from './hooks';

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
  ActorContext,
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
  ConditionFn,
  ConditionalRegistrationConfig,

  // Info types
  RegistrationInfo,
  RegistrationCategory,
} from './types';

// Built-in field type registry types
export type {
  BuiltInFormFieldProps,
  BuiltInDetailFieldProps,
  BuiltInTableFieldProps,
} from './field-types/types';

// Ensure built-in registrations run on import
export { registerBuiltInFieldTypes } from './field-types';
