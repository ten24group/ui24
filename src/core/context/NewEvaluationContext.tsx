/**
 * New evaluation context for the Unified Condition System.
 * 
 * Composes all 5 tiers + app-defined context providers into a single
 * NewEvaluationContext. Always calls all 5 context hooks (no conditional
 * calls — no Rules of Hooks violations).
 * 
 * Uses individual selectors from each context to ensure reference stability.
 * This prevents infinite re-render loops when form/table state providers
 * create new objects on each render.
 * 
 * Reference: CONDITION_SYSTEM_DESIGN.md Section 4.4
 */

import { useMemo, useRef } from 'react';
import { NewEvaluationContext } from '../types/evaluation';
import { useAppStaticContext } from './AppStaticContext';
import { usePageStaticContext } from './PageStaticContext';
import { useFormRecord, useFormValues, useFormIsDirty, useFormIsValid } from './FormStateContext';
import { useTableStateContext } from './TableStateContext';
import { useDetailStateContext } from './DetailStateContext';

/**
 * Deep-compare helper that only returns the new value if it's meaningfully
 * different from the previous one (by JSON stringification).
 * This prevents re-renders when context providers produce structurally
 * identical but referentially different objects.
 */
function useStableValue<T>(value: T): T {
  const ref = useRef(value);
  const prevJson = useRef<string | undefined>(undefined);

  // JSON.stringify(undefined) returns undefined (not a string),
  // so use a fallback to ensure consistent comparison.
  const json = JSON.stringify(value) ?? '__undefined__';
  if (json !== prevJson.current) {
    ref.current = value;
    prevJson.current = json;
  }

  return ref.current;
}

/**
 * Hook to build the new evaluation context from all context layers.
 * 
 * Components using this hook will subscribe to ALL contexts.
 * For better performance in non-evaluation code, use specific context hooks.
 * This hook is primarily for the condition evaluation system.
 */
export function useNewEvaluationContext(): NewEvaluationContext {
  // Always call all 5 hooks (Rules of Hooks safe)
  const appStatic = useAppStaticContext();
  const pageStatic = usePageStaticContext();

  // Use individual selectors for form state (more stable references)
  const formRecord = useFormRecord();
  const formValues = useFormValues();
  const formIsDirty = useFormIsDirty();
  const formIsValid = useFormIsValid();

  const tableState = useTableStateContext();
  const detailState = useDetailStateContext();

  // Stabilize formValues — Ant Design's form.getFieldsValue() returns a new
  // object on every render even when values haven't changed.
  const stableFormValues = useStableValue(formValues);

  const hasFormContext = formRecord !== undefined || (stableFormValues && Object.keys(stableFormValues).length > 0);

  return useMemo((): NewEvaluationContext => {
    return {
      // Tier 1: App static
      actor: appStatic?.actor ?? { actorId: '', groups: [] },
      featureFlags: appStatic?.featureFlags ?? {},
      tenant: appStatic?.tenant,
      device: appStatic?.device ?? { isMobile: false, isTablet: false, isDesktop: true, viewport: 'xl' as const },

      // Tier 2: Page static
      pageType: pageStatic?.pageType,
      entityName: pageStatic?.entityName,
      route: pageStatic?.route ? {
        params: pageStatic.route.routeParams ?? {},
        queryParams: pageStatic.route.queryParams ?? {},
      } : undefined,
      modal: pageStatic?.modal ? {
        depth: pageStatic.modal.depth ?? 0,
        isModal: pageStatic.modal.isInModal ?? false,
      } : undefined,
      queryParams: pageStatic?.route?.queryParams,
      modalDepth: pageStatic?.modal?.depth,

      // Tier 3: Form state (when in a form page)
      ...(hasFormContext && {
        record: formRecord,
        formValues: stableFormValues,
        isDirty: formIsDirty,
        isValid: formIsValid,
      }),

      // Tier 4: Table state (when in a table page)
      ...(tableState && {
        selectedRecords: tableState.selectedRecords,
        filters: tableState.filters,
        searchQuery: tableState.searchQuery,
      }),

      // Tier 5: Detail state (formState.record takes precedence)
      ...(!hasFormContext && detailState && {
        record: detailState.record,
      }),

      // App-defined context providers (merged from AppStaticContext)
      ...(appStatic?.appContext),
    };
  }, [ appStatic, pageStatic, formRecord, stableFormValues, formIsDirty, formIsValid, hasFormContext, tableState, detailState ]);
}
