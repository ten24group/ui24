/**
 * Evaluation context for universal visibility/enablement system.
 * 
 * UPDATED: Now integrates with use-context-selector based contexts:
 * - Tier 1: AppStaticContext (actor, tenant, device, featureFlags)
 * - Tier 2: PageStaticContext (pageType, entityName, route, modal)
 * - Tier 3-5: Dynamic contexts (FormState, TableState, DetailState)
 * 
 * Usage:
 * - useEvaluationContext() automatically composes all context tiers
 * - Components using this will subscribe to all contexts (use sparingly)
 * - For better performance, use specific context hooks (useActor, useFormValues, etc.)
 */

import { useMemo } from 'react';
import { EvaluationContext } from '../types/evaluation';
import { useAppStaticContext } from './AppStaticContext';
import { usePageStaticContext } from './PageStaticContext';
import { useFormStateContext } from './FormStateContext';
import { useTableStateContext } from './TableStateContext';
import { useDetailStateContext } from './DetailStateContext';

/**
 * Hook to build evaluation context from all context layers.
 * 
 * NOTE: Components using this hook will subscribe to ALL contexts.
 * For better performance, use specific context hooks (useActor, useFormValues, etc.)
 * This hook is primarily for the evaluation system.
 * 
 * @param additionalContext - Override or extend context for specific evaluations
 * @returns Complete evaluation context
 */
export function useEvaluationContext(
  additionalContext?: Partial<EvaluationContext>
): EvaluationContext {
  
  // Get all context layers
  // These use useContextSelector, so we only subscribe if context exists
  const appStatic = useAppStaticContext();
  const pageStatic = usePageStaticContext();
  const formState = useFormStateContext();
  const tableState = useTableStateContext();
  const detailState = useDetailStateContext();
  
  // Build unified evaluation context
  const context: EvaluationContext = useMemo(() => {
    const baseContext: EvaluationContext = {
      // Tier 1: App static
      actor: appStatic?.actor || { actorId: '', groups: [] },
      tenant: appStatic?.tenant,
      device: appStatic?.device,
      featureFlags: appStatic?.featureFlags,
      
      // Tier 2: Page static
      pageType: pageStatic?.pageType,
      entityName: pageStatic?.entityName,
      route: pageStatic?.route,
      modal: pageStatic?.modal,
      queryParams: pageStatic?.route?.queryParams,
      modalDepth: pageStatic?.modal?.depth,
      
      // Tier 3: Form dynamic (if available)
      ...(formState && {
        record: formState.record,
        formValues: formState.formValues,
        isDirty: formState.isDirty,
        isValid: formState.isValid
      }),
      
      // Tier 4: Table dynamic (if available)
      ...(tableState && {
        selectedRecords: tableState.selectedRecords,
        selectedRowKeys: tableState.selectedRowKeys,
        filters: tableState.filters,
        searchQuery: tableState.searchQuery
      }),
      
      // Tier 5: Detail dynamic (if available)
      // Note: If both formState and detailState exist, formState.record takes precedence
      ...(!formState && detailState && {
        record: detailState.record,
        isLoading: detailState.isLoading
      }),
      
      // Additional context (overrides)
      ...additionalContext
    };
    
    return baseContext;
  }, [appStatic, pageStatic, formState, tableState, detailState, additionalContext]);
  
  return context;
}

/**
 * Build evaluation context with ONLY specific contexts.
 * Use this for more granular control over subscriptions.
 * 
 * @param options - Which contexts to include
 * @returns Partial evaluation context with only requested data
 */
export function useEvaluationContextPartial(options: {
  includeApp?: boolean;
  includePage?: boolean;
  includeForm?: boolean;
  includeTable?: boolean;
  includeDetail?: boolean;
  additionalContext?: Partial<EvaluationContext>;
}): EvaluationContext {
  const {
    includeApp = true,
    includePage = true,
    includeForm = false,
    includeTable = false,
    includeDetail = false,
    additionalContext
  } = options;
  
  const appStatic = includeApp ? useAppStaticContext() : null;
  const pageStatic = includePage ? usePageStaticContext() : null;
  const formState = includeForm ? useFormStateContext() : null;
  const tableState = includeTable ? useTableStateContext() : null;
  const detailState = includeDetail ? useDetailStateContext() : null;
  
  return useMemo(() => ({
    ...(appStatic && { 
      actor: appStatic.actor, 
      tenant: appStatic.tenant,
      device: appStatic.device,
      featureFlags: appStatic.featureFlags
    }),
    ...(pageStatic && { 
      pageType: pageStatic.pageType, 
      entityName: pageStatic.entityName,
      route: pageStatic.route,
      modal: pageStatic.modal,
      queryParams: pageStatic.route?.queryParams,
      modalDepth: pageStatic.modal?.depth
    }),
    ...(formState && { 
      record: formState.record, 
      formValues: formState.formValues,
      isDirty: formState.isDirty,
      isValid: formState.isValid
    }),
    ...(tableState && { 
      selectedRecords: tableState.selectedRecords,
      selectedRowKeys: tableState.selectedRowKeys,
      filters: tableState.filters,
      searchQuery: tableState.searchQuery
    }),
    ...(detailState && { 
      record: detailState.record,
      isLoading: detailState.isLoading
    }),
    ...additionalContext
  }), [appStatic, pageStatic, formState, tableState, detailState, additionalContext]) as EvaluationContext;
}


