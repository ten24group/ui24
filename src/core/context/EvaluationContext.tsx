/**
 * Evaluation context for universal visibility/enablement system.
 * 
 * UPDATED: Now integrates with AppStateProvider and PageDataProvider
 * for proper multi-tiered context architecture.
 * 
 * Usage:
 * - useEvaluationContext() automatically composes app + page state
 * - EvaluationContextProvider kept for backward compatibility (aliased to PageDataProvider)
 */

import React, { useMemo, ReactNode } from 'react';
import { EvaluationContext } from '../types/evaluation';
import { useAppState } from './AppStateContext';
import { usePageDataContext, PageDataProvider } from './PageDataContext';

/**
 * Hook to access evaluation context.
 * 
 * Automatically builds context from:
 * - AppStateProvider (actor, tenant, featureFlags)
 * - PageDataProvider (record, selectedRecords, formValues, pageType, entityName)
 * 
 * @param additionalContext - Override or extend context for specific evaluations
 * @returns Complete evaluation context
 */
export function useEvaluationContext(
  additionalContext?: Partial<EvaluationContext>
): EvaluationContext {
  
  // Get app-level state (Tier 1)
  const appState = useAppState();
  
  // Get page-level state (Tier 2)  
  const pageData = usePageDataContext();
  
  // Build unified evaluation context
  const context: EvaluationContext = useMemo(() => {
    // Start with app state - map to evaluation context format
    const baseContext: EvaluationContext = {
      actor: appState?.actor || {
        actorId: '',
        groups: []
      },
      // Future: Add tenant, featureFlags from appState
    };
    
    // Merge with page data (if available)
    if (pageData) {
      Object.assign(baseContext, {
        record: pageData.record,
        selectedRecords: pageData.selectedRecords,
        formValues: pageData.formValues,
        pageType: pageData.pageType,
        entityName: pageData.entityName,
        queryParams: pageData.route?.queryParams,
        modalDepth: pageData.modalDepth,
        // Include any custom data from components
        filters: pageData.filters,
        searchQuery: pageData.searchQuery
      });
    }
    
    // Merge with additional context (overrides)
    if (additionalContext) {
      Object.assign(baseContext, additionalContext);
    }
    
    return baseContext;
  }, [appState, pageData, additionalContext]);
  
  return context;
}


