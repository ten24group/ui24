/**
 * Tests for useEvaluatedItems hook.
 */
import { renderHook } from '@testing-library/react';
import { useEvaluatedItems } from '../useEvaluatedItems';
import type { NewEvaluationContext, Condition } from '../../types/evaluation';

const mockContext: NewEvaluationContext = {
  actor: { actorId: 'user-1', groups: ['admin'], permissions: [], username: 'john', email: 'john@acme.com' },
  featureFlags: { beta: true },
  device: { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },
  pageType: 'list',
  entityName: 'team',
  record: { id: '123', status: 'active', owner: 'alice@acme.com' },
};

jest.mock('../../context/NewEvaluationContext', () => ({
  useNewEvaluationContext: () => mockContext,
}));

// Types for test items
interface TestItem {
  id: string;
  label: string;
  visibility?: Condition;
  enablement?: Condition;
  disabledMessage?: string;
}

describe('useEvaluatedItems', () => {
  describe('basic visibility', () => {
    it('returns all items when no conditions', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Item 1' },
        { id: '2', label: 'Item 2' },
        { id: '3', label: 'Item 3' },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      expect(result.current.visibleItems).toHaveLength(3);
      expect(result.current.visibilityResults).toEqual([true, true, true]);
    });

    it('filters out items with false visibility', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Visible', visibility: true },
        { id: '2', label: 'Hidden', visibility: false },
        { id: '3', label: 'Also Visible' },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      expect(result.current.visibleItems).toHaveLength(2);
      expect(result.current.visibleItems[0]).toEqual(items[0]);
      expect(result.current.visibleItems[1]).toEqual(items[2]);
    });

    it('evaluates inline conditions for visibility', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Admin Only', visibility: { actor: { groups: { inList: ['admin'] } } } },
        { id: '2', label: 'Super Admin', visibility: { actor: { groups: { inList: ['superadmin'] } } } },
        { id: '3', label: 'Everyone' },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      expect(result.current.visibleItems).toHaveLength(2);
      expect(result.current.visibilityResults).toEqual([true, false, true]);
    });
  });

  describe('enablement', () => {
    it('evaluates enablement conditions', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Enabled', enablement: { record: { status: { eq: 'active' } } } },
        { id: '2', label: 'Disabled', enablement: { record: { status: { eq: 'draft' } } } },
        { id: '3', label: 'No Condition' },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      expect(result.current.enablementResults).toEqual([true, false, true]);
    });

    it('getItemProps returns correct disabled state', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Enabled', enablement: { record: { status: { eq: 'active' } } } },
        { id: '2', label: 'Disabled', enablement: { record: { status: { eq: 'draft' } } } },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));

      const props0 = result.current.getItemProps(0);
      expect(props0.conditionDisabled).toBe(false);

      const props1 = result.current.getItemProps(1);
      expect(props1.conditionDisabled).toBe(true);
    });
  });

  describe('disabledMessage', () => {
    it('resolves disabledMessage template for disabled items', () => {
      const items: TestItem[] = [
        {
          id: '1',
          label: 'Disabled Action',
          enablement: { record: { status: { eq: 'draft' } } },
          disabledMessage: 'Contact {record.owner} to enable',
        },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      const props = result.current.getItemProps(0);
      expect(props.conditionDisabled).toBe(true);
      expect(props.conditionDisabledMessage).toBe('Contact alice@acme.com to enable');
    });

    it('returns undefined disabledMessage for enabled items', () => {
      const items: TestItem[] = [
        {
          id: '1',
          label: 'Enabled',
          enablement: { record: { status: { eq: 'active' } } },
          disabledMessage: 'Should not appear',
        },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));
      const props = result.current.getItemProps(0);
      expect(props.conditionDisabled).toBe(false);
      expect(props.conditionDisabledMessage).toBeUndefined();
    });
  });

  describe('getItemProps conditionHidden', () => {
    it('marks items hidden when visibility condition is false', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Visible', visibility: true },
        { id: '2', label: 'Hidden', visibility: false },
      ];
      const { result } = renderHook(() => useEvaluatedItems(items));

      expect(result.current.getItemProps(0).conditionHidden).toBe(false);
      expect(result.current.getItemProps(1).conditionHidden).toBe(true);
    });

    it('does NOT mark items hidden when there is no visibility condition', () => {
      const items: TestItem[] = [{ id: '1', label: 'No Condition' }];
      const { result } = renderHook(() => useEvaluatedItems(items));
      // No visibility condition → conditionHidden should be false
      expect(result.current.getItemProps(0).conditionHidden).toBe(false);
    });
  });

  describe('custom key names', () => {
    it('uses custom visibilityKey', () => {
      interface CustomItem { id: string; show?: Condition }
      const items: CustomItem[] = [
        { id: '1', show: true },
        { id: '2', show: false },
      ];
      const { result } = renderHook(() =>
        useEvaluatedItems(items, { visibilityKey: 'show' })
      );
      expect(result.current.visibleItems).toHaveLength(1);
    });
  });

  describe('additional context', () => {
    it('merges additional context for evaluation', () => {
      const items: TestItem[] = [
        { id: '1', label: 'Record Check', visibility: { record: { status: { eq: 'draft' } } } },
      ];
      const { result } = renderHook(() =>
        useEvaluatedItems(items, {
          additionalContext: { record: { status: 'draft' } },
        })
      );
      expect(result.current.visibleItems).toHaveLength(1);
    });
  });

  describe('empty input', () => {
    it('handles empty items array', () => {
      const { result } = renderHook(() => useEvaluatedItems([]));
      expect(result.current.visibleItems).toEqual([]);
      expect(result.current.visibilityResults).toEqual([]);
      expect(result.current.enablementResults).toEqual([]);
    });
  });
});
