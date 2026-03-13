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

import { useMemo, useContext } from 'react';
import { useCoreNavigator } from '../../routes/Navigation';
import { useApi } from '../context/ApiContext';
import { useAppContext, NotifyOptions } from '../context/AppContext';
import { useResponseModalContext } from '../context/ResponseModalContext';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';
import { ModalDepthContext } from '../../modal/Modal';

import type { IResponseDisplayConfig } from '../../modal/Modal';
import { IApiConfig } from '../context/ApiContext';
import type { Template, ConditionalValue } from '../types';
import type { NewEvaluationContext } from '../types/evaluation';
import { isConditionalValue } from '../types/evaluation';
import { substituteUrlParams } from '../utils';
import { ApiErrorHandlerResult, handleApiError, getErrorStatus } from '../utils/api-error-handler';
import { evaluateTemplateValue } from '../utils/template';
import { IRedirectOptions, navigateToUrl } from '../utils/link-utils';
import { invalidateEntityCacheFromUrl, invalidateEntityCacheByName } from '../query/useEntityMutation';
import { conditionEvaluator } from '../utils/ConditionEvaluator';

// ============================================================================
// TYPES
// ============================================================================

export interface OperationConfig {
  // ===== Required =====
  apiConfig: IApiConfig;

  // ===== Payload & Context =====
  payload?: any;
  routeParams?: Record<string, any>;
  entityName?: string; // Entity name for cache invalidation (if apiUrl is substituted)
  originalApiUrl?: string; // Original unsubstituted API URL for cache invalidation

  // ===== Modal Depth Override =====
  /** Override modal depth for z-index calculation of response modals */
  overrideModalDepth?: number;

  // ===== UI State =====
  onLoading?: (isLoading: boolean) => void;

  // ===== Success Behavior =====
  /** Redirect URL after success. Supports ConditionalValue for condition-based routing. */
  submitSuccessRedirect?: string | ConditionalValue<string>;
  submitSuccessRedirectOptions?: IRedirectOptions;
  responseConfig?: IResponseDisplayConfig;
  dynamicConfigKey?: string; // Extract next-step config from response
  conditionalBehavior?: (data: any) => Partial<OperationConfig>;
  successMessage?: Template;
  skipSuccessToast?: boolean;
  refreshParentOnSuccess?: boolean;

  // ===== Notifications =====
  /** Config-driven notification control. Overrides successMessage/errorMessage when provided. */
  notification?: {
    success?: {
      message?: Template;
      description?: Template;
      type?: 'message' | 'notification';
      duration?: number;
      placement?: 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight';
    };
    error?: {
      message?: Template;
      description?: Template;
      type?: 'message' | 'notification';
      duration?: number;
      placement?: 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight';
    };
    /** Skip notifications: true = skip all, 'success' = skip success only, 'error' = skip error only */
    skip?: boolean | 'success' | 'error';
  };

  // ===== Error Behavior =====
  errorMessage?: Template;
  skipErrorToast?: boolean;
  closeModalOnError?: boolean;

  // ===== Throttling =====
  /** Action throttling — cooldown period after execution + countdown display */
  throttle?: {
    /** Cooldown period in milliseconds after execution (button stays disabled) */
    cooldownMs?: number;
    /** Show a "Try again in Xs" countdown on the button */
    showCountdown?: boolean;
  };

  /**
   * Invalidate additional entity caches on success, beyond the one auto-detected from apiUrl.
   * Use when a mutation affects data from other entities that may be shown on screen.
   *
   * @example
   * // After creating a post, also refresh the feed and stats entities
   * invalidateRelated: ['feed', 'teamStats']
   */
  invalidateRelated?: string[];

  // ===== Advanced =====
  transformResponse?: (data: any) => any;
  abortSignal?: AbortSignal;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: 'linear' | 'exponential';
    retryableStatuses?: number[];
  };

  /**
   * Backend Response → UI State Mapping (#92).
   * After a successful API call, map response data back into form fields.
   *
   * @example
   * // After creating a record, auto-fill the generated ID and timestamp
   * onSuccess: {
   *   updateFields: {
   *     'recordId': 'id',            // form field 'recordId' ← response.id
   *     'createdAt': 'createdAt',    // form field 'createdAt' ← response.createdAt
   *     'slug': 'computed.slug',     // supports dot-notation for nested response paths
   *   }
   * }
   */
  onSuccess?: {
    /**
     * Map form field names to response paths.
     * Key: form field name. Value: dot-notation path into the API response.
     */
    updateFields?: Record<string, string>;
  };
}

export interface OperationCallbacks {
  onSuccess?: (data: any) => void;
  onValidationError?: (fieldErrors: any[], formErrors: string[]) => void;
  onError?: (error: ApiErrorHandlerResult) => void;
  onClose?: () => void;
  onRefresh?: () => void;
  onChain?: (data: any, config: IResponseDisplayConfig) => void;
  /**
   * Called when `config.onSuccess.updateFields` is configured (#92).
   * Receives a resolved map of `{ formField: resolvedValue }` to patch into the form.
   */
  onFieldUpdate?: (fields: Record<string, unknown>) => void;
}

export interface OperationExecutorDeps {
  navigate: (url: string, options?: any) => void;
  callApiMethod: (config: IApiConfig) => Promise<any>;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notify: (level: 'success' | 'error' | 'warning' | 'info', options: NotifyOptions) => void;
  showResponseModal?: (data: any, config: IResponseDisplayConfig, onModalClose?: () => void, modalDepth?: number) => void;
  /** Current modal depth for z-index calculation */
  modalDepth?: number;
  /** Evaluation context for resolving ConditionalValue (e.g., conditional redirects) */
  evaluationContext?: NewEvaluationContext;
}

// ============================================================================
// OPERATION EXECUTOR
// ============================================================================

export class OperationExecutor {
  /** Cooldown tracker: operation key → expiry timestamp (ms) */
  private static cooldowns = new Map<string, number>();

  constructor(private deps: OperationExecutorDeps) { }

  /**
   * Check if an operation is currently in cooldown.
   * Returns remaining cooldown in ms, or 0 if not throttled.
   */
  getCooldownRemaining(operationKey: string): number {
    const expiry = OperationExecutor.cooldowns.get(operationKey);
    if (!expiry) return 0;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      OperationExecutor.cooldowns.delete(operationKey);
      return 0;
    }
    return remaining;
  }

  /**
   * Execute complete operation: API call + response handling
   */
  async execute(
    config: OperationConfig,
    callbacks: OperationCallbacks = {}
  ): Promise<void> {
    const { apiConfig, payload, onLoading } = config;

    // Throttle check — reject if within cooldown period
    if (config.throttle?.cooldownMs) {
      const opKey = apiConfig.apiUrl || 'unknown';
      const remaining = this.getCooldownRemaining(opKey);
      if (remaining > 0) {
        const secs = Math.ceil(remaining / 1000);
        this.deps.notifyError(`Please wait ${secs}s before retrying`);
        return;
      }
    }

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

    } catch (error: unknown) {
      // Ignore intentional cancellations
      if (this.isCancellationError(error)) {
        return;
      }

      await this.handleError(error, config, callbacks);
    } finally {
      onLoading?.(false);

      // Set cooldown after execution (success or failure)
      if (config.throttle?.cooldownMs) {
        const opKey = apiConfig.apiUrl || 'unknown';
        OperationExecutor.cooldowns.set(opKey, Date.now() + config.throttle.cooldownMs);
      }
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

    // Invalidate React Query cache for the affected entity (auto-derived from apiUrl)
    if (config.entityName) {
      invalidateEntityCacheByName(config.entityName);
    } else {
      invalidateEntityCacheFromUrl(config.originalApiUrl || config.apiConfig.apiUrl);
    }

    // Invalidate additional explicitly-specified related entities
    if (config.invalidateRelated?.length) {
      config.invalidateRelated.forEach(name => invalidateEntityCacheByName(name));
    }

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

      // Show toast BEFORE modal if not explicitly skipped
      const hasSuccessMsg = effectiveConfig.successMessage || effectiveConfig.notification?.success?.message;
      if (!this.shouldSkipNotification(effectiveConfig, 'success') && hasSuccessMsg) {
        this.sendNotification('success', effectiveConfig, data, this.getDefaultSuccessMessage(response));
      }

      // CRITICAL: Refresh parent IMMEDIATELY on success, not when modal closes
      // This ensures parent data is updated while user views response modal
      if (effectiveConfig.refreshParentOnSuccess) {
        callbacks.onRefresh?.();
      }

      if (this.deps.showResponseModal) {
        // Pass clean data (without nextStep), close callback, and modal depth (use override if provided)
        const effectiveDepth = config.overrideModalDepth !== undefined ? config.overrideModalDepth : this.deps.modalDepth;
        this.deps.showResponseModal(cleanData, finalResponseConfig, callbacks.onClose, effectiveDepth);
      }

      callbacks.onChain?.(cleanData, finalResponseConfig);
      return; // Stop here, chain continues in modal
    }

    // 2. Toast (unless skipped)
    if (!this.shouldSkipNotification(effectiveConfig, 'success')) {
      this.sendNotification('success', effectiveConfig, data, this.getDefaultSuccessMessage(response));
    }

    // 3. Redirect (Priority 2)
    if (effectiveConfig.submitSuccessRedirect) {
      let redirectTarget = effectiveConfig.submitSuccessRedirect;

      // Resolve ConditionalValue<string> using condition evaluator
      if (isConditionalValue<string>(redirectTarget)) {
        const evalContext: NewEvaluationContext = {
          ...(this.deps.evaluationContext || {} as NewEvaluationContext),
          record: data,
          formValues: data,
        };
        redirectTarget = conditionEvaluator.resolveValue(redirectTarget, evalContext);
      }

      const url = substituteUrlParams(
        redirectTarget,
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

    // 4b. Backend Response → UI State Mapping (#92)
    // Resolve dot-notation paths from response data into a flat field→value map
    if (effectiveConfig.onSuccess?.updateFields && callbacks.onFieldUpdate) {
      const resolvedFields: Record<string, unknown> = {};
      for (const [ formField, responsePath ] of Object.entries(effectiveConfig.onSuccess.updateFields)) {
        const parts = responsePath.split('.');
        let val: unknown = data;
        for (const part of parts) {
          if (val != null && typeof val === 'object' && part in (val as Record<string, unknown>)) {
            val = (val as Record<string, unknown>)[ part ];
          } else {
            val = undefined;
            break;
          }
        }
        if (val !== undefined) {
          resolvedFields[ formField ] = val;
        }
      }
      if (Object.keys(resolvedFields).length > 0) {
        callbacks.onFieldUpdate(resolvedFields);
      }
    }

    // 5. Standard Callback + Close
    callbacks.onSuccess?.(data);
    callbacks.onClose?.();
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  private async handleError(
    error: unknown,
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

        if (!this.shouldSkipNotification(config, 'error')) {
          this.deps.notifyError('Please fix validation errors');
        }
        return; // Keep form/modal open for correction
      }

      // Apply 429 Retry-After as dynamic cooldown (overrides static throttle config)
      if (errorResult.retryAfterMs && config.apiConfig.apiUrl) {
        const opKey = config.apiConfig.apiUrl;
        OperationExecutor.cooldowns.set(opKey, Date.now() + errorResult.retryAfterMs);
      }

      // Generic errors
      if (!this.shouldSkipNotification(config, 'error')) {
        const errorMsg = errorResult.retryAfterMs
          ? `Rate limited. Please wait ${Math.ceil(errorResult.retryAfterMs / 1000)}s before retrying.`
          : errorResult.errorMessage;
        this.sendNotification('error', config, error, errorMsg);
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
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxAttempts;
        const status = getErrorStatus(error);
        const isRetryable = status !== undefined && retryableStatuses.includes(status);

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        // Calculate delay with exponential or linear backoff
        const delay = backoff === 'exponential'
          ? delayMs * Math.pow(2, attempt - 1)
          : delayMs * attempt;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Unreachable: the loop always either returns (success) or throws (last attempt / non-retryable).
    // TypeScript needs this for the return type; keep as a safeguard.
    throw new Error('Retry logic failed unexpectedly');
  }

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  private navigateToUrl(url: string, options?: IRedirectOptions): void {
    navigateToUrl(url, this.deps.navigate, options);
  }

  // ==========================================================================
  // NOTIFICATION HELPERS
  // ==========================================================================

  private shouldSkipNotification(config: OperationConfig, level: 'success' | 'error'): boolean {
    // Legacy props take precedence for backward compatibility
    if (level === 'success' && config.skipSuccessToast) return true;
    if (level === 'error' && config.skipErrorToast) return true;

    const skip = config.notification?.skip;
    if (skip === true) return true;
    if (skip === level) return true;
    return false;
  }

  private sendNotification(
    level: 'success' | 'error',
    config: OperationConfig,
    context: any,
    defaultMessage: string
  ): void {
    const notifConfig = config.notification?.[ level ];

    // If notification config exists with explicit type/description, use the rich notify
    if (notifConfig && (notifConfig.type === 'notification' || notifConfig.description)) {
      const message = this.evaluateMessage(
        notifConfig.message || (level === 'success' ? config.successMessage : config.errorMessage),
        context,
        defaultMessage,
      );
      const description = notifConfig.description
        ? this.evaluateMessage(notifConfig.description, context, '')
        : undefined;

      this.deps.notify(level, {
        message,
        description: description || undefined,
        type: notifConfig.type || 'message',
        duration: notifConfig.duration,
        placement: notifConfig.placement,
      });
      return;
    }

    // Fallback to simple toast (backward compatible)
    const template = notifConfig?.message || (level === 'success' ? config.successMessage : config.errorMessage);
    const message = this.evaluateMessage(template, context, defaultMessage);

    if (level === 'success') {
      this.deps.notifySuccess(message);
    } else {
      this.deps.notifyError(message);
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

  private isCancellationError(error: unknown): boolean {
    if (error == null || typeof error !== 'object') return false;
    const name = (error as { name?: string }).name;
    return name === 'AbortError' || name === 'CanceledError';
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * React hook for using OperationExecutor in components
 * Automatically injects global response modal from context and current modal depth for proper z-index
 */
export function useOperationExecutor(): OperationExecutor {
  const { callApiMethod } = useApi();
  const { notifySuccess, notifyError, notify } = useAppContext();
  const navigate = useCoreNavigator();
  const { showResponseModal } = useResponseModalContext();
  const evaluationContext = useNewEvaluationContext();
  const modalDepth = useContext(ModalDepthContext);

  return useMemo(() => {
    return new OperationExecutor({
      navigate,
      callApiMethod,
      notifySuccess,
      notifyError,
      notify,
      showResponseModal,
      modalDepth,
      evaluationContext,
    });
  }, [ navigate, callApiMethod, notifySuccess, notifyError, notify, showResponseModal, modalDepth, evaluationContext ]);
}