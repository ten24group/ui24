import React from "react";
import { Button, MenuProps, Tooltip } from "antd";
import { Icon } from "../common/Icons/Icons";
import { OpenInModal } from "../../modal/Modal";
import { OpenRouteInModal } from "../../modal/OpenRouteInModal";
import { OpenRouteInDrawer } from "../../modal/OpenRouteInDrawer";
import { OpenInDrawer } from "../../modal/Drawer";
import { IPageAction } from "../../table/type";
import { substituteUrlParams } from "../utils";
import { evaluateTemplateValue } from "../utils/template";
import { isExternalUrl, resolveAnchorProps } from "../utils/link-utils";

export type MenuItem = Required<MenuProps>[ 'items' ][ number ];

interface RenderActionOptions {
  action: IPageAction;
  key: string;
  isDropdownItem?: boolean;
  isTableRowAction?: boolean;
  isInModal?: boolean;  // NEW: Pass modal context from parent component
  isDisabled?: boolean;
  disabledMessage?: string;
  routeParams?: Record<string, string>;
  primaryIndex?: string;
  record?: Record<string, any>;
  onSuccessCallback?: (response?: any) => void;
  onNavigate?: (url: string) => void;
}

/**
 * Renders a single action (button or dropdown item) with support for modals and navigation
 * Can be used for both page header actions and table row actions
 * 
 * Supports two modal patterns:
 * 1. Inline modal config: { openInModal: true, modalConfig: {...} }
 * 2. Route resolution: { openInModal: true, url: "/view-user/:id" }
 */
export const renderSingleAction = ({
  action,
  key,
  isDropdownItem = false,
  isTableRowAction = false,
  isInModal = false,
  isDisabled = false,
  disabledMessage = '',
  routeParams = {},
  primaryIndex,
  record,
  onSuccessCallback,
  onNavigate
}: RenderActionOptions): React.ReactNode | MenuItem | null => {
  // Check if action should be hidden in modal context
  if (isInModal && action.hideInModal) {
    return null;
  }

  // Evaluate template if provided, otherwise use static label
  // Context: use record for table row actions, routeParams for page actions
  const context = record || routeParams;
  const evaluatedLabel = evaluateTemplateValue(action.template, context, action.label);

  // Evaluate tooltip if provided
  // IMPORTANT: Only show tooltip if explicitly provided or if disabled with message
  // Do NOT use evaluatedLabel as fallback - that would show IDs and other unwanted text
  const evaluatedTooltip = action.tooltip
    ? evaluateTemplateValue(action.tooltip, context)
    : (isDisabled && disabledMessage ? disabledMessage : undefined);

  // Helper to wrap content with Tooltip only if tooltip value exists
  // Wraps content in span to ensure Tooltip has a proper DOM element to attach to
  const wrapWithTooltip = (content: React.ReactNode) => {
    if (!evaluatedTooltip) return content;
    return <Tooltip title={evaluatedTooltip}><span style={{ display: 'inline-block' }}>{content}</span></Tooltip>;
  };

  // Pattern 1: Modal with inline config
  if (action.openInModal && action.modalConfig) {
    // Merge record data with routeParams for template resolution (initialValues)
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const modalTrigger = (
      <OpenInModal
        key={key}
        {...action.modalConfig}
        modalWidth={action.modalWidth}  // Pass modalWidth from action level
        modalTitle={action.modalTitle}  // Pass modalTitle from action level (if set)
        primaryIndex={primaryIndex || routeParams.id}
        identifiers={primaryIndex || routeParams.id}  // Pass identifiers for Form component
        routeParams={finalRouteParams}  // Include record data for template resolution
        onSuccessCallback={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            // For dropdown items, don't include icon in label - MenuItem handles it separately
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "delete"} />
          ) : (
            <Button type="primary" disabled={isDisabled}>{evaluatedLabel}</Button>
          )
        )}
      </OpenInModal>
    );

    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined
      } as MenuItem;
    }
    return modalTrigger;
  }

  // Pattern 2: Modal with route resolution (NEW)
  // Supports both URL-based resolution and modalConfigRef
  if (action.openInModal && (action.url || action.modalConfigRef) && !action.modalConfig) {
    // Merge record data with routeParams for template resolution
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const modalTrigger = (
      <OpenRouteInModal
        key={key}
        url={action.url}
        routeParams={finalRouteParams}
        primaryIndex={primaryIndex}
        modalConfigRef={action.modalConfigRef}
        modalWidth={action.modalWidth}
        modalTitle={action.modalTitle}
        openInModalCondition={action.openInModalCondition}
        onSuccessCallback={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            // For dropdown items, don't include icon in label - MenuItem handles it separately
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "eye"} />
          ) : (
            <Button type="primary">{evaluatedLabel}</Button>
          )
        )}
      </OpenRouteInModal>
    );

    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined
      } as MenuItem;
    }
    return modalTrigger;
  }

  // Pattern 2b: Drawer with inline config
  // Supports inline page config (drawerType + drawerPageConfig)
  if (action.openInDrawer && action.drawerConfig?.drawerType && action.drawerConfig?.drawerPageConfig) {
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const drawerTrigger = (
      <OpenInDrawer
        key={key}
        pageType={action.drawerConfig.drawerType}
        pageConfig={action.drawerConfig.drawerPageConfig}
        responseConfig={action.drawerConfig.responseConfig}
        dynamicConfigKey={action.drawerConfig.dynamicConfigKey}
        title={action.drawerConfig.title}
        placement={action.drawerConfig.placement}
        width={action.drawerConfig.width}
        height={action.drawerConfig.height}
        closable={action.drawerConfig.closable}
        mask={action.drawerConfig.mask}
        maskClosable={action.drawerConfig.maskClosable}
        destroyOnClose={action.drawerConfig.destroyOnClose}
        routeParams={finalRouteParams}
        identifiers={primaryIndex || routeParams.id}
        onSuccess={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "edit"} />
          ) : (
            <Button type="primary" disabled={isDisabled}>{evaluatedLabel}</Button>
          )
        )}
      </OpenInDrawer>
    );

    if (isDropdownItem) {
      return {
        key,
        label: drawerTrigger,
        icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined
      } as MenuItem;
    }
    return drawerTrigger;
  }

  // Pattern 2c: Drawer with route resolution
  // Supports both URL-based resolution and drawerConfigRef
  if (action.openInDrawer && (action.url || action.drawerConfigRef) && !action.openInModal) {
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const drawerTrigger = (
      <OpenRouteInDrawer
        key={key}
        url={action.url}
        routeParams={finalRouteParams}
        primaryIndex={primaryIndex}
        drawerConfigRef={action.drawerConfigRef}
        drawerTitle={action.drawerConfig?.title}
        placement={action.drawerConfig?.placement}
        width={action.drawerConfig?.width}
        height={action.drawerConfig?.height}
        closable={action.drawerConfig?.closable}
        mask={action.drawerConfig?.mask}
        maskClosable={action.drawerConfig?.maskClosable}
        destroyOnClose={action.drawerConfig?.destroyOnClose}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "eye"} />
          ) : (
            <Button type="primary" disabled={isDisabled}>{evaluatedLabel}</Button>
          )
        )}
      </OpenRouteInDrawer>
    );

    if (isDropdownItem) {
      return {
        key,
        label: drawerTrigger,
        icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined
      } as MenuItem;
    }
    return drawerTrigger;
  }

  // Pattern 3: Regular navigation
  let url = action.url || '';

  // Use the existing substituteUrlParams utility properly
  if (record) {
    // For table rows: use record data as routeParams and primaryIndex as fallback
    url = substituteUrlParams(url, record, primaryIndex);
  } else {
    // For page headers: use routeParams as is
    url = substituteUrlParams(url, routeParams);
  }

  const external = isExternalUrl(url);
  const { target, rel } = resolveAnchorProps(action.target, url);

  const handleNavigation = (e?: React.MouseEvent) => {
    if (isDisabled) return;
    if (e) e.preventDefault();

    if (target === '_blank' || external) {
      window.open(url, target || '_blank', 'noopener,noreferrer');
    } else {
      onNavigate?.(url);
    }
  };

  if (isDropdownItem) {
    return {
      key,
      label: evaluatedLabel,
      icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined,
      onClick: () => handleNavigation()
    } as MenuItem;
  }

  // For table rows, return Link with Icon
  if (isTableRowAction) {
    return wrapWithTooltip(
      <a
        href={isDisabled ? undefined : url}
        target={target}
        rel={rel}
        onClick={handleNavigation}
      >
        <Icon iconName={action.icon} />
      </a>
    );
  }

  // For page headers, return Button
  return wrapWithTooltip(
    <Button
      key={key}
      type="primary"
      disabled={isDisabled}
      onClick={() => handleNavigation()}
    >
      {evaluatedLabel}
    </Button>
  );
};

