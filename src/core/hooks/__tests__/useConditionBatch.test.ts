/**
 * Tests for useConditionBatch hook.
 */
import { renderHook } from '@testing-library/react';
import { useConditionBatch } from '../useConditionBatch';
import type { NewEvaluationContext, Condition } from '../../types/evaluation';

const mockContext: NewEvaluationContext = {
  actor: { actorId: 'user-1', groups: ['admin', 'editor'], permissions: [], username: 'john', email: 'john@acme.com' },
  featureFlags: { beta: true, darkMode: false },
  device: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },
  pageType: 'form',
  entityName: 'product',
  record: { id: '1', status: 'active', category: 'electronics' },
  formValues: { name: 'Widget', price: 100, isPublished: true },
};

jest.mock('../../context/NewEvaluationContext', () => ({
  useNewEvaluationContext: () => mockContext,
}));

describe('useConditionBatch', () => {
  it('returns all true for empty conditions array', () => {
    const { result } = renderHook(() => useConditionBatch([]));
    expect(result.current).toEqual([]);
  });

  it('returns true for undefined conditions', () => {
    const conditions: Array<Condition | undefined> = [undefined, undefined, undefined];
    const { result } = renderHook(() => useConditionBatch(conditions));
    expect(result.current).toEqual([true, true, true]);
  });

  it('evaluates boolean literals', () => {
    const conditions: Condition[] = [true, false, true];
    const { result } = renderHook(() => useConditionBatch(conditions));
    expect(result.current).toEqual([true, false, true]);
  });

  it('evaluates mixed conditions', () => {
    const conditions: Array<Condition | undefined> = [
      undefined,                                                  // no condition → true
      { actor: { groups: { inList: ['admin'] } } },             // admin → true
      { actor: { groups: { inList: ['superadmin'] } } },        // not superadmin → false
      { record: { status: { eq: 'active' } } },                 // active → true
      { formValues: { price: { gt: 200 } } },                   // 100 > 200 → false
      { featureFlags: { beta: { eq: true } } },                 // beta=true → true
      false,                                                      // literal false
    ];
    const { result } = renderHook(() => useConditionBatch(conditions));
    expect(result.current).toEqual([true, true, false, true, false, true, false]);
  });

  it('evaluates with additional context', () => {
    const conditions: Array<Condition | undefined> = [
      { record: { status: { eq: 'draft' } } },
    ];
    const { result } = renderHook(() =>
      useConditionBatch(conditions, { record: { status: 'draft' } })
    );
    expect(result.current).toEqual([true]);
  });

  it('returns false for custom (async) conditions (sync-only batch)', () => {
    const conditions: Array<Condition | undefined> = [
      { custom: 'someAsyncCheck' },
    ];
    const { result } = renderHook(() => useConditionBatch(conditions));
    expect(result.current).toEqual([false]);
  });

  it('evaluates logical operators in batch', () => {
    const conditions: Condition[] = [
      { and: [
        { actor: { groups: { inList: ['admin'] } } },
        { record: { status: { eq: 'active' } } },
      ]},
      { or: [
        { actor: { groups: { inList: ['superadmin'] } } },
        { record: { status: { eq: 'active' } } },
      ]},
      { not: { formValues: { isPublished: { eq: false } } } },
    ];
    const { result } = renderHook(() => useConditionBatch(conditions));
    expect(result.current).toEqual([true, true, true]);
  });
});
