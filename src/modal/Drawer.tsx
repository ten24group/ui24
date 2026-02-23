/**
 * Drawer.tsx
 * 
 * ==========================================
 * DRAWER COMPONENT FOR SLIDE-OUT PANELS
 * ==========================================
 * 
 * PURPOSE: Slide-out panel for viewing/editing content without full navigation
 * 
 * USE THIS WHEN:
 * - Quick preview of entity details
 * - Side-by-side editing while viewing list
 * - Forms that don't require full page context
 * - Secondary content that shouldn't interrupt main flow
 * 
 * USE Modal INSTEAD WHEN:
 * - Confirmation dialogs
 * - Critical actions requiring focus
 * - Complex multi-step workflows
 */

import React from 'react';
import { Drawer as AntDrawer } from 'antd';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { IApiConfig, ModalContextProvider } from '../core/context';
import { RenderFromPageType, IPageType } from '../pages/PostAuth/PostAuthPage';
import { IForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/type';
import type { IDetailsConfig } from '../core/types/field-config';
import { IDashboardPageConfig } from '../pages/PostAuth/DashboardPage';
import { IAccordionPageConfig } from '../pages/PostAuth/Accordion/Accordion';
import { type IWizardPageConfig } from '../core/common/FormWizard';
import { Template } from '../core/types';
import type { ConditionalValue } from '../core/types/evaluation';
import { evaluateTemplateValue } from '../core/utils/template';
import { Link } from '../core/common';
import { INavigateToConfig, IResponseDisplayConfig } from './Modal';

/**
 * Drawer configuration interface (presentation properties only).
 * For action drawers with page content, use IActionDrawerConfig instead.
 */
export interface IDrawerConfig {
  /** Title for the drawer */
  title?: Template;
  /** Placement of the drawer */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** Width for left/right placement */
  width?: number | string;
  /** Height for top/bottom placement */
  height?: number | string;
  /** Show close button */
  closable?: boolean;
  /** Show mask overlay */
  mask?: boolean;
  /** Close on mask click */
  maskClosable?: boolean;
  /** Destroy content on close */
  destroyOnClose?: boolean;
}

/**
 * Full drawer configuration for page actions.
 * Similar to IModalConfig but with drawer-specific presentation properties.
 * 
 * Supports two patterns:
 * 1. **Route resolution**: Use with url or drawerConfigRef
 * 2. **Inline config**: Use drawerType + drawerPageConfig (same as modalType + modalPageConfig)
 * 
 * @see {@link IModalConfig} for the modal equivalent
 */
export interface IActionDrawerConfig extends IDrawerConfig {
  // =========================================================================
  // SHARED PAGE CONFIG (SAME AS MODAL)
  // =========================================================================

  /** Page type to render in drawer (same as modalType) */
  drawerType?: IPageType;

  /** Page configuration (same structure as modalPageConfig) */
  drawerPageConfig?: IForm | ITableConfig | IDetailsConfig | IDashboardPageConfig | IAccordionPageConfig | IWizardPageConfig;

  // =========================================================================
  // SHARED API/NAVIGATION CONFIG (SAME AS MODAL)
  // =========================================================================

  /** EITHER: Make API call */
  apiConfig?: IApiConfig;
  /** Redirect URL after success. Supports ConditionalValue for condition-based routing. */
  submitSuccessRedirect?: string | ConditionalValue<string>;
  submitSuccessRedirectOptions?: {
    replace?: boolean;
    state?: unknown;
  };

  /** OR: Navigate without API call */
  navigateTo?: INavigateToConfig | string;

  /** Display API response in a modal */
  responseConfig?: IResponseDisplayConfig;

  /** Dynamic config key for chaining operations */
  dynamicConfigKey?: string;

  /** Skip toast notifications */
  skipSuccessToast?: boolean;
  skipErrorToast?: boolean;

  /** Control drawer behavior on error */
  closeDrawerOnError?: boolean;

  /** Pre-populate form fields from context */
  initialValues?: Record<string, any>;

  /** Refresh parent component after success */
  refreshParentOnSuccess?: boolean;

  /** Custom success message template */
  successMessage?: Template;

  /** Custom error message template */
  errorMessage?: Template;
}

/**
 * Props for the Drawer component.
 */
export interface IDrawerProps extends IDrawerConfig {
  /** Page type to render inside drawer */
  pageType: IPageType;
  /** Page configuration based on pageType */
  pageConfig?: IForm | ITableConfig | IDetailsConfig | IDashboardPageConfig | IAccordionPageConfig | IWizardPageConfig;
  /** Route parameters for placeholder resolution */
  routeParams?: Readonly<Record<string, string | number | undefined>>;
  /** Entity identifiers (for details/form pages) */
  identifiers?: string | number;
  /** Children to render as trigger */
  children?: React.ReactNode;
  /** Callback when drawer closes */
  onClose?: () => void;
  /** Callback on successful operation (for forms) */
  onSuccess?: (response?: unknown) => void;
  /** Current nesting depth */
  depth?: number;
  /** Response display config (for forms/wizards) - passed separately to avoid type union issues */
  responseConfig?: IResponseDisplayConfig;
  /** Dynamic config key for chaining operations (for forms/wizards) */
  dynamicConfigKey?: string;
}

/**
 * Get default drawer width based on page type.
 */
function getDefaultDrawerWidth(pageType: IPageType): number | string {
  switch (pageType) {
    case 'list':
      return 800;
    case 'form':
      return 600;
    case 'wizard':
      return 700; // Wizards need more space for multi-step layout
    case 'details':
      return 500;
    case 'dashboard':
      return '80%';
    case 'accordion':
      return 700;
    default:
      return 500;
  }
}

/**
 * Internal Drawer content component.
 */
const DrawerContent = ({
  pageType,
  pageConfig,
  routeParams = {},
  identifiers,
  onSuccess,
  onClose,
  depth = 0,
  responseConfig,
  dynamicConfigKey
}: Omit<IDrawerProps, 'children' | 'title' | 'placement' | 'width' | 'height' | 'closable' | 'mask' | 'maskClosable' | 'destroyOnClose'>) => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        onClose?.();
      }}
    >
      <ModalContextProvider>
        <RenderFromPageType
          pageType={pageType}
          listPageConfig={pageType === 'list' ? pageConfig as ITableConfig : undefined}
          formPageConfig={
            pageType === 'form' ? {
              ...(pageConfig as IForm),
              onSubmitSuccessCallback: onSuccess,
              onCancelCallback: onClose,
              routeParams: routeParams as Record<string, string>,
              // Merge in responseConfig and dynamicConfigKey from drawer props
              // (these are at drawerConfig level in backend, not in drawerPageConfig)
              ...(responseConfig && { responseConfig }),
              ...(dynamicConfigKey && { dynamicConfigKey })
            } as IForm : undefined
          }
          wizardPageConfig={
            pageType === 'wizard' ? {
              ...(pageConfig as IWizardPageConfig),
              onSubmitSuccessCallback: onSuccess,
              onCancelCallback: onClose,
              routeParams
            } as any : undefined
          }
          detailsPageConfig={pageType === 'details' ? pageConfig as IDetailsConfig : undefined}
          dashboardPageConfig={pageType === 'dashboard' ? pageConfig as IDashboardPageConfig : undefined}
          accordionsPageConfig={pageType === 'accordion' ? pageConfig as IAccordionPageConfig : undefined}
          identifiers={identifiers}
          routeParams={routeParams}
          depth={depth}
        />
      </ModalContextProvider>
    </ErrorBoundary>
  );
};

/**
 * Drawer component for slide-out panels.
 * 
 * @example
 * // Quick preview drawer
 * <OpenInDrawer
 *   pageType="details"
 *   pageConfig={detailsConfig}
 *   identifiers={selectedId}
 *   title="Order Details"
 *   placement="right"
 *   width={500}
 * >
 *   <Button>View Details</Button>
 * </OpenInDrawer>
 * 
 * @example
 * // Edit form in drawer
 * <OpenInDrawer
 *   pageType="form"
 *   pageConfig={formConfig}
 *   identifiers={selectedId}
 *   title="Edit Order"
 *   placement="right"
 *   width={600}
 *   onSuccess={() => refreshTable()}
 * >
 *   <Button>Edit</Button>
 * </OpenInDrawer>
 */
export const Drawer = ({
  title,
  placement = 'right',
  width,
  height,
  closable = true,
  mask = true,
  maskClosable = true,
  destroyOnClose = true,
  pageType,
  pageConfig,
  routeParams = {},
  identifiers,
  onClose,
  onSuccess,
  depth = 0,
  responseConfig,
  dynamicConfigKey
}: Omit<IDrawerProps, 'children'> & { open: boolean }) => {
  // Evaluate title template
  const evaluatedTitle = title
    ? evaluateTemplateValue(title, routeParams)
    : undefined;

  // Determine width/height
  const effectiveWidth = width ?? getDefaultDrawerWidth(pageType);

  // ✅ NO response modal management - handled globally by OperationExecutor + ResponseModalContext
  return (
    <AntDrawer
      title={evaluatedTitle}
      placement={placement}
      width={placement === 'left' || placement === 'right' ? effectiveWidth : undefined}
      height={placement === 'top' || placement === 'bottom' ? (height ?? 400) : undefined}
      closable={closable}
      mask={mask}
      maskClosable={maskClosable}
      destroyOnHidden={destroyOnClose}
      open={true}
      onClose={onClose}
    >
      <DrawerContent
        pageType={pageType}
        pageConfig={pageConfig}
        routeParams={routeParams}
        identifiers={identifiers}
        onSuccess={onSuccess}
        onClose={onClose}
        depth={depth}
        responseConfig={responseConfig}
        dynamicConfigKey={dynamicConfigKey}
      />
    </AntDrawer>
  );
};

/**
 * OpenInDrawer - Wrapper component that manages drawer open state.
 * 
 * @example
 * <OpenInDrawer
 *   pageType="details"
 *   pageConfig={detailsConfig}
 *   identifiers={orderId}
 *   title="Order Details"
 * >
 *   <Button>View</Button>
 * </OpenInDrawer>
 */
export const OpenInDrawer = ({ children, ...props }: IDrawerProps) => {
  const [ open, setOpen ] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
    props.onClose?.();
  };

  const handleSuccess = (response?: unknown) => {
    setOpen(false);
    props.onSuccess?.(response);
  };

  return (
    <>
      <Link
        onClick={() => setOpen(true)}
        className="OpenInDrawer"
      >
        {children}
      </Link>

      {open && (
        <Drawer
          {...props}
          open={open}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default OpenInDrawer;
