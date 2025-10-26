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
import { substituteUrlParams, getNestedValue } from '../core/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { IAccordionPageConfig } from '../pages/PostAuth/Accordion/Accordion';
import { IDashboardPageConfig } from '../pages/PostAuth/DashboardPage';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { ModalContextProvider } from '../core/context';

interface IConfirmModal {
  title: string;
  content?: string;
}
type IModalType = "confirm" | "list" | "form" | "custom" | "details" | "accordion" | "dashboard";

type IModalPageConfig = IConfirmModal | IForm | ITableConfig | IDetailsConfig | IAccordionPageConfig | IDashboardPageConfig;

/**
 * Navigation configuration for modal form submissions
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
  
  primaryIndex?: string;
  useDynamicIdFromParams?: boolean;
  onSuccessCallback?: (response?: any) => void;
  onConfirmCallback?: () => void;
  onCancelCallback?: () => void;
  onOpenCallback?: () => void;
  routeParams?: Record<string, string>;
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
  primaryIndex = "",
  useDynamicIdFromParams = true,
  onSuccessCallback,
  button,
  onCancelCallback,
  onConfirmCallback,
  submitSuccessRedirect,
  routeParams = {}
}: IModalConfig) => {

  const { notifyError, notifySuccess } = useAppContext()
  const { callApiMethod } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [ loading, setLoading ] = React.useState(false);

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
        const responseData = apiConfig.responseKey ? response.data[ apiConfig.responseKey ] : response.data;
        const message = response.data?.details?.message || response.data?.message || response.message || "Operation Success";
        notifySuccess(message);

        onSuccessCallback && onSuccessCallback(responseData);
        if (submitSuccessRedirect) {
          // redirect to appropriate page
          // replace placeholders with the actual values
          let formattedSubmitSuccessRedirect = substituteUrlParams(submitSuccessRedirect, { ...routeParams, ...(responseData || {}) }, primaryIndex);
          navigate(formattedSubmitSuccessRedirect)
        }
      } else {
        const message = response.data?.details?.message || response.data?.message || response.message || "Operation Failed";
        notifyError(message)
      }

      onConfirmCallback && onConfirmCallback()
    } catch (error: any) {
      notifyError(error?.message || 'An unexpected error occurred');
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
    return (
      <AntModal
        title={(modalPageConfig as IConfirmModal)?.title}
        open={true}
        onOk={confirmApiAction}
        onCancel={onCancelCallback}
        okText="Confirm"
        cancelText="Cancel"
        loading={loading}
      >
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            console.log("Modal (Confirm) ErrorBoundary Reset");
            onCancelCallback && onCancelCallback(); // Close modal on error reset
          }}
        >
          {(modalPageConfig as IConfirmModal)?.content}
          {children}
        </ErrorBoundary>
      </AntModal>
    )
  }

  if ([ "list", "form", "details", "accordion", "dashboard", "custom" ].includes(modalType) && modalPageConfig) {
    // Extract title from modalPageConfig if it exists
    const modalTitle = 'title' in modalPageConfig ? (modalPageConfig as any).title : undefined;
    
    // Get default values from query if inverseMapping is enabled
    const defaultValuesFromQuery = getDefaultValuesFromQuery();
    
    return (
      <AntModal
        title={modalTitle}
        footer={null}
        open={true}
        onCancel={onCancelCallback}
        loading={loading}
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
              cardStyle={{ marginTop: "5%" }}
              pageType={modalType as IPageType}
              listPageConfig={modalType === "list" ? modalPageConfig as ITableConfig : undefined}
              formPageConfig={
                modalType === "form" ? {
                  ...modalPageConfig,
                  // Use navigation handler if navigateTo is specified, otherwise use regular callback
                  onSubmitSuccessCallback: navigateTo ? handleNavigationSubmit : onSuccessCallback,
                  // Remove apiConfig if navigateTo is specified (navigation-only mode)
                  apiConfig: navigateTo ? undefined : (modalPageConfig as IForm).apiConfig,
                  // Pre-populate form from query params if inverseMapping enabled
                  defaultValues: defaultValuesFromQuery || (modalPageConfig as IForm).defaultValues,
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
              routeParams={routeParams}
            />
          </ModalContextProvider>
        </ErrorBoundary>
      </AntModal>
    )
  }

  if (modalType === "custom" && children) {
    return (
      <AntModal
        footer={null}
        open={true}
        onCancel={onCancelCallback}>
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