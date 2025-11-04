/**
 * Validation error utilities for parsing backend validation errors
 * and converting them to Ant Design Form field errors
 */

/**
 * Backend validation error structure (from fw24)
 */
export interface BackendValidationError {
  message?: string;
  messageIds?: string[];
  path?: string[];  // e.g., ["body", "email"] or ["email"]
  expected?: [validationName: string, validationValue: any];
  received?: [received: any, refinedReceived?: any];
  customMessage?: string;
  customMessageId?: string;
}

/**
 * Backend error response structure
 */
export interface BackendErrorResponse {
  message?: string;
  errors?: BackendValidationError[];
  details?: {
    errors?: BackendValidationError[];
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Ant Design form field error structure
 */
export interface AntFieldError {
  name: string | string[];  // Field path (supports nested: ["address", "city"])
  errors: string[];  // Array of error messages for this field
}

/**
 * Parsed validation errors grouped by field
 */
export interface ParsedValidationErrors {
  fieldErrors: AntFieldError[];  // Errors mapped to specific fields
  formErrors: string[];  // General form errors (no specific field)
}

/**
 * Extract field path from backend validation error
 * 
 * Backend path formats:
 * - ["body", "email"] → "email"
 * - ["email"] → "email"
 * - ["body", "address", "city"] → ["address", "city"]
 * - ["query", "sort"] → "sort"
 * - undefined or [] → null (form-level error)
 * 
 * @param path - Backend error path array
 * @returns Field path for Ant Design Form, or null for form-level errors
 */
function extractFieldPath(path: string[] | undefined): string | string[] | null {
  if (!path || path.length === 0) {
    return null;  // Form-level error
  }

  // Remove HTTP request type prefixes (body, query, param, header)
  const httpPrefixes = ['body', 'query', 'param', 'header'];
  let fieldPath = path.filter(segment => !httpPrefixes.includes(segment));

  if (fieldPath.length === 0) {
    return null;  // Only had prefix, no actual field
  }

  // Single field: return as string
  if (fieldPath.length === 1) {
    return fieldPath[0];
  }

  // Nested field: return as array for Ant Design (e.g., ["address", "city"])
  return fieldPath;
}

/**
 * Get user-friendly error message from backend validation error
 * 
 * Priority:
 * 1. customMessage (if provided)
 * 2. message (if provided)
 * 3. Construct from messageIds (future: use i18n)
 * 4. Fallback generic message
 * 
 * @param error - Backend validation error
 * @returns User-friendly error message
 */
function getErrorMessage(error: BackendValidationError): string {
  // Priority 1: Custom message
  if (error.customMessage) {
    return error.customMessage;
  }

  // Priority 2: Direct message
  if (error.message) {
    return error.message;
  }

  // Priority 3: Construct from messageIds (future: i18n lookup)
  if (error.messageIds && error.messageIds.length > 0) {
    // For now, use the last messageId as a fallback
    // Future: Look up in i18n dictionary
    const lastMessageId = error.messageIds[error.messageIds.length - 1];
    return lastMessageId.replace(/\./g, ' ').replace(/_/g, ' ');
  }

  // Priority 4: Fallback
  return 'Validation error';
}

/**
 * Parse backend validation errors into Ant Design Form field errors
 * 
 * This function:
 * 1. Extracts errors from backend response (handles multiple response formats)
 * 2. Groups errors by field path
 * 3. Converts to Ant Design field error format
 * 4. Separates field-level errors from form-level errors
 * 
 * @param errorResponse - Backend error response (from catch block or error response)
 * @returns Parsed validation errors grouped by field and form-level
 */
export function parseValidationErrors(errorResponse: BackendErrorResponse): ParsedValidationErrors {
  const result: ParsedValidationErrors = {
    fieldErrors: [],
    formErrors: [],
  };

  // Extract errors array from various response structures
  let errors: BackendValidationError[] = [];

  if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
    errors = errorResponse.errors;
  } else if (errorResponse.details?.errors && Array.isArray(errorResponse.details.errors)) {
    errors = errorResponse.details.errors;
  }

  if (errors.length === 0) {
    // No structured validation errors, treat as general form error
    if (errorResponse.message) {
      result.formErrors.push(errorResponse.message);
    }
    return result;
  }

  // Group errors by field path
  const fieldErrorMap = new Map<string, string[]>();
  const formErrors: string[] = [];

  for (const error of errors) {
    const fieldPath = extractFieldPath(error.path);
    const errorMessage = getErrorMessage(error);

    if (fieldPath === null) {
      // Form-level error (no specific field)
      formErrors.push(errorMessage);
    } else {
      // Field-level error
      const fieldKey = Array.isArray(fieldPath) ? fieldPath.join('.') : fieldPath;
      
      if (!fieldErrorMap.has(fieldKey)) {
        fieldErrorMap.set(fieldKey, []);
      }
      fieldErrorMap.get(fieldKey)!.push(errorMessage);
    }
  }

  // Convert to Ant Design format
  for (const [fieldKey, messages] of Array.from(fieldErrorMap.entries())) {
    const fieldPath = fieldKey.includes('.') ? fieldKey.split('.') : fieldKey;
    result.fieldErrors.push({
      name: fieldPath,
      errors: messages,
    });
  }

  result.formErrors = formErrors;

  return result;
}

/**
 * Check if an error response contains validation errors
 * 
 * @param errorResponse - Error response from API
 * @returns True if response contains validation errors
 */
export function isValidationError(errorResponse: any): errorResponse is BackendErrorResponse {
  if (!errorResponse) return false;

  // Check for errors array in common locations
  const hasErrors = 
    (Array.isArray(errorResponse.errors) && errorResponse.errors.length > 0) ||
    (errorResponse.details?.errors && Array.isArray(errorResponse.details.errors) && errorResponse.details.errors.length > 0);

  return hasErrors;
}

/**
 * Check if error response is a 400 validation error
 * 
 * @param status - HTTP status code
 * @param errorResponse - Error response from API
 * @returns True if this is a 400 validation error
 */
export function is400ValidationError(status: number, errorResponse: any): boolean {
  return status === 400 && isValidationError(errorResponse);
}

