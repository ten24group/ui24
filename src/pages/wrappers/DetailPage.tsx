/**
 * DetailPage Wrapper - Owns detail state and provides DetailStateContext.
 * Renders PageHeader and the existing Details component with state management.
 */
import { Card } from 'antd';
import React, { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { PageAlerts } from '../../core/common/PageAlerts/PageAlerts';
import { RefreshControl } from '../../core/common/RefreshControl';
import { useModalContext, useApi } from '../../core/context';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { useAutoRefresh } from '../../core/hooks';

import { Details } from '../../detail/Details';
import type { IDetailsComponentProps } from '../../core/types/field-config';
import { IPageHeader, PageHeader } from '../PostAuth/PageHeader/PageHeader';
import { ISectionsConfig, SectionsRenderer } from '../PostAuth/SectionsRenderer';
import { useSpan } from '../../core/telemetry';
import { RelatedTabs } from './RelatedTabs';

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
  const [ record, setRecord ] = useState<any>(detailProps.dataSource || null);
  const [ isLoading, setIsLoading ] = useState<boolean>(!detailProps.dataSource);
  const [ dataUpdatedAt, setDataUpdatedAt ] = useState<string | null>(null);
  const [ primaryRecord, setPrimaryRecord ] = useState<any>(null); // raw primary record for multi-source merging (#90)

  // 2. Ref to Details component's refresh function
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);

  const { callApiMethod } = useApi(); // for secondary data sources (#90)

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
      if (detailProps.dataSources?.length) {
        // Store primary record separately; multi-source effect will merge and call setRecord
        setPrimaryRecord(data.record);
      } else {
        setRecord(data.record);
        setIsLoading(false);
      }
    }
    if (data.dataUpdatedAt) {
      setDataUpdatedAt(data.dataUpdatedAt);
    }
  }, [ detailProps.dataSources ]);

  // Multi-source data merge (#90): when primary record loads and dataSources are configured,
  // fetch all secondary sources in parallel and merge results into the record.
  useEffect(() => {
    if (!primaryRecord || !detailProps.dataSources?.length) return;

    let cancelled = false;

    const fetchSecondary = async () => {
      const mergedRouteParams = {
        ...routeParams,
        ...(identifiers && typeof identifiers === 'string' ? { id: identifiers } : {}),
        ...primaryRecord,
      };

      try {
        const results = await Promise.allSettled(
          detailProps.dataSources!.map(async (source) => {
            const resolvedUrl = source.apiConfig.apiUrl.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, k) =>
              String(mergedRouteParams[ k ] ?? `:${k}`)
            );
            const response = await callApiMethod<any>({ ...source.apiConfig, apiUrl: resolvedUrl });
            const data = response?.data;
            const value = source.responseKey ? data?.[ source.responseKey ] : data;
            return { key: source.key, value };
          })
        );

        if (cancelled) return;

        let merged = { ...primaryRecord };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { key, value } = result.value;
            if (key) {
              merged = { ...merged, [ key ]: value };
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
              merged = { ...merged, ...value };
            }
          }
        });

        setRecord(merged);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSecondary();
    return () => { cancelled = true; };
  }, [ primaryRecord, detailProps.dataSources, routeParams, identifiers, callApiMethod ]);

  // 6. Create refresh handler for PageHeader and auto-refresh
  const handleRefresh = useCallback(async () => {
    if (refreshFnRef.current) {
      await refreshFnRef.current();
    }
  }, []);

  // Determine if this detail page fetches its own data.
  const fetchesOwnData = !detailProps.dataSource && !!detailProps.detailApiConfig;

  // 7. Auto-refresh functionality — only when this page fetches its own data
  const autoRefresh = useAutoRefresh({
    onRefresh: handleRefresh,
    enabled: false,
    defaultInterval: 30
  });

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  // Detail load span tracking
  const { updateSpan } = useSpan({
    entityName: detailProps.entityName,
    apiUrl: detailProps.detailApiConfig?.apiUrl,
    identifiers,
    type: 'detail.load',
    attributes: {
      'detail.entity': detailProps.entityName || 'Unknown',
      'detail.identifier': typeof identifiers === 'string' ? identifiers : JSON.stringify(identifiers),
    }
  });

  // After data loads, update span attributes
  useEffect(() => {
    if (record) {
      updateSpan({
        'detail.recordLoaded': true,
        'detail.fieldCount': Object.keys(record).length
      });
    }
  }, [ record, updateSpan ]);

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

  // Wrap content in span context for propagation
  const renderContent = () => {
    const content = (
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

          {/* Inline contextual alerts (#16) */}
          {detailProps.alerts && detailProps.alerts.length > 0 && (
            <PageAlerts
              alerts={detailProps.alerts}
              record={record ?? undefined}
              placement="top"
            />
          )}

          {/* Render main content - Details component always shown (handles its own error states) */}
          <Card
            style={{ ...cardStyle, padding: 0, marginTop: 16 }}
            size="small"
          >
            <Details
              {...detailProps}
              routeParams={enhancedRouteParams}
              identifiers={identifiers}
              onDataChange={handleDataChange}
              refreshRef={refreshFnRef}
            />
          </Card>

          {/* Sections - only render when we have valid record data */}
          {record && !isLoading && sectionsConfig && (
            <SectionsRenderer
              sectionsConfig={sectionsConfig}
              routeParams={enhancedRouteParams}
              parentData={{
                record,
                detailApiConfig: detailProps.detailApiConfig,
                displayOverrides: detailProps.displayOverrides,
              }}
              depth={depth}
              cardStyle={cardStyle}
              isParentLoading={isLoading}
            />
          )}

          {/* Related entity tabs (#91) — rendered after the main detail card */}
          {/* Only render tabs when we have a valid record (not null and not loading) */}
          {detailProps.relatedTabs && detailProps.relatedTabs.length > 0 && record && !isLoading && (
            <RelatedTabs
              tabs={detailProps.relatedTabs}
              record={record}
              routeParams={enhancedRouteParams}
            />
          )}
        </div>
      </DetailStateProvider>
    );

    // REMOVED: SpanContextProvider wrapping to improve performance
    return content;
  };

  return renderContent();
};
