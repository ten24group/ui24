/**
 * OperationExecutor.ts
 * 
 * Centralized service for executing API operations with:
 * - Loading state management
 * - Error handling (validation + generic)
 * - Success handling (toast, redirect, responseModal, callbacks)
 * - Request cancellation
 * - Retry logic
 * - Conditional behavior
 * - Chaining support
 */

import { useMemo } from 'react';
import { useCoreNavigator } from '../../routes/Navigation';
import { useApi } from '../context/ApiContext';
import { useAppContext } from '../context/AppContext';
import { useResponseModalContext } from '../context/ResponseModalContext';

import type { IResponseDisplayConfig } from '../../modal/Modal';
import { IApiConfig } from '../context/ApiContext';
import type { Template } from '../types';
import { substituteUrlParams } from '../utils';
import { ApiErrorHandlerResult, handleApiError } from '../utils/api-error-handler';
import { evaluateTemplateValue } from '../utils/template';
import { queryClient } from '../query/QueryProvider';
import { queryKeys } from '../query/queryKeys';

// ============================================================================
// TYPES
// ============================================================================

export interface OperationConfig {
  // ===== Required =====
  apiConfig: IApiConfig;

  // ===== Payload & Context =====
  payload?: any;
  routeParams?: Record<string, any>;

  // ===== UI State =====
  onLoading?: (isLoading: boolean) => void;

  // ===== Success Behavior =====
  submitSuccessRedirect?: string;
  /**
   * Navigation options for submitSuccessRedirect
   * Uses react-router-dom's NavigateOptions: { replace?: boolean; state?: unknown; }
   */
  submitSuccessRedirectOptions?: {
    replace?: boolean;
    state?: unknown;
  };
  responseConfig?: IResponseDisplayConfig;
  dynamicConfigKey?: string; // Extract next-step config from response
  conditionalBehavior?: (data: any) => Partial<OperationConfig>;
  successMessage?: Template;
  skipSuccessToast?: boolean;
  refreshParentOnSuccess?: boolean;

  // ===== Error Behavior =====
  errorMessage?: Template;
  skipErrorToast?: boolean;
  closeModalOnError?: boolean;

  // ===== Advanced =====
  transformResponse?: (data: any) => any;
  abortSignal?: AbortSignal;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: 'linear' | 'exponential';
    retryableStatuses?: number[];
  };
}

export interface OperationCallbacks {
  onSuccess?: (data: any) => void;
  onValidationError?: (fieldErrors: any[], formErrors: string[]) => void;
  onError?: (error: ApiErrorHandlerResult) => void;
  onClose?: () => void;
  onRefresh?: () => void;
  onChain?: (data: any, config: IResponseDisplayConfig) => void;
}

export interface OperationExecutorDeps {
  navigate: (url: string, options?: any) => void;
  callApiMethod: (config: IApiConfig) => Promise<any>;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  showResponseModal?: (data: any, config: IResponseDisplayConfig, onModalClose?: () => void) => void;
}

// ============================================================================
// OPERATION EXECUTOR
// ============================================================================

export class OperationExecutor {
  constructor(private deps: OperationExecutorDeps) { }

  /**
   * Execute complete operation: API call + response handling
   */
  async execute(
    config: OperationConfig,
    callbacks: OperationCallbacks = {}
  ): Promise<void> {
    const { apiConfig, payload, onLoading } = config;

    onLoading?.(true);

    try {
      // Execute API call (with retry if configured)
      const response = await this.executeWithRetry(
        () => this.deps.callApiMethod({
          ...apiConfig,
          // Only override payload if explicitly provided at config level
          ...(payload !== undefined ? { payload } : {}),
          signal: config.abortSignal
        }),
        config.retry
      );

      // Extract and transform data
      let data = this.extractResponseData(response, apiConfig.responseKey);

      if (config.transformResponse) {
        data = config.transformResponse(data);
      }

      // Handle success or error (any 2xx status is success)
      if (response.status >= 200 && response.status < 300) {
        await this.handleSuccess(response, data, config, callbacks);
      } else {
        await this.handleError(response, config, callbacks);
      }

    } catch (error: any) {
      // Ignore intentional cancellations
      if (this.isCancellationError(error)) {
        return;
      }

      await this.handleError(error, config, callbacks);
    } finally {
      onLoading?.(false);
    }
  }

  // ==========================================================================
  // SUCCESS HANDLING
  // ==========================================================================

  private async handleSuccess(
    response: any,
    data: any,
    config: OperationConfig,
    callbacks: OperationCallbacks
  ): Promise<void> {
    // Apply conditional behavior if defined
    let effectiveConfig = config;
    if (config.conditionalBehavior) {
      const conditionalOverrides = config.conditionalBehavior(data);
      effectiveConfig = { ...config, ...conditionalOverrides };
    }

    // Invalidate React Query cache for the affected entity.
    // Derive entity name from apiUrl (same pattern as Form.tsx / Details.tsx).
    this.invalidateEntityCache(config.apiConfig.apiUrl);

    // 1. Response Modal / Chaining (Priority 1)
    // Check for response modal config OR dynamic chaining config
    const hasResponseConfig = effectiveConfig.responseConfig?.showModal;
    const hasDynamicConfig = effectiveConfig.dynamicConfigKey && data[ effectiveConfig.dynamicConfigKey ];

    if (hasResponseConfig || hasDynamicConfig) {
      const dynamicConf = hasDynamicConfig ? data[ effectiveConfig.dynamicConfigKey! ] : {};
      const finalResponseConfig: IResponseDisplayConfig = {
        ...effectiveConfig.responseConfig,
        ...dynamicConf,
        dataContext: data
      };

      // CRITICAL FOR CHAINING: Remove dynamic config from data before passing to ResponseModal
      // This prevents the nextStep/dynamicConfig object from being rendered as a form field
      const cleanData = { ...data };
      if (effectiveConfig.dynamicConfigKey) {
        delete cleanData[ effectiveConfig.dynamicConfigKey ];
      }

      // Show toast BEFORE modal if not explicitly skipped and successMessage is provided
      // This allows custom success messages to be shown alongside response modals
      if (!effectiveConfig.skipSuccessToast && effectiveConfig.successMessage) {
        const message = this.evaluateMessage(
          effectiveConfig.successMessage,
          data,
          this.getDefaultSuccessMessage({ data })
        );
        this.deps.notifySuccess(message);
      }

      // CRITICAL: Refresh parent IMMEDIATELY on success, not when modal closes
      // This ensures parent data is updated while user views response modal
      if (effectiveConfig.refreshParentOnSuccess) {
        callbacks.onRefresh?.();
      }

      if (this.deps.showResponseModal) {
        // Pass clean data (without nextStep) and close callback
        this.deps.showResponseModal(cleanData, finalResponseConfig, callbacks.onClose);
      }

      callbacks.onChain?.(cleanData, finalResponseConfig);
      return; // Stop here, chain continues in modal
    }

    // 2. Toast (unless skipped)
    // Moved after ResponseModal check so that chaining/modals implicitly skip toast (by returning early)
    if (!effectiveConfig.skipSuccessToast) {
      const message = this.evaluateMessage(
        effectiveConfig.successMessage,
        data,
        this.getDefaultSuccessMessage(response)
      );
      this.deps.notifySuccess(message);
    }

    // 3. Redirect (Priority 2)
    if (effectiveConfig.submitSuccessRedirect) {
      const url = substituteUrlParams(
        effectiveConfig.submitSuccessRedirect,
        { ...config.routeParams, ...data }
      );

      this.navigateToUrl(url, effectiveConfig.submitSuccessRedirectOptions);
      callbacks.onClose?.();
      return; // Stop here
    }

    // 4. Parent Refresh (Priority 3)
    if (effectiveConfig.refreshParentOnSuccess) {
      callbacks.onRefresh?.();
    }

    // 5. Standard Callback + Close
    callbacks.onSuccess?.(data);
    callbacks.onClose?.();
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  private async handleError(
    error: any,
    config: OperationConfig,
    callbacks: OperationCallbacks
  ): Promise<void> {
    try {
      const errorResult = handleApiError(error, 'Operation failed');

      // Special handling for validation errors (400)
      if (errorResult.isValidationError && callbacks.onValidationError) {
        callbacks.onValidationError(
          errorResult.validationErrors!.fieldErrors,
          errorResult.validationErrors!.formErrors
        );

        if (!config.skipErrorToast) {
          this.deps.notifyError('Please fix validation errors');
        }
        return; // Keep form/modal open for correction
      }

      // Generic errors
      if (!config.skipErrorToast) {
        const message = this.evaluateMessage(
          config.errorMessage,
          error,
          errorResult.errorMessage
        );
        this.deps.notifyError(message);
      }

      callbacks.onError?.(errorResult);

      if (config.closeModalOnError) {
        callbacks.onClose?.();
      }
    } catch (handlerError) {
      // Fallback if error handler itself crashes
      console.error('[OperationExecutor] Error handler failed:', handlerError);
      this.deps.notifyError('An unexpected error occurred');
      callbacks.onClose?.();
    }
  }

  // ==========================================================================
  // RETRY LOGIC
  // ==========================================================================

  private async executeWithRetry<T>(
    apiCall: () => Promise<T>,
    retryConfig?: OperationConfig[ 'retry' ]
  ): Promise<T> {
    if (!retryConfig || !retryConfig.maxAttempts || retryConfig.maxAttempts <= 1) {
      return apiCall();
    }

    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoff = 'exponential',
      retryableStatuses = [ 408, 429, 500, 502, 503, 504 ]
    } = retryConfig;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        const isLastAttempt = attempt === maxAttempts;
        const status = error.status || error.response?.status;
        const isRetryable = retryableStatuses.includes(status);

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        // Calculate delay
        const delay = backoff === 'exponential'
          ? delayMs * Math.pow(2, attempt - 1)
          : delayMs * attempt;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Retry logic failed unexpectedly');
  }

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  private navigateToUrl(url: string, options?: OperationConfig[ 'submitSuccessRedirectOptions' ]): void {
    // External URL detection
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      window.location.href = url;
    } else {
      this.deps.navigate(url, options);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private extractResponseData(response: any, responseKey?: string): any {
    if (responseKey && response.data?.[ responseKey ]) {
      return response.data[ responseKey ];
    }
    return response.data || response || {};
  }

  private getDefaultSuccessMessage(response: any): string {
    return response.data?.details?.message
      || response.data?.message
      || response.message
      || 'Success';
  }

  private evaluateMessage(
    template: Template | undefined,
    context: any,
    fallback: string
  ): string {
    if (!template) return fallback;

    try {
      return evaluateTemplateValue(template, context, fallback);
    } catch {
      return fallback;
    }
  }

  /**
   * Invalidate React Query cache for the entity derived from an API URL.
   * E.g. '/api/team/:teamId' → entity 'team', '/admin/player' → entity 'player'
   */
  private invalidateEntityCache(apiUrl?: string): void {
    if (!apiUrl) return;

    const parts = apiUrl.split('/').filter(Boolean);
    // Walk backwards to find the first non-parameter segment
    let entityName: string | undefined;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!parts[i].startsWith(':')) {
        entityName = parts[i];
        break;
      }
    }

    if (entityName && entityName !== 'unknown') {
      queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).all });
    }
  }

  private isCancellationError(error: any): boolean {
    return error.name === 'AbortError' || error.name === 'CanceledError';
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * React hook for using OperationExecutor in components
 * Automatically injects global response modal from context
 */
export function useOperationExecutor(): OperationExecutor {
  const { callApiMethod } = useApi();
  const { notifySuccess, notifyError } = useAppContext();
  const navigate = useCoreNavigator();
  const { showResponseModal } = useResponseModalContext();

  return useMemo(() => {
    return new OperationExecutor({
      navigate,
      callApiMethod,
      notifySuccess,
      notifyError,
      showResponseModal
    });
  }, [ navigate, callApiMethod, notifySuccess, notifyError, showResponseModal ]);
}