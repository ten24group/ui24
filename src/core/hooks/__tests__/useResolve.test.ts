/**
 * Tests for useResolve and useResolveBatch hooks.
 */
import { renderHook } from '@testing-library/react';
import { useResolve } from '../useResolve';
import { useResolveBatch } from '../useResolveBatch';
import type { NewEvaluationContext, ConditionalValue } from '../../types/evaluation';

const mockContext: NewEvaluationContext = {
  actor: { actorId: 'user-1', groups: ['admin'], permissions: [], username: 'john', email: 'john@acme.com' },
  featureFlags: { richText: true, newUI: false },
  device: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },
  pageType: 'form',
  entityName: 'product',
};

jest.mock('../../context/NewEvaluationContext', () => ({
  useNewEvaluationContext: () => mockContext,
}));

describe('useResolve', () => {
  it('returns undefined for undefined input', () => {
    const { result } = renderHook(() => useResolve<string>(undefined));
    expect(result.current).toBeUndefined();
  });

  it('returns plain string value as-is', () => {
    const { result } = renderHook(() => useResolve<string>('TextInput'));
    expect(result.current).toBe('TextInput');
  });

  it('returns plain number value as-is', () => {
    const { result } = renderHook(() => useResolve<number>(42));
    expect(result.current).toBe(42);
  });

  it('resolves ConditionalValue — first matching rule', () => {
    const cv: ConditionalValue<string> = {
      rules: [
        { when: { featureFlags: { richText: { eq: true } } }, value: 'RichTextEditor' },
        { when: { device: { isMobile: { eq: true } } }, value: 'SimpleTextArea' },
      ],
      default: 'TextInput',
    };
    const { result } = renderHook(() => useResolve<string>(cv));
    expect(result.current).toBe('RichTextEditor');
  });

  it('resolves ConditionalValue — falls through to default', () => {
    const cv: ConditionalValue<string> = {
      rules: [
        { when: { featureFlags: { newUI: { eq: true } } }, value: 'NewRenderer' },
      ],
      default: 'LegacyRenderer',
    };
    const { result } = renderHook(() => useResolve<string>(cv));
    expect(result.current).toBe('LegacyRenderer');
  });

  it('resolves ConditionalValue — with empty rules', () => {
    const cv: ConditionalValue<string> = {
      rules: [],
      default: 'DefaultRenderer',
    };
    const { result } = renderHook(() => useResolve<string>(cv));
    expect(result.current).toBe('DefaultRenderer');
  });

  it('resolves ConditionalValue with device condition', () => {
    const cv: ConditionalValue<string> = {
      rules: [
        { when: { device: { isDesktop: { eq: true } } }, value: 'DesktopLayout' },
      ],
      default: 'MobileLayout',
    };
    const { result } = renderHook(() => useResolve<string>(cv));
    expect(result.current).toBe('DesktopLayout');
  });
});

describe('useResolveBatch', () => {
  it('returns empty array for empty input', () => {
    const { result } = renderHook(() => useResolveBatch<string>([]));
    expect(result.current).toEqual([]);
  });

  it('returns plain values as-is', () => {
    const { result } = renderHook(() =>
      useResolveBatch<string>(['TextInput', 'Select', 'DatePicker'])
    );
    expect(result.current).toEqual(['TextInput', 'Select', 'DatePicker']);
  });

  it('resolves mixed plain and ConditionalValue', () => {
    const values: Array<string | ConditionalValue<string> | undefined> = [
      'TextInput',
      {
        rules: [{ when: { featureFlags: { richText: { eq: true } } }, value: 'RichTextEditor' }],
        default: 'TextArea',
      },
      undefined,
      'Select',
    ];
    const { result } = renderHook(() => useResolveBatch<string>(values));
    expect(result.current).toEqual(['TextInput', 'RichTextEditor', undefined, 'Select']);
  });

  it('handles all undefined values', () => {
    const { result } = renderHook(() =>
      useResolveBatch<string>([undefined, undefined])
    );
    expect(result.current).toEqual([undefined, undefined]);
  });
});
