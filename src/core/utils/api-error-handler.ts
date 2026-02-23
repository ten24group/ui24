import { parseValidationErrors, is400ValidationError, AntFieldError } from './validation-errors';

/**
 * Shape of an error with an HTTP status code.
 * Covers both Axios-style errors (status on root or response.status)
 * and plain objects with a status field.
 */
interface ErrorWithStatus {
  status?: number;
  response?: { status?: number };
  message?: string;
}

/**
 * Extract the HTTP status code from an error object (Axios or plain).
 * Returns `undefined` if the error doesn't carry a status code.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (error == null || typeof error !== 'object') return undefined;
  const err = error as ErrorWithStatus;
  return err.status ?? err.response?.status;
}

/**
 * Check if an error represents a specific HTTP status code (e.g., 404).
 * Works with Axios errors, plain response objects, and any error shape
 * that carries `status` or `response.status`.
 *
 * @example
 * ```typescript
 * if (isHttpStatus(error, 404)) {
 *   // Record not found
 * }
 * ```
 */
export function isHttpStatus(error: unknown, status: number): boolean {
  return getErrorStatus(error) === status;
}

/**
 * Format validation errors as user-friendly strings
 * Combines field-level and form-level errors into a single array
 * 
 * @param fieldErrors - Parsed field-level errors from backend
 * @param formErrors - Parsed form-level errors from backend
 * @returns Array of formatted error messages for display
 * 
 * @example
 * ```typescript
 * const formatted = formatValidationErrors(fieldErrors, formErrors);
 * // ["email: Must be valid", "password: Too short", "Invalid request"]
 * ```
 */
export function formatValidationErrors(
  fieldErrors: AntFieldError[], 
  formErrors: string[]
): string[] {
  const allErrors: string[] = [];
  
  // Add form-level errors first (general errors without specific field)
  if (formErrors.length > 0) {
    allErrors.push(...formErrors);
  }
  
  // Add field-level errors with field names for context
  if (fieldErrors.length > 0) {
    fieldErrors.forEach(fieldError => {
      const fieldName = Array.isArray(fieldError.name) 
        ? fieldError.name.join('.') 
        : fieldError.name;
      fieldError.errors.forEach(errorMsg => {
        allErrors.push(`${fieldName}: ${errorMsg}`);
      });
    });
  }
  
  return allErrors;
}

/**
 * Extract error message from API response or exception with proper priority
 * Handles multiple fw24 error response formats consistently
 * 
 * Priority order (details.message is MORE SPECIFIC than top-level message):
 * 1. response.data.details.message (most specific - e.g., "Team deletion is not allowed")
 * 2. response.data.message (generic - e.g., "Internal Server Error")
 * 3. response.message
 * 4. error.response.data.details.message
 * 5. error.response.data.message
 * 6. error.message
 * 7. fallbackMessage
 * 
 * @param errorOrResponse - Error object from catch block or response object from try block
 * @param fallbackMessage - Default message if no error message found
 * @returns Extracted error message string
 * 
 * @example
 * ```typescript
 * // From try block (response with status >= 400)
 * const msg = extractErrorMessage(response, 'Operation failed');
 * 
 * // From catch block (exception)
 * const msg = extractErrorMessage(error, 'Network error');
 * ```
 */
export function extractErrorMessage(
  errorOrResponse: any,
  fallbackMessage: string = 'An error occurred'
): string {
  // Direct response object (from try block: response.status >= 400)
  // Check details.message FIRST as it's more specific
  if (errorOrResponse?.data) {
    return errorOrResponse.data?.details?.message || 
           errorOrResponse.data?.message || 
           errorOrResponse.message || 
           fallbackMessage;
  }
  
  // Exception with response (from catch block: error.response)
  // Check details.message FIRST as it's more specific
  if (errorOrResponse?.response?.data) {
    return errorOrResponse.response.data?.details?.message ||
           errorOrResponse.response.data?.message || 
           errorOrResponse.message || 
           fallbackMessage;
  }
  
  // Plain error or network error without response
  return errorOrResponse?.message || fallbackMessage;
}

/**
 * Result of comprehensive API error handling
 * Contains all information needed for caller to handle errors appropriately
 */
export interface ApiErrorHandlerResult {
  /** True if this is a 400-level validation error with structured field/form errors */
  isValidationError: boolean;
  
  /** Parsed validation errors (only present if isValidationError is true) */
  validationErrors?: {
    fieldErrors: AntFieldError[];
    formErrors: string[];
  };
  
  /** Single error message (first formatted error or extracted message) */
  errorMessage: string;
  
  /** All formatted errors as array (for multiline display or individual rendering) */
  formattedErrors: string[];

  /** Present when the server returned HTTP 429 with a Retry-After header */
  retryAfterMs?: number;
}

/**
 * Comprehensive API error handler for all fw24 error types
 * Handles validation errors (400), client errors (404, 403), server errors (500), and network errors
 * 
 * This is the main function to use for consistent error handling across the application.
 * It extracts and formats errors from fw24's standard error structure and returns
 * structured information for the caller to handle appropriately.
 * 
 * Usage patterns:
 * 
 * **Pattern 1: Simple error display (Details, Widgets, etc.)**
 * ```typescript
 * try {
 *   const response = await callApiMethod({...});
 *   if (response.status >= 400) {
 *     const errorResult = handleApiError(response, 'Failed to load data');
 *     notifyError(errorResult.formattedErrors.join('\n'));
 *   }
 * } catch (error: any) {
 *   const errorResult = handleApiError(error, 'Network error');
 *   notifyError(errorResult.errorMessage);
 * }
 * ```
 * 
 * **Pattern 2: Form with field-level errors**
 * ```typescript
 * const errorResult = handleApiError(response, 'Submission failed');
 * if (errorResult.isValidationError && errorResult.validationErrors) {
 *   form.setFields(errorResult.validationErrors.fieldErrors);
 *   notifyError(errorResult.validationErrors.formErrors.join('; '));
 * } else {
 *   notifyError(errorResult.errorMessage);
 * }
 * ```
 * 
 * **Pattern 3: Modal with conditional behavior**
 * ```typescript
 * const errorResult = handleApiError(response, 'Operation failed');
 * notifyError(errorResult.formattedErrors.join('\n'));
 * // Keep modal open on validation errors, close on others
 * if (!errorResult.isValidationError) {
 *   closeModal();
 * }
 * ```
 * 
 * @param errorOrResponse - Response object (status >= 400) or error exception from catch block
 * @param fallbackMessage - Default message if error extraction fails
 * @returns Structured error information with validation status, messages, and formatted errors
 */
export function handleApiError(
  errorOrResponse: any,
  fallbackMessage: string = 'An error occurred'
): ApiErrorHandlerResult {
  // Extract status and data from either response object or error.response
  const status = errorOrResponse?.status || errorOrResponse?.response?.status;
  const data = errorOrResponse?.data || errorOrResponse?.response?.data;
  
  // Check if this is a validation error with structured field/form errors
  if (is400ValidationError(status, data)) {
    const { fieldErrors, formErrors } = parseValidationErrors(data);
    const formatted = formatValidationErrors(fieldErrors, formErrors);
    
    return {
      isValidationError: true,
      validationErrors: { fieldErrors, formErrors },
      errorMessage: formatted.length > 0 ? formatted[0] : fallbackMessage,
      formattedErrors: formatted.length > 0 ? formatted : [fallbackMessage]
    };
  }
  
  // Non-validation error (404, 403, 500, network error, etc.)
  const errorMessage = extractErrorMessage(errorOrResponse, fallbackMessage);

  // Extract 429 Retry-After header when present
  let retryAfterMs: number | undefined;
  if (status === 429) {
    const headers = errorOrResponse?.headers || errorOrResponse?.response?.headers;
    const retryAfter = headers?.['retry-after'] || headers?.get?.('retry-after');
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed)) {
        // Retry-After as seconds (e.g., "120")
        retryAfterMs = parsed * 1000;
      } else {
        // Retry-After as HTTP-date (e.g., "Wed, 21 Oct 2025 07:28:00 GMT")
        const dateMs = Date.parse(String(retryAfter));
        if (!isNaN(dateMs)) {
          retryAfterMs = Math.max(0, dateMs - Date.now());
        }
      }
    }
  }
  
  return {
    isValidationError: false,
    errorMessage,
    formattedErrors: [errorMessage],
    retryAfterMs,
  };
}

