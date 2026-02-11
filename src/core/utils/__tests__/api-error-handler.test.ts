/**
 * Tests for core/utils/api-error-handler.ts
 * 
 * The API error handler is the centralized error processing layer for all
 * API operations. It consistently handles:
 * - 400 validation errors (with field-level and form-level errors)
 * - Client errors (404, 403)
 * - Server errors (500)
 * - Network errors (no response)
 * - fw24 error response formats (details.message vs top-level message)
 */

import { handleApiError, extractErrorMessage, formatValidationErrors } from '../api-error-handler';

// ============================================================================
// extractErrorMessage
// ============================================================================

describe('extractErrorMessage', () => {
  it('extracts details.message from direct response (highest priority)', () => {
    const response = {
      data: {
        message: 'Internal Server Error',
        details: { message: 'Team deletion is not allowed' },
      },
    };
    expect(extractErrorMessage(response)).toBe('Team deletion is not allowed');
  });

  it('falls back to data.message', () => {
    const response = {
      data: { message: 'Something went wrong' },
    };
    expect(extractErrorMessage(response)).toBe('Something went wrong');
  });

  it('extracts from error.response.data (catch block errors)', () => {
    const error = {
      response: {
        data: {
          details: { message: 'Not authorized' },
          message: 'Forbidden',
        },
      },
      message: 'Request failed with status code 403',
    };
    expect(extractErrorMessage(error)).toBe('Not authorized');
  });

  it('falls back to error.message for network errors', () => {
    const error = { message: 'Network Error' };
    expect(extractErrorMessage(error)).toBe('Network Error');
  });

  it('uses fallback message when no error info available', () => {
    expect(extractErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
    expect(extractErrorMessage(null, 'Fallback')).toBe('Fallback');
  });

  it('uses default fallback message', () => {
    expect(extractErrorMessage(null)).toBe('An error occurred');
  });
});

// ============================================================================
// formatValidationErrors
// ============================================================================

describe('formatValidationErrors', () => {
  it('formats field errors with field names', () => {
    const fieldErrors = [
      { name: 'email', errors: ['Must be valid'] },
      { name: 'password', errors: ['Too short'] },
    ];
    const result = formatValidationErrors(fieldErrors, []);
    expect(result).toEqual(['email: Must be valid', 'password: Too short']);
  });

  it('formats nested field paths', () => {
    const fieldErrors = [
      { name: ['address', 'city'], errors: ['Required'] },
    ];
    const result = formatValidationErrors(fieldErrors, []);
    expect(result).toEqual(['address.city: Required']);
  });

  it('includes form-level errors first', () => {
    const fieldErrors = [{ name: 'email', errors: ['Invalid'] }];
    const formErrors = ['Request failed'];
    const result = formatValidationErrors(fieldErrors, formErrors);
    expect(result).toEqual(['Request failed', 'email: Invalid']);
  });

  it('handles empty inputs', () => {
    expect(formatValidationErrors([], [])).toEqual([]);
  });

  it('handles multiple errors per field', () => {
    const fieldErrors = [
      { name: 'password', errors: ['Too short', 'Must contain number'] },
    ];
    const result = formatValidationErrors(fieldErrors, []);
    expect(result).toEqual(['password: Too short', 'password: Must contain number']);
  });
});

// ============================================================================
// handleApiError
// ============================================================================

describe('handleApiError', () => {
  it('identifies validation errors (400 with structured errors)', () => {
    const response = {
      status: 400,
      data: {
        errors: [
          { path: ['body', 'email'], message: 'Must be valid email' },
          { path: ['body', 'name'], message: 'Required' },
        ],
      },
    };

    const result = handleApiError(response);

    expect(result.isValidationError).toBe(true);
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors!.fieldErrors).toHaveLength(2);
    expect(result.formattedErrors).toContain('email: Must be valid email');
    expect(result.formattedErrors).toContain('name: Required');
  });

  it('handles non-validation errors (404)', () => {
    const response = {
      status: 404,
      data: {
        message: 'Resource not found',
        details: { message: 'Team with ID 123 not found' },
      },
    };

    const result = handleApiError(response);
    expect(result.isValidationError).toBe(false);
    expect(result.errorMessage).toBe('Team with ID 123 not found');
    expect(result.formattedErrors).toEqual(['Team with ID 123 not found']);
  });

  it('handles server errors (500)', () => {
    const response = {
      status: 500,
      data: { message: 'Internal Server Error' },
    };

    const result = handleApiError(response);
    expect(result.isValidationError).toBe(false);
    expect(result.errorMessage).toBe('Internal Server Error');
  });

  it('handles network errors (no response)', () => {
    const error = { message: 'Network Error' };
    const result = handleApiError(error);
    expect(result.isValidationError).toBe(false);
    expect(result.errorMessage).toBe('Network Error');
  });

  it('handles catch-block errors with response property', () => {
    const error = {
      response: {
        status: 400,
        data: {
          errors: [{ path: ['body', 'name'], message: 'Required' }],
        },
      },
      message: 'Request failed',
    };

    const result = handleApiError(error);
    expect(result.isValidationError).toBe(true);
    expect(result.validationErrors!.fieldErrors).toHaveLength(1);
  });

  it('uses fallback message when error has no data', () => {
    const result = handleApiError({}, 'Custom fallback');
    expect(result.isValidationError).toBe(false);
    expect(result.errorMessage).toBe('Custom fallback');
  });

  it('uses default fallback message', () => {
    const result = handleApiError(null);
    expect(result.errorMessage).toBe('An error occurred');
  });

  it('handles 400 without structured errors as non-validation error', () => {
    const response = {
      status: 400,
      data: { message: 'Bad Request' },
    };

    const result = handleApiError(response);
    expect(result.isValidationError).toBe(false);
    expect(result.errorMessage).toBe('Bad Request');
  });

  it('returns first formatted error as errorMessage', () => {
    const response = {
      status: 400,
      data: {
        errors: [
          { path: ['body', 'email'], message: 'Invalid' },
          { path: ['body', 'name'], message: 'Required' },
        ],
      },
    };

    const result = handleApiError(response);
    expect(result.errorMessage).toBe(result.formattedErrors[0]);
  });
});
