/**
 * Detail-level dynamic context (changes on record load).
 * Provided by DetailPage wrapper, available to detail components.
 * 
 * Uses use-context-selector for selective subscription.
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode } from 'react';
import { useDevToolsReport } from '../devtools/store/snapshot';
import { useEntityName } from './PageStaticContext';

export interface DetailStateContextValue {
  record: any | null;
  isLoading: boolean;
}

export const DetailStateContext = createContext<DetailStateContextValue | null>(null);

export const DetailStateProvider = ({
  children,
  value
}: {
  children: ReactNode;
  value: DetailStateContextValue;
}) => {
  const entityName = useEntityName();
  useDevToolsReport('detail', entityName ? `Detail: ${entityName}` : 'Detail', value);

  return (
    <DetailStateContext.Provider value={value}>
      {children}
    </DetailStateContext.Provider>
  );
};

// Selector hooks
export const useDetailRecord = () =>
  useContextSelector(DetailStateContext, state => state?.record);

export const useDetailIsLoading = () =>
  useContextSelector(DetailStateContext, state => state?.isLoading ?? false);

export const useDetailRecordField = (fieldName: string) =>
  useContextSelector(
    DetailStateContext,
    state => state?.record?.[fieldName]
  );

// Full context (use in evaluation system)
export const useDetailStateContext = () =>
  useContextSelector(DetailStateContext, state => state);
