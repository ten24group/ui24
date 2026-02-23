/**
 * useEvaluatedItems — shared abstraction for condition extraction + batch eval + filter.
 * 
 * Eliminates the duplicated "extract conditions → useConditionBatch → filter/disable"
 * pattern repeated across 10+ components (Form, PageHeader, Table, Details, Accordion,
 * DashboardPage, WizardPage, FilterSegments, addActionUI, useTable).
 * 
 * @example
 * // Simple visibility-only
 * const { visibleItems } = useEvaluatedItems(widgets);
 * 
 * // With enablement + disabledMessage
 * const { visibleItems, getItemProps } = useEvaluatedItems(actions, {
 *   additionalContext: { record, selectedRecords },
 * });
 * 
 * // With custom key names
 * const { visibleItems } = useEvaluatedItems(steps, {
 *   visibilityKey: 'visibility',
 * });
 */

import { useMemo } from 'react';
import { Condition, NewEvaluationContext } from '../types/evaluation';
import { useConditionBatch } from './useConditionBatch';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';
import { resolveDisabledMessage } from '../utils/resolveDisabledMessage';

/** Result shape returned by useEvaluatedItems */
export interface EvaluatedItemsResult<T> {
  /** Per-item visibility results (same length as input items) */
  visibilityResults: boolean[];
  /** Per-item enablement results (same length as input items) */
  enablementResults: boolean[];
  /** Items that passed visibility evaluation */
  visibleItems: T[];
  /** Get condition props for item at original index */
  getItemProps: (index: number) => {
    conditionHidden: boolean;
    conditionDisabled: boolean;
    conditionDisabledMessage?: string;
  };
}

/** Configuration options for useEvaluatedItems */
export interface UseEvaluatedItemsOptions {
  /** Key to extract visibility condition from each item (default: 'visibility') */
  visibilityKey?: string;
  /** Key to extract enablement condition from each item (default: 'enablement') */
  enablementKey?: string;
  /** Key to extract disabledMessage from each item (default: 'disabledMessage') */
  disabledMessageKey?: string;
  /** Additional context merged into evaluation context */
  additionalContext?: Record<string, unknown>;
  /**
   * Entity name for auto-permission inference (#102).
   * When set, actions with `action: 'create'` or `navigateTo` containing '/create'
   * automatically get `permission: '${entityName}:create'` if no explicit permission is set.
   */
  entityName?: string;
}

/**
 * Extract a value from an item by key, handling items as generic objects.
 * Returns undefined if the item doesn't have the key or the value is undefined.
 */
function getItemValue<V>(item: unknown, key: string): V | undefined {
  if (item === null || item === undefined || typeof item !== 'object') return undefined;
  return (item as Record<string, unknown>)[key] as V | undefined;
}

export function useEvaluatedItems<T>(
  items: ReadonlyArray<T>,
  options?: UseEvaluatedItemsOptions
): EvaluatedItemsResult<T> {
  const {
    visibilityKey = 'visibility',
    enablementKey = 'enablement',
    disabledMessageKey = 'disabledMessage',
    additionalContext,
    entityName,
  } = options ?? {};

  // Extract conditions from items, expanding `permission` shorthand (#102)
  const visibilityConditions = useMemo(
    () => items.map(item => {
      const explicit = getItemValue<Condition>(item, visibilityKey);
      let permission = getItemValue<string>(item, 'permission');

      // Auto-permission for create actions (#102)
      if (!permission && entityName) {
        const action = getItemValue<string>(item, 'action');
        const navigateTo = getItemValue<string>(item, 'navigateTo');
        if (action === 'create' || (navigateTo && navigateTo.includes('/create'))) {
          permission = `${entityName}:create`;
        }
      }

      if (!permission) return explicit;
      const permCondition: Condition = { actor: { permissions: { [permission]: { eq: true } } } };
      if (!explicit) return permCondition;
      return { and: [explicit, permCondition] };
    }),
    [items, visibilityKey]
  );

  const enablementConditions = useMemo(
    () => items.map(item => getItemValue<Condition>(item, enablementKey)),
    [items, enablementKey]
  );

  // Batch evaluate
  const visibilityResults = useConditionBatch(visibilityConditions, additionalContext);
  const enablementResults = useConditionBatch(enablementConditions, additionalContext);

  // Get evaluation context for resolving disabledMessage templates
  const evalCtx = useNewEvaluationContext();

  // Merge additional context for template resolution
  const resolveCtx = useMemo((): NewEvaluationContext => {
    if (!additionalContext || Object.keys(additionalContext).length === 0) {
      return evalCtx;
    }
    return { ...evalCtx, ...additionalContext } as NewEvaluationContext;
  }, [evalCtx, additionalContext]);

  // Filter visible items
  const visibleItems = useMemo(
    () => items.filter((_, i) => visibilityResults[i]),
    [items, visibilityResults]
  );

  // Build props getter
  const getItemProps = useMemo(() => {
    // Pre-compute resolved messages for disabled items
    const resolvedMessages: Array<string | undefined> = items.map((item, i) => {
      if (enablementConditions[i] !== undefined && !enablementResults[i]) {
        const rawMsg = getItemValue<string>(item, disabledMessageKey);
        return resolveDisabledMessage(rawMsg, resolveCtx);
      }
      return undefined;
    });

    return (index: number) => ({
      conditionHidden: visibilityConditions[index] !== undefined && !visibilityResults[index],
      conditionDisabled: enablementConditions[index] !== undefined && !enablementResults[index],
      conditionDisabledMessage: resolvedMessages[index],
    });
  }, [items, visibilityConditions, visibilityResults, enablementConditions, enablementResults, disabledMessageKey, resolveCtx]);

  return { visibilityResults, enablementResults, visibleItems, getItemProps };
}
