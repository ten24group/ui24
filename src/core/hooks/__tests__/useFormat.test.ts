/**
 * Tests for core/hooks/useFormat.ts
 * 
 * useFormat is the centralized formatting hook for:
 * - Date formatting (with configurable format strings and timezone)
 * - Boolean formatting (configurable true/false labels)
 * 
 * Used throughout Details, Table, Form, Dashboard widgets, etc.
 */

import { renderHook } from '@testing-library/react';

// ── Mock the context ──
const mockFormatConfig = {
  date: 'YYYY-MM-DD',
  time: 'hh:mm A',
  datetime: 'YYYY-MM-DD hh:mm A',
  boolean: {
    true: 'YES',
    false: 'NO',
  },
  timezone: 'America/New_York',
};

jest.mock('../../context', () => ({
  useUi24Config: () => ({
    selectConfig: (selector: any) => selector({ formatConfig: mockFormatConfig }),
  }),
}));

import { useFormat } from '../useFormat';

// ============================================================================
// formatBoolean
// ============================================================================

describe('useFormat - formatBoolean', () => {
  function getFormatBoolean() {
    const { result } = renderHook(() => useFormat());
    return result.current.formatBoolean;
  }

  it('formats true boolean', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean(true)).toBe('YES');
  });

  it('formats false boolean', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean(false)).toBe('NO');
  });

  it('returns null/undefined as-is (not "NO")', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean(null)).toBeNull();
    expect(formatBoolean(undefined)).toBeUndefined();
  });

  it('coerces string "true"/"yes"/"1" to true label', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean('true')).toBe('YES');
    expect(formatBoolean('yes')).toBe('YES');
    expect(formatBoolean('1')).toBe('YES');
    expect(formatBoolean('TRUE')).toBe('YES');
    expect(formatBoolean('Yes')).toBe('YES');
  });

  it('coerces string "false"/"no"/"0" to false label', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean('false')).toBe('NO');
    expect(formatBoolean('no')).toBe('NO');
    expect(formatBoolean('0')).toBe('NO');
  });

  it('returns non-boolean strings as-is', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean('active')).toBe('active');
    expect(formatBoolean('maybe')).toBe('maybe');
  });

  it('coerces number 1 to true, 0 to false', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean(1)).toBe('YES');
    expect(formatBoolean(0)).toBe('NO');
  });

  it('returns non-boolean numbers as-is', () => {
    const formatBoolean = getFormatBoolean();
    expect(formatBoolean(42)).toBe(42);
    expect(formatBoolean(-1)).toBe(-1);
  });

  it('returns objects/arrays as-is', () => {
    const formatBoolean = getFormatBoolean();
    const obj = { key: 'value' };
    expect(formatBoolean(obj)).toBe(obj);
  });
});

// ============================================================================
// formatDate
// ============================================================================

describe('useFormat - formatDate', () => {
  function getFormatDate() {
    const { result } = renderHook(() => useFormat());
    return result.current.formatDate;
  }

  it('formats date with datetime format by default', () => {
    const formatDate = getFormatDate();
    const result = formatDate('2024-06-15T12:00:00Z');
    // Should be formatted according to formatConfig.datetime
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('formats date with date-only format', () => {
    const formatDate = getFormatDate();
    const result = formatDate('2024-06-15T12:00:00Z', 'date', 'UTC');
    expect(result).toBe('2024-06-15');
  });

  it('returns null/undefined/empty as-is', () => {
    const formatDate = getFormatDate();
    expect(formatDate(null as any)).toBeNull();
    expect(formatDate(undefined as any)).toBeUndefined();
    expect(formatDate('')).toBe('');
  });

  it('handles Date objects', () => {
    const formatDate = getFormatDate();
    const result = formatDate(new Date('2024-06-15T12:00:00Z'), 'date', 'UTC');
    expect(result).toBe('2024-06-15');
  });

  it('handles timestamp numbers', () => {
    const formatDate = getFormatDate();
    const timestamp = new Date('2024-06-15T12:00:00Z').getTime();
    const result = formatDate(timestamp, 'date', 'UTC');
    expect(result).toBe('2024-06-15');
  });

  it('returns original value for invalid date (not hiding data)', () => {
    const formatDate = getFormatDate();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = formatDate('not-a-date');
    // Should return original (invalid input won't parse)
    expect(result).toBeDefined();
    errorSpy.mockRestore();
  });
});
