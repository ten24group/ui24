/**
 * DetailPage Wrapper - Owns detail state and provides DetailStateContext.
 * Renders PageHeader and the existing Details component with state management.
 */
import { Card } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl } from '../../core/common/RefreshControl';
import { useModalContext } from '../../core/context';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { useAutoRefresh } from '../../core/hooks';
import { Details, IDetailsComponentProps } from '../../detail/Details';
import { IPageHeader, PageHeader } from '../PostAuth/PageHeader/PageHeader';
import { ISectionsConfig, SectionsRenderer } from '../PostAuth/SectionsRenderer';

interface DetailPageProps extends Omit<IDetailsComponentProps, 'onDataChange' | 'refreshRef'> {
  // IDetailsComponentProps already has pageTitle and routeParams
  // Add missing PageHeader props
  pageHeaderActions?: IPageHeader[ 'pageHeaderActions' ];
  breadcrumbs?: IPageHeader[ 'breadcrumbs' ];
  sectionsConfig?: ISectionsConfig;
  cardStyle?: React.CSSProperties;
  /** Current nesting depth (for recursive sections) */
  depth?: number;
}

export const DetailPage: React.FC<DetailPageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  identifiers,
  sectionsConfig,
  cardStyle,
  depth = 0,
  ...detailProps  // This contains all other props EXCEPT the ones destructured above
}) => {
  // 1. Wrapper owns state
  const [ record, setRecord ] = useState<any>(detailProps.detailResponse || null);
  const [ isLoading, setIsLoading ] = useState<boolean>(!detailProps.detailResponse);
  const [ dataUpdatedAt, setDataUpdatedAt ] = useState<string | null>(null);

  // 2. Ref to Details component's refresh function
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);

  // 3. Merge identifiers and record data into routeParams for URL substitution and template resolution
  const enhancedRouteParams = useMemo(() => ({
    ...routeParams,
    ...(identifiers && typeof identifiers === 'string' ? { id: identifiers } : {}),
    ...(record || {})  // Include record data for action initialValues template resolution
  }), [ routeParams, identifiers, record ]);

  // 4. Build DetailStateContext value (memoized)
  const detailState = useMemo(() => ({
    record,
    isLoading
  }), [ record, isLoading ]);

  // 5. Create onDataChange callback that updates our state
  const handleDataChange = useCallback((data: { record?: any; pageType?: string; entityName?: string; dataUpdatedAt?: string }) => {
    if (data.record !== undefined) {
      setRecord(data.record);
      setIsLoading(false);
    }
    if (data.dataUpdatedAt) {
      setDataUpdatedAt(data.dataUpdatedAt);
    }
  }, []);

  // 6. Create refresh handler for PageHeader and auto-refresh
  const handleRefresh = useCallback(async () => {
    if (refreshFnRef.current) {
      await refreshFnRef.current();
    }
  }, []);

  // Determine if this detail page fetches its own data.
  // When detailResponse is provided (e.g., sections using parentData), there's nothing to refresh —
  // the parent owns the data and its refresh controls.
  const fetchesOwnData = !detailProps.detailResponse && !!detailProps.detailApiConfig;

  // 7. Auto-refresh functionality — only when this page fetches its own data
  const autoRefresh = useAutoRefresh({
    onRefresh: handleRefresh,
    enabled: false,
    defaultInterval: 30
  });

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  // 8. Single unified refresh control — replaces separate refresh button + auto-refresh + freshness.
  // Only shown when this page fetches its own data (not when data comes from parent).
  const refreshControls = useMemo(() => {
    if (isInModal || !fetchesOwnData) return null;

    return (
      <RefreshControl
        key="refresh-control"
        onRefresh={handleRefresh}
        dataUpdatedAt={dataUpdatedAt}
        autoRefresh={autoRefresh}
      />
    );
  }, [ isInModal, fetchesOwnData, handleRefresh, dataUpdatedAt, autoRefresh ]);

  return (
    <DetailStateProvider value={detailState}>
      <div className="detail-page">
        {/* Skip PageHeader when in modal - modal already has title/chrome */}
        {!isInModal && (
          <PageHeader
            pageHeaderActions={pageHeaderActions}
            appendActions={refreshControls}
            pageTitle={pageTitle}
            breadcrumbs={breadcrumbs}
            routeParams={enhancedRouteParams}
            onRefreshData={handleRefresh}
          />
        )}

        {/* Render main content and sections */}
        <SectionsRenderer
          sectionsConfig={sectionsConfig}
          routeParams={enhancedRouteParams}
          parentData={{ record }}
          depth={depth}
          cardStyle={cardStyle}
          isParentLoading={isLoading}
        >
          {/* Main content (Details) - rendered as first section if sectionsConfig exists, otherwise standalone */}
          <Card
            style={{ ...cardStyle, padding: 0, marginTop: sectionsConfig ? 0 : 16 }}
            size="small"
          >
            <Details
              {...detailProps}
              routeParams={enhancedRouteParams}  // Override routeParams for to-many relations (must come after spread)
              identifiers={identifiers}
              onDataChange={handleDataChange}
              refreshRef={refreshFnRef}
            />
          </Card>
        </SectionsRenderer>
      </div>
    </DetailStateProvider>
  );
};
