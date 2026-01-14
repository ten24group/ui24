import React, { useMemo } from 'react';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { IForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
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
import { CustomPage, ICustomPageConfig } from './CustomPage';
import {
  ExtensionRegistry,
  buildResolverContext,
  type PageComponentProps,
  type OverridablePageType,
  type OriginalPageConfig
} from '../../core/registry';

export type IPageType = PageStaticContextValue[ 'pageType' ];

/**
 * Route parameters type - string keys to string values only.
 * No loose Record<string, any> types.
 */
export interface IRouteParams {
  readonly [ key: string ]: string | number | undefined;
}

export interface IRenderFromPageType extends IPageHeader {
  identifiers?: string | number;
  pageType?: IPageType;
  cardStyle?: React.CSSProperties;
  formPageConfig?: IForm;
  listPageConfig?: ITableConfig;
  detailsPageConfig?: IDetailsConfig;
  accordionsPageConfig?: Readonly<{ [ key: string ]: IRenderFromPageType }>;
  routeParams?: IRouteParams;
  dashboardPageConfig?: IDashboardPageConfig;
  /** Custom page configuration (when pageType='custom') */
  customPageConfig?: ICustomPageConfig;
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
  accordionsPageConfig?: Readonly<{ [ key: string ]: IRenderFromPageType }>;
  formPageConfig?: IForm;
  listPageConfig?: ITableConfig;
  detailsPageConfig?: IDetailsConfig;
  identifiers?: string | number;
  routeParams?: IRouteParams;
  dashboardPageConfig?: IDashboardPageConfig;
  customPageConfig?: ICustomPageConfig;
  depth?: number;
}

/**
 * Determine the overridable page type from the current page type.
 */
function getOverridablePageType(
  pageType: IPageType | undefined,
  identifiers: string | number | undefined
): OverridablePageType | null {
  switch (pageType) {
    case 'list':
      return 'list';
    case 'details':
      return 'details';
    case 'form':
      return identifiers ? 'form' : 'create';
    default:
      return null;
  }
}

/**
 * Extract entity name from page configs.
 */
function extractEntityName(
  listPageConfig?: ITableConfig,
  detailsPageConfig?: IDetailsConfig,
  formPageConfig?: IForm
): string | undefined {
  return listPageConfig?.entityName ??
    detailsPageConfig?.entityName ??
    formPageConfig?.entityName;
}

export const RenderFromPageType = ({
  pageType,
  cardStyle,
  accordionsPageConfig,
  formPageConfig,
  listPageConfig,
  detailsPageConfig,
  identifiers,
  routeParams = {},
  dashboardPageConfig,
  customPageConfig,
  depth = 0,
  // PageHeader props from parent
  pageHeaderActions,
  pageTitle,
  breadcrumbs
}: IRenderFromPageTypeProps) => {

  // Use stable keys to prevent unnecessary remounts
  const stableKey = identifiers ?? (routeParams ? Object.values(routeParams).join('|') : '') ?? pageType;

  // Extract entity name for override checking
  const entityName = useMemo(
    () => extractEntityName(listPageConfig, detailsPageConfig, formPageConfig),
    [ listPageConfig, detailsPageConfig, formPageConfig ]
  );

  // Check for entity-specific override BEFORE standard rendering
  const entityOverrideResult = useMemo(() => {
    if (!entityName) return null;

    const overridablePageType = getOverridablePageType(pageType, identifiers);
    if (!overridablePageType) return null;

    const OverrideComponent = ExtensionRegistry.getEntityOverride(
      entityName,
      overridablePageType
    );

    if (!OverrideComponent) return null;

    // Build original config for override component to access if needed
    const originalConfig: OriginalPageConfig = {
      listPageConfig: listPageConfig ? { entityName: listPageConfig.entityName } : undefined,
      detailsPageConfig: detailsPageConfig ? { entityName: detailsPageConfig.entityName } : undefined,
      formPageConfig: formPageConfig ? { entityName: formPageConfig.entityName } : undefined
    };

    // Build props for override component
    const overrideProps: PageComponentProps = {
      routeParams,
      depth,
      entityName,
      identifiers,
      pageConfig: { identifiers: identifiers?.toString() },
      originalConfig
    };

    return { Component: OverrideComponent, props: overrideProps };
  }, [ entityName, pageType, identifiers, routeParams, depth, listPageConfig, detailsPageConfig, formPageConfig ]);

  // If entity override exists, render it instead of standard page
  if (entityOverrideResult) {
    const { Component, props } = entityOverrideResult;
    return (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          console.log(`[RenderFromPageType] Entity override error boundary reset: ${entityName}`);
        }}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  }

  // Check ExtensionRegistry for custom page types
  const extensionPageResult = useMemo(() => {
    if (!pageType) return null;

    // Build resolver context
    const resolverContext = buildResolverContext({
      entityName,
      pageType,
      routeParams,
      depth
    });

    // Check for custom page type in ExtensionRegistry
    const CustomPageComponent = ExtensionRegistry.getPageComponent(pageType, resolverContext);
    if (!CustomPageComponent) return null;

    // Build props for custom page
    const pageProps: PageComponentProps = {
      routeParams,
      depth,
      entityName,
      identifiers,
      pageConfig: {
        listPageConfig,
        detailsPageConfig,
        formPageConfig,
        dashboardPageConfig,
        customPageConfig,
        accordionsPageConfig
      }
    };

    return { Component: CustomPageComponent, props: pageProps };
  }, [ pageType, entityName, routeParams, depth, identifiers, listPageConfig, detailsPageConfig, formPageConfig, dashboardPageConfig, customPageConfig, accordionsPageConfig ]);

  // If ExtensionRegistry has a custom page type, render it
  if (extensionPageResult) {
    const { Component, props } = extensionPageResult;
    return (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          console.log(`[RenderFromPageType] Extension page error boundary reset: ${pageType}`);
        }}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  }

  // Standard page type rendering (built-in types)
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
    case "dashboard": return <DashboardPage dashboardConfig={dashboardPageConfig} routeParams={routeParams} />;
    case "custom": return (
      <CustomPage
        config={customPageConfig!}
        routeParams={routeParams}
        depth={depth}
        entityName={entityName}
      />
    );
    default: return <>Invalid Page Type: {pageType}</>;
  }
}