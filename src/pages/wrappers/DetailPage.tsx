/**
 * DetailPage Wrapper - Owns detail state and provides DetailStateContext.
 * Renders PageHeader and the existing Details component with state management.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { useModalContext } from '../../core/context';
import { Details, IDetailsComponentProps } from '../../detail/Details';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { SectionsRenderer, ISectionsConfig } from '../PostAuth/SectionsRenderer';
import { Card } from 'antd';

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

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  return (
    <DetailStateProvider value={detailState}>
      <div className="detail-page">
        {/* Skip PageHeader when in modal - modal already has title/chrome */}
        {!isInModal && (
          <PageHeader
            pageHeaderActions={pageHeaderActions}
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

