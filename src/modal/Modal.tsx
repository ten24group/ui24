import React from 'react';
import { Modal as AntModal } from 'antd';
import { IForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/type';
import { Icon } from '../core/common';
import { Link } from '../core/common';
import { RenderFromPageType, IPageType } from '../pages/PostAuth/PostAuthPage';
import { useApi, IApiConfig } from '../core/context';
import { useAppContext } from '../core/context/AppContext';
import { IDetailsConfig } from '../detail/Details';
import { substituteUrlParams, getNestedValue, evaluateTemplateObject } from '../core/utils';
import { handleApiError } from '../core/utils/api-error-handler';
import { evaluateTemplateValue } from '../core/utils/template';
import { useNavigate, useLocation } from 'react-router-dom';
import { IAccordionPageConfig } from '../pages/PostAuth/Accordion/Accordion';
import { IDashboardPageConfig } from '../pages/PostAuth/DashboardPage';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { ModalContextProvider } from '../core/context';
import { ResponseModal, useResponseModal } from '../core/utils/responseDisplay';
import { getDefaultModalWidth } from './modalUtils';
import { Template } from '../core/types';

// Simple modal depth tracking for stack effect
const ModalDepthContext = React.createContext(0);
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
type IModalType = "confirm" | "list" | "form" | "custom" | "details" | "accordion" | "dashboard";

type IModalPageConfig = IConfirmModal | IForm | ITableConfig | IDetailsConfig | IAccordionPageConfig | IDashboardPageConfig;

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
  pageType?: 'details' | 'list' | 'dashboard' | 'accordion';
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
  submitSuccessRedirect?: string;
  
  /** OR: Navigate without API call (new pattern) */
  navigateTo?: INavigateToConfig | string;
  
  /** OPTIONAL: Display API response in modal (instead of just toast) */
  responseConfig?: IResponseDisplayConfig;
  
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
        return jsDate.toISOString().split('T')[0];
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
        return date.toISOString().split('T')[0];
      default:
        return date.toISOString();
    }
  }
  
  // Handle Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    
    // If array of objects, extract specific field
    if (typeof value[0] === 'object' && value[0] !== null) {
      const extractField = arrayValuePath || 'id';
      return value.map(v => v[extractField] || JSON.stringify(v)).filter(Boolean).join(',');
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
  const [routePattern, queryString] = template.split('?');
  
  if (!queryString) {
    return { routePattern };
  }
  
  // Extract {param} placeholders from query string
  const queryParamMapping: Record<string, string> = {};
  const params = queryString.split('&');
  
  params.forEach(param => {
    const [key, value] = param.split('=');
    if (value && value.startsWith('{') && value.endsWith('}')) {
      const fieldPath = value.slice(1, -1); // Remove { and }
      queryParamMapping[key] = fieldPath;
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
  refreshParentOnSuccess = false,
  successMessage,
  errorMessage,
  primaryIndex = "",
  useDynamicIdFromParams = true,
  onSuccessCallback,
  button,
  onCancelCallback,
  onConfirmCallback,
  submitSuccessRedirect,
  routeParams = {},
  identifiers,
  modalWidth,
  modalTitle
}: IModalConfig) => {

  const { notifyError, notifySuccess } = useAppContext()
  const { callApiMethod } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [ loading, setLoading ] = React.useState(false);
  
  // Track modal depth for stack effect
  const currentDepth = useModalDepth();
  const nextDepth = currentDepth + 1;
  
  // Response modal state management
  const { 
    responseModalVisible, 
    responseData, 
    showResponseModal, 
    hideResponseModal 
  } = useResponseModal();

  const confirmApiAction = async () => {
    // Use the clean utility function for URL parameter substitution
    const formattedApiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams, primaryIndex);
    setLoading(true);
    try {
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl: formattedApiUrl
      });

      if (response.status === 200) {
        const responseDataFromApi = apiConfig.responseKey ? response.data[ apiConfig.responseKey ] : response.data;
        
        // Evaluate custom success message template if provided, otherwise use API response message
        let message: string;
        if (successMessage) {
          const context = { ...routeParams, ...responseDataFromApi };
          message = evaluateTemplateValue(successMessage, context);
        } else {
          message = response.data?.details?.message || response.data?.message || response.message || "Operation Success";
        }
        
        notifySuccess(message);

        // Check if parent should be refreshed
        if (refreshParentOnSuccess && onSuccessCallback) {
          onSuccessCallback(responseDataFromApi);
        }
        
        // Check if response should be displayed in modal
        if (responseConfig?.showModal) {
          // Show response modal - delay redirect and callback until modal closes
          showResponseModal(responseDataFromApi);
          // Note: Action modal stays open, will be closed when response modal closes
          // onConfirmCallback will be called in response modal's onClose handler
        } else {
          // Standard behavior: callback + redirect
          // Note: Don't call onSuccessCallback again if already called above
          if (!refreshParentOnSuccess && onSuccessCallback) {
            onSuccessCallback(responseDataFromApi);
          }
          if (submitSuccessRedirect) {
            // redirect to appropriate page
            // replace placeholders with the actual values
            let formattedSubmitSuccessRedirect = substituteUrlParams(submitSuccessRedirect, { ...routeParams, ...(responseDataFromApi || {}) }, primaryIndex);
            navigate(formattedSubmitSuccessRedirect)
          }
          // Close action modal
          onConfirmCallback && onConfirmCallback()
        }
      } else if (response.status >= 400 && response.status < 600) {
        // Handle error response using consolidated error handler
        const errorResult = handleApiError(response, 'Operation failed');
        
        // Evaluate custom error message template if provided, otherwise use error handler result
        let message: string;
        if (errorMessage) {
          const context = { 
            ...routeParams, 
            ...(response.data || {}),
            error: errorResult.errorMessage 
          };
          message = evaluateTemplateValue(errorMessage, context);
        } else {
          message = errorResult.formattedErrors.join('\n');
        }
        
        // Show all errors (validation or other)
        notifyError(message);
        
        // Keep modal OPEN on validation errors (user can review and cancel)
        // Close modal on non-validation errors (404, 403, 500, etc.)
        if (!errorResult.isValidationError) {
          onConfirmCallback && onConfirmCallback();
        }
      }
    } catch (error: any) {
      // Handle network errors or other exceptions using consolidated error handler
      const errorResult = handleApiError(error, 'An unexpected error occurred');
      
      // Evaluate custom error message template if provided, otherwise use error handler result
      let message: string;
      if (errorMessage) {
        const context = { 
          ...routeParams, 
          error: errorResult.errorMessage 
        };
        message = evaluateTemplateValue(errorMessage, context);
      } else {
        message = errorResult.formattedErrors.join('\n');
      }
      
      // Show all errors
      notifyError(message);
      
      // Keep modal open on validation errors or network errors (user can retry or cancel)
      // This is intentional UX: user should decide whether to retry or cancel
    } finally {
      setLoading(false);
    }
  }

  // NEW: Handle navigation from form submission (without API call)
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
        for (const [routeParam, formPath] of Object.entries(navConfig.routeParamMapping)) {
          const value = getNestedValue(formValues, formPath);
          if (value !== undefined) {
            mappedParams[routeParam] = value;
          }
        }
        targetUrl = substituteUrlParams(targetUrl, mappedParams);
      } else {
        // Auto-detect: :userId <- formValues.userId
        targetUrl = substituteUrlParams(targetUrl, formValues);
      }
      
      // 2. Parse existing query params from routePattern (Problem 5)
      const [pathname, existingSearch] = navConfig.routePattern.split('?');
      const existingParams = new URLSearchParams(existingSearch || '');
      
      // 3. Build new query params from form
      if (navConfig.queryParamMapping) {
        // Explicit mapping
        for (const [queryKey, formPath] of Object.entries(navConfig.queryParamMapping)) {
          const value = getNestedValue(formValues, formPath);
          if (value !== undefined && value !== null && value !== '') {
            queryParams[queryKey] = serializeValue(
              value, 
              navConfig.dateFormat, 
              navConfig.arrayValuePath
            );
          }
        }
      } else {
        // Default: all form values as query params (except those in route)
        const usedInRoute = targetUrl.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];
        Object.entries(formValues).forEach(([key, value]) => {
          if (!usedInRoute.includes(key) && value !== undefined && value !== null && value !== '') {
            queryParams[key] = serializeValue(
              value,
              navConfig.dateFormat,
              navConfig.arrayValuePath
            );
          }
        });
      }
      
      // 4. Merge existing and new query params (new overrides existing)
      const merged = new URLSearchParams(existingParams);
      Object.entries(queryParams).forEach(([k, v]) => {
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
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  };

  // Helper: Deserialize value (detect arrays, booleans, dates, numbers)
  const deserializeValue = (value: string, dateFormat?: string): any => {
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
            Object.entries(navConfig.queryParamMapping).forEach(([queryKey, formPath]) => {
              if (parsed[queryKey] !== undefined) {
                const deserializedValue = deserializeValue(parsed[queryKey], navConfig.dateFormat);
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
      Object.entries(navConfig.queryParamMapping).forEach(([queryKey, formPath]) => {
        const value = queryParams.get(queryKey);
        if (value !== null) {
          // BUG FIX: Handle nested paths + deserialization
          const deserializedValue = deserializeValue(value, navConfig.dateFormat);
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
          okText="Confirm"
          cancelText="Cancel"
          loading={loading}
          width={effectiveWidth}
          wrapClassName={`modal-depth-${currentDepth}`}
        >
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              console.log("Modal (Confirm) ErrorBoundary Reset");
              onCancelCallback && onCancelCallback(); // Close modal on error reset
            }}
          >
            {evaluateTemplateValue((modalPageConfig as IConfirmModal)?.content, routeParams)}
            {children}
          </ErrorBoundary>
        </AntModal>
        
        {/* Response modal - shown after successful API call */}
        {responseConfig && (
          <ResponseModal
            visible={responseModalVisible}
            responseData={responseData}
            responseConfig={responseConfig}
            actionModalTitle={effectiveTitle}
            onClose={() => {
              hideResponseModal();
              
              // Execute callback and redirect after modal closes
              // Note: Don't call callback if refreshParentOnSuccess already called it
              if (!refreshParentOnSuccess && onSuccessCallback) {
                onSuccessCallback(responseData);
              }
              if (submitSuccessRedirect) {
                const formattedUrl = substituteUrlParams(
                  submitSuccessRedirect, 
                  { ...routeParams, ...(responseData || {}) }, 
                  primaryIndex
                );
                navigate(formattedUrl);
              }
              
              // Close action modal too
              onConfirmCallback && onConfirmCallback();
            }}
          />
        )}
      </ModalDepthContext.Provider>
    )
  }

  // Handler for form submissions (wraps response display logic)
  const handleFormSubmitSuccess = (response: any) => {
    // Extract response data (Form.tsx passes full response object)
    const responseDataFromForm = response?.data || response;
    
    // Check if parent should be refreshed
    if (refreshParentOnSuccess && onSuccessCallback) {
      onSuccessCallback(responseDataFromForm);
    }
    
    if (responseConfig?.showModal) {
      showResponseModal(responseDataFromForm);
      // Note: Action modal stays open, will be closed when response modal closes
    } else {
      // Standard behavior - only call callback if not already called above
      if (!refreshParentOnSuccess && onSuccessCallback) {
        onSuccessCallback(responseDataFromForm);
      }
    }
  };
  
  // Validation: Warn if both navigateTo and responseConfig are specified (mutually exclusive)
  React.useEffect(() => {
    if (navigateTo && responseConfig?.showModal) {
      console.warn(
        '[Modal] Both navigateTo and responseConfig.showModal are specified. ' +
        'navigateTo takes precedence. This might be a configuration error.'
      );
    }
  }, [navigateTo, responseConfig]);

  if ([ "list", "form", "details", "accordion", "dashboard", "custom" ].includes(modalType) && modalPageConfig) {
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
        >
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              console.log("Modal (PageType) ErrorBoundary Reset");
              onCancelCallback && onCancelCallback(); // Close modal on error reset
            }}
          >
            {/* Wrap in ModalContext so child components know they're in a modal */}
            <ModalContextProvider>
              <RenderFromPageType
                cardStyle={{ marginTop: "2%" }}
                pageType={modalType as IPageType}
                listPageConfig={modalType === "list" ? modalPageConfig as ITableConfig : undefined}
                formPageConfig={
                  modalType === "form" ? {
                    ...modalPageConfig,
                    // Determine callback based on navigateTo, responseConfig, or standard
                    onSubmitSuccessCallback: navigateTo 
                      ? handleNavigationSubmit 
                      : (responseConfig?.showModal ? handleFormSubmitSuccess : onSuccessCallback),
                    // Pass cancel callback to close modal
                    onCancelCallback: onCancelCallback,
                    // Remove apiConfig if navigateTo is specified (navigation-only mode)
                    apiConfig: navigateTo ? undefined : (modalPageConfig as IForm).apiConfig,
                    // Pre-populate form from context and query params
                    // Merge priority (lowest to highest):
                    // 1. Field defaults (from entity schema) - handled by Form component
                    // 2. initialValues (from action config) - evaluated here
                    // 3. Query params (from URL with inverseMapping)
                    // 4. Form defaultValues (from parent component)
                    defaultValues: {
                      ...(initialValues ? evaluateTemplateObject(initialValues, routeParams) : {}),
                      ...defaultValuesFromQuery,
                      ...(modalPageConfig as IForm).defaultValues
                    },
                    useDynamicIdFromParams: false,
                    routeParams
                  } as IForm : undefined
                }
                detailsPageConfig={
                  modalType === "details" ? modalPageConfig as IDetailsConfig : undefined
                }
                accordionsPageConfig={
                  modalType === "accordion" ? modalPageConfig as IAccordionPageConfig : undefined
                }
                dashboardPageConfig={
                  modalType === "dashboard" ? modalPageConfig as IDashboardPageConfig : undefined
                }
                identifiers={identifiers}
                routeParams={routeParams}
              />
            </ModalContextProvider>
          </ErrorBoundary>
        </AntModal>
        
        {/* Response modal - shown after successful API call */}
        {responseConfig && (
          <ResponseModal
            visible={responseModalVisible}
            responseData={responseData}
            responseConfig={responseConfig}
            actionModalTitle={effectiveTitle}
            onClose={() => {
              hideResponseModal();
              
              // Execute callback and redirect after modal closes
              onSuccessCallback && onSuccessCallback(responseData);
              if (submitSuccessRedirect) {
                const formattedUrl = substituteUrlParams(
                  submitSuccessRedirect, 
                  { ...routeParams, ...(responseData || {}) }, 
                  primaryIndex
                );
                navigate(formattedUrl);
              }
              
              // Close action modal too
              onCancelCallback && onCancelCallback();
            }}
          />
        )}
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
                console.log("Modal (Custom) ErrorBoundary Reset");
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

export const OpenInModal = ({ ...props }: IOpenInModal) => {

  const [ open, setOpen ] = React.useState(false)

  const onCancelCallback = () => {
    setOpen(false)
    if (props.onCancelCallback) {
      props.onCancelCallback()
    }
  }

  const onConfirmCallback = () => {
    setOpen(false)
    if (props.onConfirmCallback) {
      props.onConfirmCallback()
    }
  }

  const onSuccessCallback = (response) => {
    setOpen(false)
    if (props.onSuccessCallback) {
      props.onSuccessCallback(response)
    }
  }

  return <>
    <Link
      onClick={(url) => {
        setOpen(true);
        if (props.onOpenCallback) {
          props.onOpenCallback()
        }
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