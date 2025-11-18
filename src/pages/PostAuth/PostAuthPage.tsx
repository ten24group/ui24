import React from 'react';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { IForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { FormPage } from '../wrappers/FormPage';
import { TablePage } from '../wrappers/TablePage';
import { DetailPage } from '../wrappers/DetailPage';
import { Accordion } from './Accordion/Accordion';
import { ITableConfig } from '../../table/type';
import { IDetailsConfig } from '../../detail/Details';
import { DashboardPage, IDashboardPageConfig } from './DashboardPage';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../../core/common';
import { PageDataProvider } from '../../core/context/PageDataContext';
import { PageStaticContextValue, PageStaticProvider } from '../../core/context/PageStaticContext';

export type IPageType = PageStaticContextValue[ 'pageType' ];

export interface IRenderFromPageType extends IPageHeader {
  identifiers?: string | number;
  pageType?: IPageType;
  cardStyle?: React.CSSProperties;
  formPageConfig?: IForm;
  listPageConfig?: ITableConfig;
  detailsPageConfig?: IDetailsConfig;
  accordionsPageConfig?: Record<string, IRenderFromPageType>;
  routeParams?: Record<string, any>;
  dashboardPageConfig?: IDashboardPageConfig;
  /** Current nesting depth (for recursive sections) */
  depth?: number;
}

export interface IPostAuthPage extends IRenderFromPageType {
  CustomPageHeader?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * PostAuthPage - Main layout for authenticated pages
 * 
 * New Architecture:
 * 1. Provides static page-level context via PageStaticProvider (pageType, entityName, route, modal)
 * 2. Wrapper components (FormPage, TablePage, DetailPage) own and manage their own state
 * 3. Each wrapper provides its state via dedicated contexts (FormStateContext, TableStateContext, DetailStateContext)
 * 4. Each wrapper renders its own PageHeader (with access to its state context)
 * 5. Components use use-context-selector to subscribe only to data they need
 * 6. Minimal re-renders through selective subscription
 * 
 * Context Architecture:
 * PostAuthPage → PageStaticProvider
 *   └─ FormPage → FormStateProvider → PageHeader + Form component
 *   └─ TablePage → TableStateProvider → PageHeader + Table component
 *   └─ DetailPage → DetailStateProvider → PageHeader + Details component
 * 
 * PageDataProvider kept for backward compatibility with Accordion/Dashboard.
 */
export const PostAuthPage = ({ CustomPageHeader, children, ...props }: IPostAuthPage) => {

  // For form/table/details pages, PageHeader is rendered by the wrapper component.
  // Only render PageHeader here for accordion/dashboard/custom pages.
  const shouldRenderPageHeaderHere = props.pageType === 'accordion' || props.pageType === 'dashboard' || props.pageType === 'custom';

  return (
    <PageStaticProvider
      pageType={props.pageType || 'custom'}
      entityName={props.formPageConfig?.entityName || props.listPageConfig?.entityName || props.detailsPageConfig?.entityName}
      config={props}
    >
      {/* PageDataProvider kept for backward compatibility with Accordion/Dashboard */}
      <PageDataProvider localData={{}}>
        <div style={{ paddingTop: "1%" }}>
          <div className="PostAuthContainer">
            {/* Only render PageHeader for pages that don't have wrappers */}
            {shouldRenderPageHeaderHere && (CustomPageHeader ? CustomPageHeader : <PageHeader {...props} />)}

            <div className="PageContent">
              {children && children}
              {!children && (
                <ErrorBoundary
                  FallbackComponent={ErrorFallback}
                  onReset={() => {
                    console.log("PostAuthPage ErrorBoundary Reset");
                  }}
                >
                  <RenderFromPageType {...props} />
                </ErrorBoundary>
              )}
            </div>
          </div>
        </div>
      </PageDataProvider>
    </PageStaticProvider>
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
  depth?: number;
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
  depth = 0,
  // PageHeader props from parent
  pageHeaderActions,
  pageTitle,
  breadcrumbs
}: IRenderFromPageTypeProps) => {

  // Use stable keys to prevent unnecessary remounts
  const stableKey = identifiers || (routeParams ? Object.values(routeParams).join('|') : '') || pageType;

  switch (pageType) {
    case "list": return (
      <TablePage
        {...listPageConfig}
        routeParams={routeParams}
        cardStyle={cardStyle}
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        depth={depth}
        key={`list-${stableKey}`}
      />
    );
    case "form": return (
      <FormPage
        {...formPageConfig}
        identifiers={identifiers}
        routeParams={routeParams}
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        cardStyle={cardStyle}
        breadcrumbs={breadcrumbs}
        depth={depth}
        key={`form-${stableKey}`}
      />
    );
    case "details": return (
      <DetailPage
        {...detailsPageConfig}
        identifiers={identifiers}
        routeParams={routeParams}
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        depth={depth}
        key={`details-${stableKey}`}
      />
    );
    case "accordion": return <Accordion accordionsPageConfig={accordionsPageConfig} routeParams={routeParams} />;
    case "dashboard": return <DashboardPage dashboardConfig={dashboardPageConfig} />;
    case "custom": return <>TODO: handle custom page</>;
    default: return <>Invalid Page Type</>;
  }
}