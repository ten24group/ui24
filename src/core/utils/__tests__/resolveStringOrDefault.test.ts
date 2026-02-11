/**
 * Tests for resolveStringOrDefault utility.
 */
import { resolveStringOrDefault, ConditionalValue } from '../../types/evaluation';

describe('resolveStringOrDefault', () => {
  it('returns the string directly when value is a string', () => {
    expect(resolveStringOrDefault('hello')).toBe('hello');
  });

  it('returns empty string for empty string input', () => {
    expect(resolveStringOrDefault('')).toBe('');
  });

  it('returns fallback for undefined', () => {
    expect(resolveStringOrDefault(undefined)).toBe('');
    expect(resolveStringOrDefault(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback for null', () => {
    expect(resolveStringOrDefault(null)).toBe('');
    expect(resolveStringOrDefault(null, 'N/A')).toBe('N/A');
  });

  it('returns default value from ConditionalValue', () => {
    const cv: ConditionalValue<string> = {
      rules: [
        { when: { actor: { groups: { inList: ['admin'] } } }, value: 'Admin Label' },
      ],
      default: 'Default Label',
    };
    expect(resolveStringOrDefault(cv)).toBe('Default Label');
  });

  it('returns default from ConditionalValue with empty rules', () => {
    const cv: ConditionalValue<string> = {
      rules: [],
      default: 'Empty Rules Default',
    };
    expect(resolveStringOrDefault(cv)).toBe('Empty Rules Default');
  });

  it('returns custom fallback when value is not a string or ConditionalValue', () => {
    // Edge case: a plain object that isn't a valid ConditionalValue
    expect(resolveStringOrDefault({ foo: 'bar' } as any, 'fallback')).toBe('fallback');
  });

  it('handles ConditionalValue with empty default', () => {
    const cv: ConditionalValue<string> = {
      rules: [{ when: true, value: 'Active' }],
      default: '',
    };
    expect(resolveStringOrDefault(cv)).toBe('');
  });
});
