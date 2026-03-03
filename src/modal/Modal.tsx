/**
 * Modal.tsx
 * 
 * ==========================================
 * ACTION-ORIENTED MODAL COMPONENT
 * ==========================================
 * 
 * PURPOSE: Perform actions and operations with API integration
 * 
 * USE THIS WHEN:
 * - Confirmation dialogs (delete, approve, reject)
 * - Forms that submit to API (create, update, delete)
 * - Navigation-only forms (filter form → navigate with query params)
 * - Bulk operations with response display
 * - Need API integration, loading states, success/error handling
 * 
 * USE OpenRouteInModal.tsx INSTEAD WHEN:
 * - Viewing entity details without actions
 * - Browsing related lists
 * - Opening routes from entities.json
 * - Need overrideConfig support (defaultFilters, hideFields)
 * 
 * ==========================================
 */

import { Modal as AntModal, Drawer as AntDrawer } from 'antd';
import { ChainModalContent } from './ChainModal';
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { ErrorFallback, Link } from '../core/common';
import { IApiConfig, ModalContextProvider, useApi } from '../core/context';
import { useAppContext } from '../core/context/AppContext';
import { IForm } from '../core/forms/formConfig';
import { Template } from '../core/types';
import type { Condition, ConditionalValue } from '../core/types/evaluation';
import { evaluateTemplateObject, getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError } from '../core/utils/api-error-handler';
import { evaluateTemplateValue } from '../core/utils/template';
import type { IDetailsConfig } from '../core/types/field-config';
import { IAccordionPageConfig } from '../pages/PostAuth/Accordion/Accordion';
import { IDashboardPageConfig } from '../pages/PostAuth/DashboardPage';
import { IPageType, RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { useCoreNavigator } from '../routes/Navigation';
import { ITableConfig } from '../table/type';
import { getDefaultModalWidth } from './modalUtils';
import { useOperationExecutor } from '../core/services/OperationExecutor';
import { type IWizardPageConfig } from '../core/common/FormWizard';
import { useThrottleCountdown } from '../core/hooks/useThrottleCountdown';
import { useModalInstrumentation } from '../core/telemetry';

// Simple modal depth tracking for stack effect
export const ModalDepthContext = React.createContext(0);
export const useModalDepth = () => React.useContext(ModalDepthContext);

interface IConfirmModal {
  /**
   * Modal title - can be static string or dynamic template.
   * 
   * @example title: "Delete Team?"
   * @example title: "Delete {teamName}?"
   */
  title: Template;

  /**
   * Modal content - can be static string or dynamic template.
   * 
   * @example content: "Are you sure?"
   * @example content: "Delete {teamName}? This will affect {playerCount} players."
   */
  content?: Template;
}
type IModalType = "confirm" | "list" | "form" | "custom" | "details" | "accordion" | "dashboard" | "wizard" | "chain" | "info";

/** Single step in a chain modal flow (#67) */
export interface IChainStep {
  id: string;
  title: string;
  type: IModalType;
  pageConfig?: IConfirmModal | IForm | ITableConfig | IDetailsConfig | IAccordionPageConfig | IDashboardPageConfig;
  /** Static next step ID */
  nextStep?: string;
  /** Conditional next step resolution */
  conditionalNextStep?: Array<{ when: Condition; step: string }>;
  /** API config for this specific step (optional, falls back to modal-level apiConfig) */
  apiConfig?: IApiConfig;
}

/** Configuration for chain modal flows (#67) */
export interface IChainConfig {
  steps: IChainStep[];
  showProgressBar?: boolean;
  /** 'modal' or 'drawer' container */
  containerType?: 'modal' | 'drawer';
}

type IModalPageConfig = IConfirmModal | IForm | ITableConfig | IDetailsConfig | IAccordionPageConfig | IDashboardPageConfig | IWizardPageConfig | IChainConfig;

/**
 * Navigation configuration for modal form submissions
 * Used for navigation-only modals (no API call)
 */
export interface INavigateToConfig {
  routePattern: string;
  useFormValues?: boolean;
  queryParamMapping?: Record<string, string>;
  routeParamMapping?: Record<string, string>;
  useLargeParamStorage?: boolean;
  dateFormat?: 'ISO' | 'unix' | 'YYYY-MM-DD';
  arrayValuePath?: string;
  replace?: boolean;
  inverseMapping?: boolean;
}

/**
 * Configuration for displaying API response in a modal
 * Reuses the existing page rendering system (details, list, dashboard, etc.)
 * 
 * Use Cases:
 * - Bulk operations: Show results breakdown (created/updated/failed counts)
 * - Report generation: Show summary with download links
 * - Test/validation: Show operation results, warnings, API responses
 * 
 * Note: This type is also defined in backend (fw24/src/entity/base-entity.ts) for entity schemas.
 * Keep these in sync manually, or consolidate in future if shared types package is created.
 */
export interface IResponseDisplayConfig {
  /** Whether to show response in a modal. If false, only toast notification shows. Default: false */
  showModal?: boolean;

  /** Title for response modal. If not provided, appends " - Results" to action modal title */
  modalTitle?: string;

  /** Width of response modal in pixels. Default: 707 */
  modalWidth?: number;

  /** OPTION 1: Render response using existing page type system (recommended) */
  pageType?: 'form' | 'details' | 'list' | 'dashboard' | 'accordion';
  pageConfig?: Record<string, any>;

  /** OPTION 2: Show raw JSON response (useful for debugging/testing) */
  showRawJson?: boolean;

  /** Path to extract data from response. Default: uses response root
   * Example: "data.results" will use response.data.results as the data source
   */
  dataPath?: string;
}

export interface IModalConfig {
  modalType: IModalType;
  modalPageConfig?: IModalPageConfig;
  children?: React.ReactNode | React.ReactNode[];
  button?: React.ReactNode;

  /** EITHER: Make API call (existing pattern) */
  apiConfig?: IApiConfig;
  /** Redirect URL after success. Supports ConditionalValue for condition-based routing. */
  submitSuccessRedirect?: string | ConditionalValue<string>;
  /**
   * Navigation options for submitSuccessRedirect
   * Uses react-router-dom's NavigateOptions: { replace?: boolean; state?: unknown; }
   */
  submitSuccessRedirectOptions?: {
    replace?: boolean;
    state?: unknown;
  };

  /** OR: Navigate without API call (new pattern) */
  navigateTo?: INavigateToConfig | string;

  /** OPTIONAL: Display API response in modal (instead of just toast) */
  responseConfig?: IResponseDisplayConfig;

  /** Dynamic config for chaining operations */
  dynamicConfigKey?: string;

  /** Skip toast notifications */
  skipSuccessToast?: boolean;
  skipErrorToast?: boolean;

  /** Control modal behavior on error */
  closeModalOnError?: boolean;

  /**
   * Pre-populate form fields from context (route params + record data).
   * Values are evaluated when modal opens. Supports:
   * - Static values: `{ isActive: true, priority: 1 }`
   * - Template strings: `{ teamId: '{teamId}', sport: '{sport}' }`
   * - Nested paths: `{ teamName: '{team.name}' }`
   */
  initialValues?: Record<string, any>;

  /**
   * If true, parent component will be refreshed after successful operation.
   * Triggers onSuccessCallback with API response data.
   * @default false
   */
  refreshParentOnSuccess?: boolean;

  /**
   * Custom success message template. If not provided, uses default message from API response.
   * Can be a static string or a dynamic template.
   * 
   * @example successMessage: "Operation successful"
   * @example successMessage: "{teamName} deleted successfully"
   * @example successMessage: { composite: ['teamName', 'playerCount'], template: '{teamName} deleted ({playerCount} players affected)' }
   */
  successMessage?: Template;

  /**
   * Custom error message template. If not provided, uses error messages from API response.
   * Can be a static string or a dynamic template.
   * 
   * @example errorMessage: "Operation failed"
   * @example errorMessage: "Failed to delete {teamName}"
   * @example errorMessage: { composite: ['teamName', 'reason'], template: 'Failed to delete {teamName}: {reason}' }
   */
  errorMessage?: Template;

  /** Config-driven notification control. Overrides successMessage/errorMessage when provided. */
  notification?: {
    success?: { message?: Template; description?: Template; type?: 'message' | 'notification'; duration?: number; };
    error?: { message?: Template; description?: Template; type?: 'message' | 'notification'; duration?: number; };
    skip?: boolean | 'success' | 'error';
  };

  /** Action throttling — cooldown period after execution */
  throttle?: {
    cooldownMs?: number;
    showCountdown?: boolean;
  };

  primaryIndex?: string;
  useDynamicIdFromParams?: boolean;
  onSuccessCallback?: (response?: any) => void;
  onConfirmCallback?: () => void;
  onCancelCallback?: () => void;
  onOpenCallback?: () => void;
  routeParams?: Record<string, string>;
  identifiers?: string | number;  // For detail modals - the entity ID to fetch

  /** Modal width in pixels or CSS string (e.g., "80%"). Default: auto-detect from page type */
  modalWidth?: number | string;

  /**
   * Modal title - can be static string or dynamic template.
   * Evaluated from routeParams when modal opens.
   * If not provided, uses page title from config.
   * 
   * @example modalTitle: "Edit Team"
   * @example modalTitle: "Edit {teamName}"
   * @example modalTitle: { composite: ['teamName', 'city'], template: 'Edit {teamName} ({city})' }
   */
  modalTitle?: Template;

  /**
   * Render the modal content inside a right-side drawer instead of a centred
   * overlay.  Only applies to `modalType: 'form'`.  All other types continue
   * to use the centred modal container regardless of this setting.
   *
   * Primarily used by the `#44 quickCreate` feature
   * (`quickCreate: { openIn: 'drawer' }`).
   *
   * @default 'modal'
   */
  containerType?: 'modal' | 'drawer';
}

/**
 * Smart serialization for form values to query params
 * Handles arrays, objects, dates, booleans
 */
const serializeValue = (value: any, dateFormat: 'ISO' | 'unix' | 'YYYY-MM-DD' = 'ISO', arrayValuePath?: string): string => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  // Handle Moment objects (check for isValid method)
  if (value && typeof value === 'object' && typeof value.isValid === 'function' && value.isValid()) {
    const jsDate = value.toDate();  // Convert moment to JS Date
    switch (dateFormat) {
      case 'unix':
        return String(jsDate.getTime());
      case 'YYYY-MM-DD':
        return jsDate.toISOString().split('T')[ 0 ];
      default:
        return jsDate.toISOString();
    }
  }

  // Handle Date objects
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))) {
    const date = new Date(value);
    switch (dateFormat) {
      case 'unix':
        return String(date.getTime());
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[ 0 ];
      default:
        return date.toISOString();
    }
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '';

    // If array of objects, extract specific field
    if (typeof value[ 0 ] === 'object' && value[ 0 ] !== null) {
      const extractField = arrayValuePath || 'id';
      return value.map(v => v[ extractField ] || JSON.stringify(v)).filter(Boolean).join(',');
    }

    // Array of primitives
    return value.join(',');
  }

  // Handle Objects
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  // Handle Boolean
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Default: convert to string
  return String(value);
};

/**
 * Parse template-style navigateTo string
 * Example: "/list-game?status={status}&teamId={teamId}" → { routePattern, queryParamMapping }
 */
const parseNavigateToTemplate = (template: string): INavigateToConfig => {
  const [ routePattern, queryString ] = template.split('?');

  if (!queryString) {
    return { routePattern };
  }

  // Extract {param} placeholders from query string
  const queryParamMapping: Record<string, string> = {};
  const params = queryString.split('&');

  params.forEach(param => {
    const [ key, value ] = param.split('=');
    if (value && value.startsWith('{') && value.endsWith('}')) {
      const fieldPath = value.slice(1, -1); // Remove { and }
      queryParamMapping[ key ] = fieldPath;
    }
  });

  return { routePattern, queryParamMapping };
};

export const Modal = ({
  modalType,
  children,
  modalPageConfig,
  apiConfig,
  navigateTo,
  responseConfig,
  initialValues,
  successMessage,
  errorMessage,
  primaryIndex = "",
  onSuccessCallback,
  onCancelCallback,
  onConfirmCallback,
  submitSuccessRedirect,
  submitSuccessRedirectOptions,
  dynamicConfigKey,
  skipSuccessToast = false,
  skipErrorToast = false,
  closeModalOnError = false,
  notification,
  throttle,
  routeParams = {},
  identifiers,
  modalWidth,
  modalTitle,
  containerType = 'modal',
}: IModalConfig) => {

  const { notifyError, notifySuccess } = useAppContext()
  const { callApiMethod } = useApi();
  const navigate = useCoreNavigator();

  const location = useLocation();
  const [ loading, setLoading ] = React.useState(false);

  // Track modal depth for stack effect
  const currentDepth = useModalDepth();
  const nextDepth = currentDepth + 1;

  // ✅ NO response modal management - handled globally by OperationExecutor + ResponseModalContext
  const operationExecutor = useOperationExecutor();

  // AbortController for request cancellation on unmount
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount - abort any in-flight requests
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Validation: Warn if both navigateTo and responseConfig are specified (mutually exclusive)
  // IMPORTANT: Must be called before any conditional returns to satisfy Rules of Hooks
  React.useEffect(() => {
    if (navigateTo && responseConfig?.showModal) {
      console.warn(
        '[Modal] Both navigateTo and responseConfig.showModal are specified. ' +
        'navigateTo takes precedence. This might be a configuration error.'
      );
    }
  }, [ navigateTo, responseConfig ]);

  // Throttle countdown for confirm modal button (#64)
  const throttleOpKey = apiConfig?.apiUrl || undefined;
  const { isThrottled, buttonText: throttleText, startPolling } = useThrottleCountdown(
    operationExecutor,
    throttleOpKey,
    !!(throttle?.cooldownMs),
    !!(throttle?.showCountdown)
  );

  // ============================================================================
  // NEW: Using OperationExecutor for centralized operation handling
  // ============================================================================
  const confirmApiAction = async () => {
    const formattedApiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams, primaryIndex);

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    await operationExecutor.execute(
      {
        apiConfig: {
          ...apiConfig,
          apiUrl: formattedApiUrl
        },
        routeParams,
        onLoading: setLoading,
        successMessage,
        errorMessage,
        responseConfig,
        submitSuccessRedirect,
        submitSuccessRedirectOptions,
        dynamicConfigKey,
        skipSuccessToast,
        skipErrorToast,
        closeModalOnError,
        ...(notification && { notification }),
        ...(throttle && { throttle }),
        abortSignal: abortControllerRef.current.signal
      },
      {
        onSuccess: onSuccessCallback,
        onClose: onConfirmCallback
        // ✅ NO onChain needed - response modal handled globally
      }
    );

    // Start polling cooldown after execution completes (for countdown display)
    if (throttle?.showCountdown) startPolling();
  };


  // Handle navigation from form submission (without API call)
  const handleNavigationSubmit = (formValues: Record<string, any>) => {
    if (!navigateTo) return;

    // Parse navigateTo if it's a string template
    const navConfig: INavigateToConfig = typeof navigateTo === 'string'
      ? parseNavigateToTemplate(navigateTo)
      : navigateTo;

    let targetUrl = navConfig.routePattern;
    const queryParams: Record<string, string> = {};

    if (navConfig.useFormValues !== false) {
      // 1. Replace route params
      if (navConfig.routeParamMapping) {
        // Explicit mapping: :userId <- form.selectedUser
        const mappedParams: Record<string, any> = {};
        for (const [ routeParam, formPath ] of Object.entries(navConfig.routeParamMapping)) {
          const value = getNestedValue(formValues, formPath);
          if (value !== undefined) {
            mappedParams[ routeParam ] = value;
          }
        }
        targetUrl = substituteUrlParams(targetUrl, mappedParams);
      } else {
        // Auto-detect: :userId <- formValues.userId
        targetUrl = substituteUrlParams(targetUrl, formValues);
      }

      // 2. Parse existing query params from routePattern (Problem 5)
      const [ pathname, existingSearch ] = navConfig.routePattern.split('?');
      const existingParams = new URLSearchParams(existingSearch || '');

      // 3. Build new query params from form
      if (navConfig.queryParamMapping) {
        // Explicit mapping
        for (const [ queryKey, formPath ] of Object.entries(navConfig.queryParamMapping)) {
          const value = getNestedValue(formValues, formPath);
          if (value !== undefined && value !== null && value !== '') {
            queryParams[ queryKey ] = serializeValue(
              value,
              navConfig.dateFormat,
              navConfig.arrayValuePath
            );
          }
        }
      } else {
        // Default: all form values as query params (except those in route)
        const usedInRoute = targetUrl.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];
        Object.entries(formValues).forEach(([ key, value ]) => {
          if (!usedInRoute.includes(key) && value !== undefined && value !== null && value !== '') {
            queryParams[ key ] = serializeValue(
              value,
              navConfig.dateFormat,
              navConfig.arrayValuePath
            );
          }
        });
      }

      // 4. Merge existing and new query params (new overrides existing)
      const merged = new URLSearchParams(existingParams);
      Object.entries(queryParams).forEach(([ k, v ]) => {
        if (v) merged.set(k, v);
      });

      // 5. Handle large parameter sets (Problem 2)
      const queryString = merged.toString();
      let finalUrl = pathname;

      if (navConfig.useLargeParamStorage && queryString.length > 1500) {
        const filterKey = `f_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(filterKey, JSON.stringify(Object.fromEntries(merged.entries())));
        finalUrl = queryString ? `${pathname}?f=${filterKey}` : pathname;
      } else {
        finalUrl = queryString ? `${pathname}?${queryString}` : pathname;
      }

      // 6. Close modal and navigate
      onCancelCallback?.();
      setTimeout(() => {
        navigate(finalUrl, { replace: navConfig.replace });
        onSuccessCallback?.(formValues); // Pass form values as "response"
      }, 200); // Delay for smooth modal close
    }
  };

  // Helper: Set value at nested path (e.g., "filters.status" -> obj.filters.status)
  const setNestedValue = (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[ i ];
      if (!current[ key ] || typeof current[ key ] !== 'object') {
        current[ key ] = {};
      }
      current = current[ key ];
    }

    current[ keys[ keys.length - 1 ] ] = value;
  };

  // Helper: Deserialize value (detect arrays, booleans, dates, numbers)
  const deserializeValue = (value: string): any => {
    // Detect array: starts with [ and ends with ]
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string if parsing fails
      }
    }

    // Detect boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Detect number (including unix timestamps)
    if (/^\d+(\.\d+)?$/.test(value)) {
      const num = parseFloat(value);

      // If it's a large integer, might be unix timestamp
      if (Number.isInteger(num) && num > 1000000000 && num < 10000000000) {
        return new Date(num).toISOString();
      }

      return num;
    }

    // Detect ISO date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value; // Already in ISO format
    }

    return value;
  };

  // Helper: Pre-populate form from query params (Problem 6 - Edge Case 3)
  const getDefaultValuesFromQuery = (): Record<string, any> | undefined => {
    if (!navigateTo) return undefined;

    const navConfig: INavigateToConfig = typeof navigateTo === 'string'
      ? parseNavigateToTemplate(navigateTo)
      : navigateTo;

    if (!navConfig.inverseMapping) return undefined;

    const queryParams = new URLSearchParams(location.search);

    // BUG FIX: Check for sessionStorage filter key (useLargeParamStorage)
    const filterKey = queryParams.get('f');
    if (filterKey) {
      try {
        const storedData = sessionStorage.getItem(filterKey);
        if (storedData) {
          const parsed = JSON.parse(storedData);

          // Map stored params back to form fields
          if (navConfig.queryParamMapping) {
            const defaultValues: Record<string, any> = {};
            Object.entries(navConfig.queryParamMapping).forEach(([ queryKey, formPath ]) => {
              if (parsed[ queryKey ] !== undefined) {
                const deserializedValue = deserializeValue(parsed[ queryKey ]);
                setNestedValue(defaultValues, formPath, deserializedValue);
              }
            });
            return Object.keys(defaultValues).length > 0 ? defaultValues : undefined;
          }
        }
      } catch (error) {
        console.error('Failed to restore filters from sessionStorage:', error);
      }
    }

    // Regular query param mapping
    const defaultValues: Record<string, any> = {};

    if (navConfig.queryParamMapping) {
      // Reverse map query params to form fields
      Object.entries(navConfig.queryParamMapping).forEach(([ queryKey, formPath ]) => {
        const value = queryParams.get(queryKey);
        if (value !== null) {
          // BUG FIX: Handle nested paths + deserialization
          const deserializedValue = deserializeValue(value);
          setNestedValue(defaultValues, formPath, deserializedValue);
        }
      });
    }

    return Object.keys(defaultValues).length > 0 ? defaultValues : undefined;
  };

  if (modalType === "confirm" && modalPageConfig && 'title' in modalPageConfig) {
    const configTitle = (modalPageConfig as IConfirmModal)?.title;

    // Evaluate templates for both modalTitle and configTitle
    const evaluatedModalTitle = modalTitle
      ? evaluateTemplateValue(modalTitle, routeParams)
      : null;
    const evaluatedConfigTitle = configTitle
      ? evaluateTemplateValue(configTitle, routeParams)
      : null;
    const effectiveTitle = evaluatedModalTitle || evaluatedConfigTitle || 'Confirm';

    const effectiveWidth = getDefaultModalWidth('confirm', modalWidth);

    return (
      <ModalDepthContext.Provider value={nextDepth}>
        <AntModal
          title={effectiveTitle}
          open={true}
          onOk={confirmApiAction}
          onCancel={onCancelCallback}
          okText={throttleText || "Confirm"}
          cancelText="Cancel"
          loading={loading}
          okButtonProps={{ disabled: isThrottled || loading }}
          width={effectiveWidth}
          wrapClassName={`modal-depth-${currentDepth}`}
        >
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              onCancelCallback && onCancelCallback(); // Close modal on error reset
            }}
          >
            {evaluateTemplateValue((modalPageConfig as IConfirmModal)?.content, routeParams)}
            {children}
          </ErrorBoundary>
        </AntModal>

        {/* ✅ NO response modal rendering - handled globally by ResponseModalContext */}
      </ModalDepthContext.Provider>
    )
  }


  if (modalType === 'chain' && modalPageConfig) {
    const chainConfig = modalPageConfig as IChainConfig;
    const chainTitle = typeof modalTitle === 'string' ? modalTitle : undefined;
    const chainContent = (
      <ChainModalContent
        chainConfig={chainConfig}
        routeParams={routeParams as Record<string, unknown>}
        onComplete={(values) => { onSuccessCallback?.(values); }}
        onCancel={onCancelCallback}
      />
    );

    if (chainConfig.containerType === 'drawer') {
      return (
        <ModalDepthContext.Provider value={nextDepth}>
          <AntDrawer title={chainTitle} placement="right" width={modalWidth || 520} open onClose={onCancelCallback}>
            {chainContent}
          </AntDrawer>
        </ModalDepthContext.Provider>
      );
    }

    return (
      <ModalDepthContext.Provider value={nextDepth}>
        <AntModal title={chainTitle} open footer={null} width={modalWidth || 640} onCancel={onCancelCallback}>
          {chainContent}
        </AntModal>
      </ModalDepthContext.Provider>
    );
  }

  if ([ "list", "form", "details", "accordion", "dashboard", "wizard", "custom" ].includes(modalType) && modalPageConfig) {
    // Extract title from modalPageConfig if it exists
    const configTitle = 'title' in modalPageConfig ? (modalPageConfig as any).title : undefined;

    // Evaluate modalTitle template if provided, otherwise use configTitle
    const evaluatedModalTitle = modalTitle
      ? evaluateTemplateValue(modalTitle, routeParams, configTitle)
      : configTitle;

    const effectiveTitle = evaluatedModalTitle || configTitle;

    // Use centralized width calculation
    const effectiveWidth = getDefaultModalWidth(modalType as any, modalWidth);

    // Get default values from query if inverseMapping is enabled
    const defaultValuesFromQuery = getDefaultValuesFromQuery();

    // Shared inner content — same for both modal and drawer containers
    const modalInnerContent = (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          onCancelCallback && onCancelCallback(); // Close modal on error reset
        }}
      >
        {/* Wrap in ModalContext so child components know they're in a modal */}
        <ModalContextProvider onClose={onCancelCallback}>
          <RenderFromPageType
            cardStyle={{ marginTop: "2%" }}
            pageType={modalType as IPageType}
            listPageConfig={modalType === "list" ? modalPageConfig as ITableConfig : undefined}
            formPageConfig={
              modalType === "form" ? {
                ...(modalPageConfig as IForm),
                // Form uses OperationExecutor internally - pass all response handling config
                onSubmitSuccessCallback: navigateTo ? handleNavigationSubmit : onSuccessCallback,
                onCancelCallback: onCancelCallback,
                // Set apiConfig to undefined if navigateTo is specified (navigation-only mode)
                apiConfig: navigateTo ? undefined : (modalPageConfig as IForm).apiConfig,
                // Pre-populate form from context and query params
                defaultValues: {
                  ...(initialValues ? evaluateTemplateObject(initialValues, routeParams) : {}),
                  ...defaultValuesFromQuery,
                  ...(modalPageConfig as IForm).defaultValues
                },
                useDynamicIdFromParams: false,
                routeParams,
                // Pass all response handling config for OperationExecutor
                submitSuccessRedirect,
                submitSuccessRedirectOptions,
                responseConfig,
                dynamicConfigKey,
                refreshParentOnSuccess: onSuccessCallback ? true : undefined, // Auto-enable if callback provided
                successMessage,
                errorMessage,
                skipSuccessToast,
                skipErrorToast,
                closeModalOnError,
                ...(notification && { notification }),
                ...(throttle && { throttle }),
              } as any : undefined
            }
            detailsPageConfig={
              modalType === "details" ? modalPageConfig as IDetailsConfig : undefined
            }
            accordionsPageConfig={
              modalType === "accordion" ? modalPageConfig as IAccordionPageConfig : undefined
            }
            wizardPageConfig={
              modalType === "wizard" ? {
                ...(modalPageConfig as IWizardPageConfig),
                onSubmitSuccessCallback: navigateTo ? handleNavigationSubmit : onSuccessCallback,
                onCancelCallback: onCancelCallback,
                // Pass route params for any dynamic field loading
                routeParams,
                // Pass all response handling config for OperationExecutor (same as forms)
                submitSuccessRedirect,
                submitSuccessRedirectOptions,
                responseConfig,
                dynamicConfigKey,
                refreshParentOnSuccess: onSuccessCallback ? true : undefined,
                successMessage,
                errorMessage,
                skipSuccessToast,
                skipErrorToast,
                closeModalOnError,
                ...(notification && { notification }),
                ...(throttle && { throttle }),
              } as any : undefined
            }
            dashboardPageConfig={
              modalType === "dashboard" ? modalPageConfig as IDashboardPageConfig : undefined
            }
            customPageConfig={
              modalType === "custom" && modalPageConfig && 'componentKey' in modalPageConfig
                ? modalPageConfig as any
                : undefined
            }
            identifiers={identifiers}
            routeParams={routeParams}
          />
        </ModalContextProvider>
      </ErrorBoundary>
    );

    // Drawer container (used when containerType === 'drawer', e.g. quickCreate.openIn = 'drawer')
    if (containerType === 'drawer') {
      return (
        <ModalDepthContext.Provider value={nextDepth}>
          <AntDrawer
            title={effectiveTitle}
            open={true}
            onClose={onCancelCallback}
            width={effectiveWidth || 600}
            placement="right"
            styles={{ body: { padding: 0 } }}
          >
            {modalInnerContent}
          </AntDrawer>
        </ModalDepthContext.Provider>
      );
    }

    return (
      <ModalDepthContext.Provider value={nextDepth}>
        <AntModal
          title={effectiveTitle}
          footer={null}
          open={true}
          onCancel={onCancelCallback}
          loading={loading}
          width={effectiveWidth}
          wrapClassName={`modal-depth-${currentDepth}`}
          styles={{
            body: { padding: 0 }
          }}
        >
          {modalInnerContent}
        </AntModal>

        {/* ✅ NO response modal rendering - handled globally by ResponseModalContext */}
      </ModalDepthContext.Provider>
    )
  }

  if (modalType === "custom" && children) {
    return (
      <ModalDepthContext.Provider value={nextDepth}>
        <AntModal
          footer={null}
          open={true}
          onCancel={onCancelCallback}
          wrapClassName={`modal-depth-${currentDepth}`}
        >
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              onCancelCallback && onCancelCallback(); // Close modal on error reset
            }}
          >
            {children}
          </ErrorBoundary>
        </AntModal>
      </ModalDepthContext.Provider>
    )
  }

  return <>Invalid Modal config { }</>
}

type IOpenInModal = IModalConfig

/**
 * OpenInModal - Action-Oriented Modal Component
 * 
 * PURPOSE:
 * Opens modals for performing actions (API calls, form submissions, confirmations).
 * This is the "do something" modal with rich API integration and response handling.
 * 
 * WHEN TO USE:
 * ✅ Confirmation dialogs ("Delete Team?", "Approve Request?")
 * ✅ Action forms with API calls (Create, Update, Delete operations)
 * ✅ Navigation-only forms (filter form → navigate with query params)
 * ✅ Bulk operations with response display (show results in second modal)
 * ✅ Custom success/error messages with templates
 * ✅ Need loading states during API calls
 * ✅ Need refreshParentOnSuccess callback
 * 
 * WHEN NOT TO USE (use OpenRouteInModal instead):
 * ❌ Viewing entity details without actions (use OpenRouteInModal)
 * ❌ Browsing related lists (use OpenRouteInModal)
 * ❌ Opening routes defined in entities.json (use OpenRouteInModal)
 * ❌ Need lazy config loading (use OpenRouteInModal)
 * ❌ Need overrideConfig support (use OpenRouteInModal)
 * 
 * KEY FEATURES:
 * - API Integration: Full support for apiConfig (POST, PUT, DELETE, etc.)
 * - Confirm Modals: Built-in OK/Cancel dialogs
 * - Response Display: Show API results in second modal (responseConfig)
 * - Navigation: Navigate with form values (navigateTo)
 * - Template Messages: Dynamic success/error messages
 * - Form Pre-population: initialValues with template support
 * - Inverse Mapping: Pre-populate form from URL query params
 * - Large Param Storage: sessionStorage for long filter URLs
 * - Loading States: Built-in loading spinner during API calls
 * - Error Boundaries: Safe rendering with error handling
 * - Modal Depth Tracking: Visual stacking for nested modals
 * 
 * MODAL TYPES SUPPORTED:
 * 1. confirm: Simple confirmation dialog with OK/Cancel
 * 2. form: Full form with API call or navigation
 * 3. list: Display list page in modal
 * 4. details: Display detail page in modal
 * 5. dashboard: Display dashboard in modal
 * 6. accordion: Display accordion page in modal
 * 7. custom: Custom content (children)
 * 
 * EXAMPLE USAGE:
 * ```tsx
 * // 1. Confirmation Dialog
 * <OpenInModal
 *   modalType="confirm"
 *   modalPageConfig={{ 
 *     title: "Delete {teamName}?", 
 *     content: "This will affect {playerCount} players." 
 *   }}
 *   apiConfig={{ apiMethod: 'DELETE', apiUrl: '/team/:id' }}
 *   successMessage="{teamName} deleted successfully"
 *   refreshParentOnSuccess={true}
 *   routeParams={{ teamId: 'team-123', teamName: 'Lakers', playerCount: '15' }}
 *   primaryIndex="team-123"
 * >
 *   <Button danger>Delete</Button>
 * </OpenInModal>
 * 
 * // 2. Create Form with API Call
 * <OpenInModal
 *   modalType="form"
 *   modalPageConfig={{
 *     propertiesConfig: [
 *       { name: 'teamName', label: 'Team Name', type: 'string', required: true },
 *       { name: 'sport', label: 'Sport', type: 'select', options: [...] },
 *       { name: 'isActive', label: 'Active', type: 'boolean' }
 *     ]
 *   }}
 *   apiConfig={{ apiMethod: 'POST', apiUrl: '/team' }}
 *   initialValues={{ isActive: true, sport: 'basketball' }}
 *   submitSuccessRedirect="/view-team/:id"
 *   onSuccessCallback={(response) => console.log('Created:', response)}
 *   modalTitle="Create Team"
 * >
 *   <Button type="primary">Create Team</Button>
 * </OpenInModal>
 * 
 * // 3. Filter Form with Navigation (no API call)
 * <OpenInModal
 *   modalType="form"
 *   modalPageConfig={{
 *     propertiesConfig: [
 *       { name: 'status', label: 'Status', type: 'select', options: [...] },
 *       { name: 'teamId', label: 'Team', type: 'select', options: [...] },
 *       { name: 'startDate', label: 'Start Date', type: 'date' }
 *     ]
 *   }}
 *   navigateTo={{
 *     routePattern: '/list-game',
 *     queryParamMapping: {
 *       'status': 'status',
 *       'teamId': 'teamId',
 *       'startDate': 'startDate'
 *     },
 *     useLargeParamStorage: true,  // Use sessionStorage for long URLs
 *     inverseMapping: true  // Pre-populate form from URL
 *   }}
 *   modalTitle="Filter Games"
 * >
 *   <Button>Advanced Filters</Button>
 * </OpenInModal>
 * 
 * // 4. Bulk Operation with Response Display
 * <OpenInModal
 *   modalType="form"
 *   modalPageConfig={{
 *     propertiesConfig: [
 *       { name: 'status', label: 'New Status', type: 'select', options: [...] },
 *       { name: 'priority', label: 'Priority', type: 'number' }
 *     ]
 *   }}
 *   apiConfig={{ apiMethod: 'POST', apiUrl: '/bulk-update' }}
 *   responseConfig={{
 *     showModal: true,
 *     pageType: 'dashboard',
 *     pageConfig: { 
 *       widgets: [
 *         { type: 'stat', title: 'Updated', value: '{count}' },
 *         { type: 'stat', title: 'Failed', value: '{failedCount}' }
 *       ]
 *     }
 *   }}
 *   modalTitle="Bulk Update Teams"
 * >
 *   <Button>Bulk Update</Button>
 * </OpenInModal>
 * ```
 * 
 * COMPARISON WITH OpenRouteInModal:
 * - OpenInModal: Perform actions (this component)
 * - OpenRouteInModal: Browse entities (see OpenRouteInModal.tsx)
 * 
 * ARCHITECTURE:
 * - Wraps internal Modal component (handles API, navigation, response display)
 * - Manages open/close state
 * - Forwards callbacks and props to internal Modal
 * - Supports array children: [trigger, content]
 * 
 * @see OpenRouteInModal.tsx - For view-oriented modals
 * @see Modal component - Internal modal implementation
 * @see IModalConfig - Full configuration interface
 */
export const OpenInModal = ({ ...props }: IOpenInModal) => {

  const [ open, setOpen ] = React.useState(false)

  // Instrumented callbacks using the new hook
  const instrumented = useModalInstrumentation({
    modalType: 'action',
    onOpen: props.onOpenCallback,
    onCancel: props.onCancelCallback,
    onConfirm: props.onConfirmCallback,
    onSuccess: props.onSuccessCallback,
    attributes: {
      'modal.hasApiConfig': !!props.apiConfig
    }
  });

  const onCancelCallback = () => {
    setOpen(false)
    instrumented.onCancel()
  }

  const onConfirmCallback = () => {
    setOpen(false)
    instrumented.onConfirm()
  }

  const onSuccessCallback = (response) => {
    setOpen(false)
    instrumented.onSuccess(response)
  }

  return <>
    <Link
      onClick={() => {
        setOpen(true);
        instrumented.onOpen();
      }}
      className="OpenInModal">
      {Array.isArray(props.children) ? props.children[ 0 ] : props.children}
    </Link>

    {open &&
      <Modal
        {...props}
        onSuccessCallback={onSuccessCallback}
        onConfirmCallback={onConfirmCallback}
        onCancelCallback={onCancelCallback}
        children={Array.isArray(props.children) ? props.children[ 1 ] : null}
      />
    }
  </>
}