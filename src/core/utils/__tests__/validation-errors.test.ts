/**
 * Tests for core/utils/validation-errors.ts
 * 
 * The validation error system parses fw24 backend error responses
 * into Ant Design Form field errors. This is critical for:
 * - Form submission error handling
 * - Field-level error display
 * - Form-level error messages
 */

import {
  parseValidationErrors,
  isValidationError,
  is400ValidationError,
} from '../validation-errors';

// ============================================================================
// parseValidationErrors
// ============================================================================

describe('parseValidationErrors', () => {
  it('parses field errors from errors array', () => {
    const response = {
      errors: [
        { path: ['body', 'email'], message: 'Must be valid email' },
        { path: ['body', 'password'], message: 'Too short' },
      ],
    };

    const result = parseValidationErrors(response);

    expect(result.fieldErrors).toEqual([
      { name: 'email', errors: ['Must be valid email'] },
      { name: 'password', errors: ['Too short'] },
    ]);
    expect(result.formErrors).toEqual([]);
  });

  it('parses field errors from details.errors array', () => {
    const response = {
      details: {
        errors: [
          { path: ['body', 'name'], message: 'Required' },
        ],
      },
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([
      { name: 'name', errors: ['Required'] },
    ]);
  });

  it('groups multiple errors for same field', () => {
    const response = {
      errors: [
        { path: ['body', 'password'], message: 'Too short' },
        { path: ['body', 'password'], message: 'Must contain a number' },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([
      { name: 'password', errors: ['Too short', 'Must contain a number'] },
    ]);
  });

  it('handles nested field paths (e.g. address.city)', () => {
    const response = {
      errors: [
        { path: ['body', 'address', 'city'], message: 'Required' },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([
      { name: ['address', 'city'], errors: ['Required'] },
    ]);
  });

  it('handles form-level errors (no path)', () => {
    const response = {
      errors: [
        { message: 'Invalid request' },
        { path: [], message: 'Something went wrong' },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([]);
    expect(result.formErrors).toEqual(['Invalid request', 'Something went wrong']);
  });

  it('falls back to response.message when no errors array', () => {
    const response = {
      message: 'Validation failed',
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([]);
    expect(result.formErrors).toEqual(['Validation failed']);
  });

  it('uses customMessage with highest priority', () => {
    const response = {
      errors: [
        { path: ['body', 'email'], message: 'Generic', customMessage: 'Please use your work email' },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors[0].errors).toEqual(['Please use your work email']);
  });

  it('falls back to messageIds when no message/customMessage', () => {
    const response = {
      errors: [
        { path: ['body', 'email'], messageIds: ['validation.email.invalid'] },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors[0].errors).toEqual(['validation email invalid']);
  });

  it('falls back to generic message when no message data', () => {
    const response = {
      errors: [
        { path: ['body', 'email'] },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors[0].errors).toEqual(['Validation error']);
  });

  it('strips HTTP prefixes from paths', () => {
    const response = {
      errors: [
        { path: ['query', 'sort'], message: 'Invalid sort field' },
        { path: ['param', 'id'], message: 'Not found' },
        { path: ['header', 'authorization'], message: 'Missing' },
      ],
    };

    const result = parseValidationErrors(response);
    expect(result.fieldErrors).toEqual([
      { name: 'sort', errors: ['Invalid sort field'] },
      { name: 'id', errors: ['Not found'] },
      { name: 'authorization', errors: ['Missing'] },
    ]);
  });

  it('returns empty results for empty response', () => {
    const result = parseValidationErrors({});
    expect(result.fieldErrors).toEqual([]);
    expect(result.formErrors).toEqual([]);
  });
});

// ============================================================================
// isValidationError
// ============================================================================

describe('isValidationError', () => {
  it('returns true for response with errors array', () => {
    expect(isValidationError({ errors: [{ message: 'Error' }] })).toBe(true);
  });

  it('returns true for response with details.errors array', () => {
    expect(isValidationError({ details: { errors: [{ message: 'Error' }] } })).toBe(true);
  });

  it('returns falsy for empty errors array', () => {
    expect(isValidationError({ errors: [] })).toBeFalsy();
  });

  it('returns falsy for null/undefined', () => {
    expect(isValidationError(null)).toBeFalsy();
    expect(isValidationError(undefined)).toBeFalsy();
  });

  it('returns falsy for response without errors', () => {
    expect(isValidationError({ message: 'Error' })).toBeFalsy();
  });
});

// ============================================================================
// is400ValidationError
// ============================================================================

describe('is400ValidationError', () => {
  it('returns true for status 400 with validation errors', () => {
    expect(is400ValidationError(400, { errors: [{ message: 'Error' }] })).toBe(true);
  });

  it('returns false for non-400 status', () => {
    expect(is400ValidationError(404, { errors: [{ message: 'Error' }] })).toBe(false);
    expect(is400ValidationError(500, { errors: [{ message: 'Error' }] })).toBe(false);
  });

  it('returns falsy for 400 without validation errors', () => {
    expect(is400ValidationError(400, { message: 'Bad Request' })).toBeFalsy();
  });
});
