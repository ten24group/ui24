/**
 * Tests for useCondition hook.
 * 
 * Mocks useNewEvaluationContext to provide a stable context,
 * then tests the hook's sync/async evaluation behavior.
 */
import { renderHook, act } from '@testing-library/react';
import { useCondition } from '../useCondition';
import type { NewEvaluationContext, Condition } from '../../types/evaluation';
import { CustomEvaluatorRegistry } from '../../utils/CustomEvaluatorRegistry';

// Mock the context hook to return a controlled context
const mockContext: NewEvaluationContext = {
  actor: { actorId: 'user-1', groups: ['admin'], permissions: [], username: 'john', email: 'john@acme.com' },
  featureFlags: { beta: true, legacyMode: false },
  device: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },
  pageType: 'list',
  entityName: 'team',
  record: { id: '123', status: 'active', ownerId: 'user-1' },
  formValues: { name: 'Test Team', isEnterprise: true },
};

jest.mock('../../context/NewEvaluationContext', () => ({
  useNewEvaluationContext: () => mockContext,
}));

describe('useCondition', () => {
  afterEach(() => {
    CustomEvaluatorRegistry.clear();
  });

  describe('undefined/null/boolean conditions', () => {
    it('returns true for undefined condition', () => {
      const { result } = renderHook(() => useCondition(undefined));
      expect(result.current).toBe(true);
    });

    it('returns true for boolean true', () => {
      const { result } = renderHook(() => useCondition(true));
      expect(result.current).toBe(true);
    });

    it('returns false for boolean false', () => {
      const { result } = renderHook(() => useCondition(false));
      expect(result.current).toBe(false);
    });
  });

  describe('inline conditions', () => {
    it('evaluates actor condition (true)', () => {
      const condition: Condition = { actor: { groups: { inList: ['admin'] } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates actor condition (false)', () => {
      const condition: Condition = { actor: { groups: { inList: ['superadmin'] } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(false);
    });

    it('evaluates record condition', () => {
      const condition: Condition = { record: { status: { eq: 'active' } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates formValues condition', () => {
      const condition: Condition = { formValues: { isEnterprise: { eq: true } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates featureFlags condition', () => {
      const condition: Condition = { featureFlags: { beta: { eq: true } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates device condition', () => {
      const condition: Condition = { device: { isDesktop: { eq: true } } };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });
  });

  describe('logical operators', () => {
    it('evaluates AND (all true)', () => {
      const condition: Condition = {
        and: [
          { actor: { groups: { inList: ['admin'] } } },
          { record: { status: { eq: 'active' } } },
        ],
      };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates AND (one false)', () => {
      const condition: Condition = {
        and: [
          { actor: { groups: { inList: ['admin'] } } },
          { record: { status: { eq: 'archived' } } },
        ],
      };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(false);
    });

    it('evaluates OR', () => {
      const condition: Condition = {
        or: [
          { actor: { groups: { inList: ['superadmin'] } } },
          { record: { status: { eq: 'active' } } },
        ],
      };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });

    it('evaluates NOT', () => {
      const condition: Condition = {
        not: { record: { status: { eq: 'archived' } } },
      };
      const { result } = renderHook(() => useCondition(condition));
      expect(result.current).toBe(true);
    });
  });

  describe('additionalContext', () => {
    it('merges additional context', () => {
      const condition: Condition = { record: { status: { eq: 'draft' } } };
      const { result } = renderHook(() =>
        useCondition(condition, { record: { status: 'draft' } })
      );
      expect(result.current).toBe(true);
    });
  });

  describe('custom (async) conditions', () => {
    it('returns false initially for custom condition, then resolves', async () => {
      CustomEvaluatorRegistry.register('checkAccess', () => Promise.resolve(true));

      const condition: Condition = { custom: 'checkAccess' };
      const { result } = renderHook(() => useCondition(condition));

      // Initially false (fail-safe while async is in-flight)
      expect(result.current).toBe(false);

      // Wait for async to resolve
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current).toBe(true);
    });

    it('returns false for unregistered custom evaluator', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const condition: Condition = { custom: 'nonExistentEvaluator' };
      const { result } = renderHook(() => useCondition(condition));

      // Initially false
      expect(result.current).toBe(false);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Still false (unregistered = false)
      expect(result.current).toBe(false);
      (console.warn as jest.Mock).mockRestore();
    });
  });
});
