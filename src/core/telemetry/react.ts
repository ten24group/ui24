/**
 * React Integration Layer for Telemetry
 * 
 * Provides React hooks for common instrumentation patterns.
 * All hooks are no-ops in production for zero overhead.
 * 
 * Available Hooks:
 * - useModalInstrumentation: Modal lifecycle callbacks
 * - useModalContentSpan: Modal content active span management
 * - useNavigationSpan: Route navigation
 * - usePageSpan: Page lifecycle (Strict Mode aware)
 * - useSectionSpan: Section rendering with span stack
 * - useFormSubmitInstrumentation: Form submission wrapper
 */

import { useCallback } from 'react';
import { instrument } from './instrumentation';
import { IS_DEV } from '../constants';
import {
  useConditionalSpan,
  useLifecycleSpan,
  useStrictModePageSpan,
  useNavigationSpanInternal,
} from './react-internal';

// ============================================================================
// Modal Hooks
// ============================================================================

interface ModalCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  onSuccess?: (response: any) => void;
}

interface UseModalInstrumentationOptions extends ModalCallbacks {
  modalType: 'action' | 'route' | 'chain';
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Instruments modal lifecycle callbacks with automatic span creation.
 * Returns wrapped callbacks that log spans before calling the original callback.
 * 
 * @example
 * const instrumented = useModalInstrumentation({
 *   modalType: 'action',
 *   onCancel: props.onCancel,
 *   onConfirm: props.onConfirm,
 *   attributes: { 'modal.hasApi': !!apiConfig }
 * });
 * 
 * // Use instrumented callbacks
 * <Button onClick={instrumented.onConfirm}>Confirm</Button>
 */
export function useModalInstrumentation(options: UseModalInstrumentationOptions) {
  const { modalType, attributes, ...callbacks } = options;

  const wrap = useCallback(
    (eventName: string, callback?: (...args: any[]) => any, extraAttrs?: Record<string, string | number | boolean>) =>
      (...args: any[]) => {
        instrument.event(eventName, {
          'modal.type': modalType,
          ...attributes,
          ...extraAttrs,
        });
        callback?.(...args);
      },
    [modalType, attributes]
  );

  return {
    onOpen:    useCallback((...a: any[]) => wrap('modal.open',    callbacks.onOpen,    { 'span.level': 'info' })(...a), [wrap, callbacks.onOpen]),
    onClose:   useCallback((...a: any[]) => wrap('modal.close',   callbacks.onClose,   { 'modal.reason': 'close' })(...a), [wrap, callbacks.onClose]),
    onCancel:  useCallback((...a: any[]) => wrap('modal.close',   callbacks.onCancel,  { 'modal.reason': 'cancel' })(...a), [wrap, callbacks.onCancel]),
    onConfirm: useCallback((...a: any[]) => wrap('modal.close',   callbacks.onConfirm, { 'modal.reason': 'confirm' })(...a), [wrap, callbacks.onConfirm]),
    onSuccess: useCallback((...a: any[]) => wrap('modal.success', callbacks.onSuccess, { 'modal.reason': 'success' })(...a), [wrap, callbacks.onSuccess]),
  };
}

/**
 * Manages a modal content span that stays active while the modal is open.
 * Automatically pushes/pops from the span stack for proper hierarchy.
 * 
 * @example
 * useModalContentSpan({
 *   active: open && found,
 *   entityName: 'User',
 *   pageType: 'form',
 *   depth: 1
 * });
 */
export function useModalContentSpan(options: {
  active: boolean;
  entityName?: string;
  pageType?: string;
  depth?: number;
  attributes?: Record<string, any>;
}) {
  useConditionalSpan(
    options.active,
    {
      tracer: 'ui24.modal',
      spanName: `Modal: ${options.entityName || 'unknown'} (${options.pageType || 'unknown'})`,
      useActiveContext: true,
      attributes: {
        'span.type': 'modal.content',
        'modal.entity': options.entityName,
        'modal.pageType': options.pageType,
        'modal.depth': options.depth,
        ...options.attributes,
      },
    },
    [options.entityName, options.pageType, options.depth]
  );
}

// ============================================================================
// Navigation Hook
// ============================================================================

/**
 * Creates a navigation span tied to a route key.
 * Safely creates/ends spans in layout effects (no render-phase side effects).
 * 
 * @example
 * useNavigationSpan({
 *   route: '/users',
 *   pageKey: 'user-list',
 *   attributes: { 'navigation.pathname': location.pathname }
 * });
 */
export function useNavigationSpan(options: {
  route: string;
  pageKey: string;
  attributes?: Record<string, any>;
}) {
  useNavigationSpanInternal(options.pageKey, {
    tracer: 'ui24.navigation',
    spanName: `navigation.route: ${options.route}`,
    attributes: {
      'span.type': 'navigation.route',
      'navigation.route': options.route,
      'navigation.pageKey': options.pageKey,
      ...options.attributes,
    },
  });
}

// ============================================================================
// Page Hook
// ============================================================================

/**
 * Creates a page span that survives React Strict Mode double-mount.
 * Uses ref-based tracking to ensure span is created once per unique page.
 * 
 * @example
 * usePageSpan({
 *   pageKey: 'user-detail',
 *   spanName: 'page.detail: User',
 *   attributes: { 'page.type': 'detail', 'page.entity': 'User' }
 * });
 */
export function usePageSpan(options: {
  pageKey: string;
  spanName: string;
  attributes?: Record<string, any>;
}) {
  useStrictModePageSpan(options.pageKey, {
    tracer: 'ui24.page',
    spanName: options.spanName,
    attributes: {
      'span.type': 'page.mount',
      'page.key': options.pageKey,
      ...options.attributes,
    },
  });
}

// ============================================================================
// Section Hook
// ============================================================================

/**
 * Manages section rendering spans with automatic span stack management.
 * 
 * @example
 * useSectionSpan({
 *   active: shouldLoad && sectionKey !== '__main__',
 *   sectionKey: 'details',
 *   label: 'User Details',
 *   pageType: 'detail',
 *   depth: 1
 * });
 */
export function useSectionSpan(options: {
  active: boolean;
  sectionKey: string;
  label?: any;
  pageType?: string;
  depth: number;
}) {
  const sectionLabel = options.label || options.sectionKey;

  useConditionalSpan(
    options.active,
    {
      tracer: 'ui24.sections',
      spanName: `section.render: ${sectionLabel}`,
      attributes: {
        'span.type': 'section.render',
        'section.key': options.sectionKey,
        'section.label': sectionLabel,
        'section.pageType': options.pageType,
        'section.depth': options.depth,
        'span.level': 'debug',
      },
    },
    [options.sectionKey, options.label, options.pageType, options.depth]
  );
}

// ============================================================================
// Form Hook
// ============================================================================

/**
 * Instruments form submission with span creation.
 * 
 * @example
 * const { instrumentSubmit } = useFormSubmitInstrumentation({
 *   entity: 'User',
 *   fieldCount: 10
 * });
 * 
 * const handleSubmit = async (values) => {
 *   return instrumentSubmit(async () => {
 *     const response = await saveToApi(values);
 *     return response;
 *   });
 * };
 */
export function useFormSubmitInstrumentation(options: {
  entity: string;
  fieldCount: number;
}) {
  const instrumentSubmit = useCallback(
    async <T,>(submitFn: () => Promise<T>): Promise<T> => {
      const handle = instrument.begin('form.submit', 'async', {
        'form.entity': options.entity,
        'form.fieldCount': options.fieldCount,
        'span.level': 'info',
      });

      try {
        const result = await submitFn();
        handle.setAttribute('form.success', true);
        handle.end();
        return result;
      } catch (error) {
        handle.setAttribute('form.error', true);
        handle.setAttribute('error', true);
        handle.end();
        throw error;
      }
    },
    [options.entity, options.fieldCount]
  );

  return { instrumentSubmit };
}

// ============================================================================
// Generic Component Hook
// ============================================================================

/**
 * Generic component lifecycle span hook.
 * 
 * @example
 * const { updateSpan } = useComponentSpan({
 *   name: 'form.UserForm',
 *   type: 'form',
 *   attributes: { 'entity.name': 'User' }
 * });
 */
export function useComponentSpan(options: {
  name: string;
  type: string;
  attributes?: Record<string, any>;
  enabled?: boolean;
}) {
  const spanRef = useLifecycleSpan(
    {
      tracer: 'ui24.core',
      spanName: options.name,
      enabled: options.enabled,
      attributes: {
        'span.type': options.type,
        ...options.attributes,
      },
    },
    [options.name, options.type, options.enabled]
  );

  const updateSpan = useCallback((attrs: Record<string, any>) => {
    if (spanRef.current && IS_DEV) {
      for (const [key, value] of Object.entries(attrs)) {
        spanRef.current.setAttribute(key, value);
      }
    }
  }, []);

  return { updateSpan };
}
