/**
 * DetailPage Wrapper - Owns detail state and provides DetailStateContext.
 * Renders PageHeader and the existing Details component with state management.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { Details, IDetailsComponentProps } from '../../detail/Details';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';

interface DetailPageProps extends Omit<IDetailsComponentProps, 'onDataChange' | 'refreshRef'> {
  // IDetailsComponentProps already has pageTitle and routeParams
  // Add missing PageHeader props
  pageHeaderActions?: IPageHeader['pageHeaderActions'];
  breadcrumbs?: IPageHeader['breadcrumbs'];
}

export const DetailPage: React.FC<DetailPageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  identifiers,
  ...detailProps  // This contains all other props EXCEPT the ones destructured above
}) => {
  // 1. Wrapper owns state
  const [record, setRecord] = useState<any>(detailProps.detailResponse || null);
  const [isLoading, setIsLoading] = useState<boolean>(!detailProps.detailResponse);
  
  // 2. Ref to Details component's refresh function
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);
  
  // 3. Merge identifiers and record data into routeParams for URL substitution and template resolution
  const enhancedRouteParams = useMemo(() => ({
    ...routeParams,
    ...(identifiers && typeof identifiers === 'string' ? { id: identifiers } : {}),
    ...(record || {})  // Include record data for action initialValues template resolution
  }), [routeParams, identifiers, record]);
  
  // 4. Build DetailStateContext value (memoized)
  const detailState = useMemo(() => ({
    record,
    isLoading
  }), [record, isLoading]);
  
  // 5. Create onDataChange callback that updates our state
  const handleDataChange = useCallback((data: { record?: any; pageType?: string; entityName?: string }) => {
    if (data.record !== undefined) {
      setRecord(data.record);
      setIsLoading(false);
    }
  }, []);
  
  // 6. Create refresh handler for PageHeader
  const handleRefresh = useCallback(async () => {
    if (refreshFnRef.current) {
      await refreshFnRef.current();
    }
  }, []);
  
  return (
    <DetailStateProvider value={detailState}>
      <div className="detail-page">
        {/* PageHeader has access to DetailStateContext and can trigger refresh */}
        <PageHeader
          pageHeaderActions={pageHeaderActions}
          pageTitle={pageTitle}
          breadcrumbs={breadcrumbs}
          routeParams={enhancedRouteParams}
          onRefreshData={handleRefresh}
        />
        
        {/* Details component - pass through onDataChange and refreshRef */}
        <Details
          {...detailProps}
          routeParams={enhancedRouteParams}  // Override routeParams for to-many relations (must come after spread)
          identifiers={identifiers}
          onDataChange={handleDataChange}
          refreshRef={refreshFnRef}
        />
      </div>
    </DetailStateProvider>
  );
};

