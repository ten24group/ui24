import { ComponentType } from 'react';
import { ExtensionRegistry } from './ExtensionRegistry';
import { buildResolverContext } from './useResolverContext';
import type {
  FormFieldRendererProps,
  DetailFieldRendererProps,
  ColumnRendererProps,
  WidgetRendererProps,
  ValidationRule,
  FieldOption,
  ResolverContext
} from './types';

/**
 * Get a custom field renderer from the registry.
 * 
 * This is NOT a hook - it's a synchronous registry lookup.
 * Safe to call inside loops, conditions, etc.
 */
export function getFieldRenderer(
  fieldType: string,
  context: 'form' | 'detail',
  options: {
    fieldName?: string;
    entityName?: string;
    explicitRenderer?: string;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
  }
): ComponentType<FormFieldRendererProps> | ComponentType<DetailFieldRendererProps> | null {
  const resolverContext = buildResolverContext({
    fieldName: options.fieldName,
    fieldType,
    entityName: options.entityName,
    routeParams: options.routeParams,
    depth: 0
  });

  const renderer = ExtensionRegistry.getFieldRenderer(fieldType, context, {
    ...resolverContext,
    explicitRenderer: options.explicitRenderer
  });

  // Cast away ColumnRendererProps since we know context is 'form' or 'detail'
  return renderer as ComponentType<FormFieldRendererProps> | ComponentType<DetailFieldRendererProps> | null;
}

/**
 * Build props for a form field renderer.
 */
export function buildFormFieldProps(
  fieldType: string,
  options: {
    fieldName: string;
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
    disabled?: boolean;
    placeholder?: string;
    label?: string;
    fieldOptions?: ReadonlyArray<FieldOption>;
    validationRules?: ReadonlyArray<ValidationRule>;
    config: unknown;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
  }
): FormFieldRendererProps {
  return {
    routeParams: options.routeParams || {},
    depth: 0,
    name: options.fieldName,
    fieldType,
    value: options.value,
    onChange: options.onChange,
    onBlur: options.onBlur,
    disabled: options.disabled,
    placeholder: options.placeholder,
    options: options.fieldOptions,
    validationRules: options.validationRules,
    config: options.config as FormFieldRendererProps[ 'config' ]
  };
}

/**
 * Build props for a detail field renderer.
 */
export function buildDetailFieldProps(
  fieldType: string,
  options: {
    fieldName: string;
    value: unknown;
    label?: string;
    config: unknown;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
  }
): DetailFieldRendererProps {
  return {
    routeParams: options.routeParams || {},
    depth: 0,
    name: options.fieldName,
    fieldType,
    value: options.value,
    label: options.label,
    config: options.config as DetailFieldRendererProps[ 'config' ]
  };
}

/**
 * Get a custom column renderer from the registry.
 * 
 * This is NOT a hook - it's a synchronous registry lookup.
 * Safe to call inside loops, conditions, etc.
 */
export function getColumnRenderer(
  fieldType: string,
  options: {
    fieldName?: string;
    entityName?: string;
    explicitRenderer?: string;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
  }
): {
  Component: ComponentType<ColumnRendererProps> | null;
  resolverContext: ResolverContext;
} {
  const resolverContext = buildResolverContext({
    fieldName: options.fieldName,
    fieldType,
    entityName: options.entityName,
    routeParams: options.routeParams,
    depth: 0
  });

  const Component = ExtensionRegistry.getFieldRenderer(fieldType, 'table', {
    ...resolverContext,
    explicitRenderer: options.explicitRenderer
  }) as ComponentType<ColumnRendererProps> | null;

  return { Component, resolverContext };
}

/**
 * Get a custom widget renderer from the registry.
 * 
 * This is NOT a hook - it's a synchronous registry lookup.
 * Safe to call inside loops, conditions, etc.
 */
export function getWidgetRenderer(
  widgetType: string,
  options: {
    widget: unknown;
    timePeriod?: unknown;
    data?: unknown;
    isLoading?: boolean;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
  }
): {
  Component: ComponentType<WidgetRendererProps> | null;
  props: WidgetRendererProps | null;
} {
  const resolverContext = buildResolverContext({
    routeParams: options.routeParams,
    depth: 0
  });

  const Component = ExtensionRegistry.getWidgetRenderer(widgetType);

  if (!Component) {
    return { Component: null, props: null };
  }

  const props: WidgetRendererProps = {
    widget: options.widget as WidgetRendererProps[ 'widget' ],
    timePeriod: options.timePeriod as WidgetRendererProps[ 'timePeriod' ],
    routeParams: resolverContext.routeParams,
    depth: resolverContext.depth,
    data: options.data,
    isLoading: options.isLoading
  };

  return { Component, props };
}

// ============================================================================
// DEPRECATED: Hook versions (kept for backward compat but should NOT be used in loops)
// ============================================================================

import { useMemo } from 'react';
import { useResolverContext } from './useResolverContext';

/**
 * @deprecated Use getFieldRenderer() instead if calling inside a loop
 * 
 * Hook to resolve a custom field renderer.
 * WARNING: Do NOT call this inside .map() or other loops!
 */
export function useFieldRenderer(
  fieldType: string,
  context: 'form' | 'detail',
  options: {
    fieldName?: string;
    label?: string;
    explicitRenderer?: string;
    value?: unknown;
    onChange?: (value: unknown) => void;
    onBlur?: () => void;
    disabled?: boolean;
    placeholder?: string;
    fieldOptions?: ReadonlyArray<FieldOption>;
    validationRules?: ReadonlyArray<ValidationRule>;
    config?: unknown;
  }
) {
  const resolverContext = useResolverContext({
    fieldName: options.fieldName,
    fieldType,
    depth: 0
  });

  const Renderer = useMemo(() => {
    return ExtensionRegistry.getFieldRenderer(fieldType, context, {
      ...resolverContext,
      explicitRenderer: options.explicitRenderer
    });
  }, [ fieldType, context, resolverContext, options.explicitRenderer ]);

  const props = useMemo(() => {
    if (!Renderer) return null;

    const baseProps = {
      routeParams: resolverContext.routeParams,
      depth: resolverContext.depth,
      name: options.fieldName || '',
      fieldType,
      value: options.value,
      label: options.label,
      config: options.config || {}
    };

    if (context === 'form') {
      return {
        ...baseProps,
        onChange: options.onChange!,
        onBlur: options.onBlur,
        disabled: options.disabled,
        placeholder: options.placeholder,
        options: options.fieldOptions,
        validationRules: options.validationRules
      } as FormFieldRendererProps;
    }

    return baseProps as DetailFieldRendererProps;
  }, [ Renderer, resolverContext, fieldType, context, options ]);

  return { Component: Renderer, props };
}

/**
 * @deprecated Use getWidgetRenderer() instead
 */
export function useWidgetRenderer(
  widgetType: string,
  widgetProps: {
    widget: unknown;
    timePeriod?: unknown;
    routeParams?: Readonly<Record<string, string | number | undefined>>;
    depth?: number;
    data?: unknown;
    isLoading?: boolean;
  }
) {
  const resolverContext = useResolverContext();

  const Renderer = useMemo(() => {
    return ExtensionRegistry.getWidgetRenderer(widgetType);
  }, [ widgetType ]);

  const props = useMemo(() => {
    if (!Renderer) return null;

    return {
      widget: widgetProps.widget,
      timePeriod: widgetProps.timePeriod,
      routeParams: resolverContext.routeParams,
      depth: resolverContext.depth,
      data: widgetProps.data,
      isLoading: widgetProps.isLoading
    } as WidgetRendererProps;
  }, [ Renderer, resolverContext, widgetProps ]);

  return { Component: Renderer, props };
}

/**
 * @deprecated Use getColumnRenderer() instead if calling inside a loop
 */
export function useColumnRenderer(
  fieldType: string,
  options: {
    readonly fieldName?: string;
    readonly explicitRenderer?: string;
    readonly column?: unknown;
  }
) {
  const resolverContext = useResolverContext({
    fieldName: options.fieldName,
    fieldType,
    depth: 0
  });

  const Renderer = useMemo(() => {
    return ExtensionRegistry.getFieldRenderer(fieldType, 'table', {
      ...resolverContext,
      explicitRenderer: options.explicitRenderer
    });
  }, [ fieldType, resolverContext, options.explicitRenderer ]);

  return { Component: Renderer as ComponentType<ColumnRendererProps> | null, resolverContext };
}
