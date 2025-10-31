import React, { useState, useCallback } from 'react';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { IForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { Form } from '../../forms/Form';
import { Table } from '../../table/Table';
import { Accordion } from './Accordion/Accordion';
import { ITableConfig } from '../../table/type';
import { Details, IDetailsConfig } from '../../detail/Details';
import { v4 as uuidv4 } from 'uuid';
import { DashboardPage, IDashboardPageConfig } from './DashboardPage';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../../core/common';
import { PageDataProvider } from '../../core/context/PageDataContext';
import { useSelectiveDebounce } from '../../core/hooks/useSelectiveDebounce';
import { ComponentDataContext, OnDataChangeCallback } from '../../core/types/pageData';

export type IPageType = "list" | "form" | "accordion" | "details" | "dashboard" | "custom";

export interface IRenderFromPageType extends IPageHeader {
    identifiers?: string | number;
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: IForm;
    listPageConfig?: ITableConfig;
    detailsPageConfig?: IDetailsConfig;
    accordionsPageConfig?: Record<string, IRenderFromPageType>;
    routeParams?: Record<string, string>;
    dashboardPageConfig?: IDashboardPageConfig;
}

export interface IPostAuthPage extends IRenderFromPageType {
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}

/**
 * PostAuthPage - Main layout for authenticated pages
 * 
 * Implements "Lifting State Up" pattern:
 * 1. Owns componentData state (with MERGING to prevent overwrites)
 * 2. Provides it to PageDataProvider
 * 3. Passes onDataChange callback to children
 * 4. Children (Table/Form/Details) lift their state up via callback
 * 5. PageHeader accesses state via useEvaluationContext()
 * 
 * Context Flow:
 * Component → onDataChange(merge) → setComponentData → PageDataProvider → PageHeader
 * 
 * Stale Data Handling:
 * React keys with uuidv4() force component remount on navigation.
 * When Table → Details navigation occurs, Table unmounts, Details mounts fresh.
 * No manual cleanup needed.
 */
export const PostAuthPage = ({ CustomPageHeader, children, ...props }: IPostAuthPage) => {
  
  // 1. PostAuthPage owns the component data state (Lifting State Up pattern)
  const [componentData, setComponentData] = useState<Partial<ComponentDataContext> | null>(null);
  
  // Standard refresh function (registered by child components)
  const refreshFnRef = React.useRef<(() => void) | null>(null);
  
  // Track last lifted data to prevent unnecessary updates (shallow diff)
  const lastDataRef = React.useRef<Partial<ComponentDataContext>>({});
  
  // 2. Merge instead of replace with cheap shallow diff
  const handleDataChange = useCallback<OnDataChangeCallback>((newData) => {
    // Detect any primitive change or reference change
    let changed = false;
    for (const k in newData) {
      const prev = lastDataRef.current[k as keyof ComponentDataContext];
      const next = newData[k as keyof ComponentDataContext];
      if (typeof next === 'object') {
        if (prev !== next) { changed = true; break; }
      } else {
        if (prev !== next) { changed = true; break; }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostAuthPage] handleDataChange changed', { changed, newData });
    }

    if (!changed) return;
    
    // Update ref first, then state (preserve references for unchanged keys)
    lastDataRef.current = { ...lastDataRef.current, ...newData };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostAuthPage] handleDataChange called', { keys: Object.keys(newData) });
    }
    
    setComponentData(prev => ({ ...prev, ...newData }));
  }, []);
  
  // Standard data refresh callback (registered by children)
  const handleDataRefresh = React.useCallback((refreshFn: () => void) => {
    refreshFnRef.current = refreshFn;
  }, []);
  
  // Stable wrapper that calls the registered refresh function
  const executeRefresh = React.useCallback(() => {
    if (refreshFnRef.current) {
      refreshFnRef.current();
    }
  }, []);
  
  // 3. Debounce selectively only when formValues exist; otherwise use raw data
  const debouncedComponentData = useSelectiveDebounce(componentData, 300);
  const STABLE_EMPTY_DATA = React.useMemo(() => ({}), []);
  const localData = React.useMemo(() => {
    const hasFormValues = !!componentData?.formValues;
    const payload = hasFormValues ? debouncedComponentData : componentData;
    return payload || STABLE_EMPTY_DATA;
  }, [componentData, debouncedComponentData, STABLE_EMPTY_DATA]);
  
  return (
    // 4. Provide lifted state to all children via PageDataProvider
    <PageDataProvider localData={localData}>
      <div style={{ paddingTop: "1%" }}>
        <div className="PostAuthContainer">
          {/* 5. PageHeader consumes context automatically via useEvaluationContext() */}
          {CustomPageHeader ? CustomPageHeader : <PageHeader {...props} onRefreshData={executeRefresh} />}
          
          <div className="PageContent">
            {children && children}
            {!children && (
              <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => {
                  console.log("PostAuthPage ErrorBoundary Reset");
                }}
              >
                {/* 6. Pass callbacks to child components */}
                <RenderFromPageType 
                  {...props} 
                  onDataChange={handleDataChange}
                  onDataRefresh={handleDataRefresh}
                />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </PageDataProvider>
  );
}

interface IRenderFromPageTypeProps extends IRenderFromPageType {
  pageType?: IPageType;
  cardStyle?: React.CSSProperties;
  accordionsPageConfig?: Record<string, IRenderFromPageType>;
  formPageConfig?: IForm;
  listPageConfig?: ITableConfig;
  detailsPageConfig?: IDetailsConfig;
  identifiers?: string | number;
  routeParams?: Record<string, string>;
  dashboardPageConfig?: IDashboardPageConfig;
  onDataChange?: OnDataChangeCallback;  // For lifting state
  onDataRefresh?: (refreshFn: () => void) => void;  // Standard: Register refresh handler
}

export const RenderFromPageType = ({ 
  pageType, 
  cardStyle, 
  accordionsPageConfig, 
  formPageConfig, 
  listPageConfig, 
  detailsPageConfig, 
  identifiers, 
  routeParams, 
  dashboardPageConfig,
  onDataChange,
  onDataRefresh  // Standard refresh callback
}: IRenderFromPageTypeProps) => {

    // Use stable keys to prevent unnecessary remounts
    const stableKey = identifiers || (routeParams ? Object.values(routeParams).join('|') : '') || pageType;

    switch (pageType) {
        case "list": return <Card style={cardStyle} > <Table {...listPageConfig} routeParams={routeParams} onDataChange={onDataChange} onDataRefresh={onDataRefresh} key={`list-${stableKey}`} /> </Card>;
        case "form": return <Card style={cardStyle} > <Form {...formPageConfig} identifiers={identifiers} routeParams={routeParams} onDataChange={onDataChange} onDataRefresh={onDataRefresh} key={`form-${stableKey}`} /> </Card>;
        case "details": return <Card style={cardStyle} > <Details {...detailsPageConfig} identifiers={identifiers} routeParams={routeParams} onDataChange={onDataChange} onDataRefresh={onDataRefresh} key={`details-${stableKey}`} /> </Card>;
        case "accordion": return <Accordion accordionsPageConfig={accordionsPageConfig} routeParams={routeParams} onDataChange={onDataChange} />;
        case "dashboard": return <DashboardPage dashboardConfig={dashboardPageConfig} onDataChange={onDataChange} />;
        case "custom": return <>TODO: handle custom page</>;
        default: return <>Invalid Page Type</>;
    }
}