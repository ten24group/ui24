import React from "react";
import { Button, MenuProps, Tooltip } from "antd";
import { Icon } from "../common/Icons/Icons";
import { OpenInModal } from "../../modal/Modal";
import { OpenRouteInModal } from "../../modal/OpenRouteInModal";
import { IPageAction } from "../../table/type";
import { substituteUrlParams } from "../utils";
import { evaluateTemplateValue } from "../utils/template";

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

  // Pattern 1: Modal with inline config
  if (action.openInModal && action.modalConfig) {
    // Merge record data with routeParams for template resolution (initialValues)
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;
    
    const modalTrigger = (
      <OpenInModal
        key={key}
        {...action.modalConfig}
        primaryIndex={primaryIndex || routeParams.id}
        identifiers={primaryIndex || routeParams.id}  // Pass identifiers for Form component
        routeParams={finalRouteParams}  // Include record data for template resolution
        onSuccessCallback={onSuccessCallback}
      >
        <Tooltip title={disabledMessage}>
          {isDropdownItem ? (
            // For dropdown items, don't include icon in label - MenuItem handles it separately
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "delete"} />
          ) : (
            <Button type="primary" disabled={isDisabled}>{evaluatedLabel}</Button>
          )}
        </Tooltip>
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
  if (action.openInModal && action.url && !action.modalConfig) {
    // Merge record data with routeParams for template resolution
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;
    
    const modalTrigger = (
      <OpenRouteInModal
        key={key}
        url={action.url}
        routeParams={finalRouteParams}
        primaryIndex={primaryIndex}
        modalWidth={action.modalWidth}
        modalTitle={action.modalTitle}
        openInModalCondition={action.openInModalCondition}
        onSuccessCallback={onSuccessCallback}
      >
        <Tooltip title={disabledMessage}>
          {isDropdownItem ? (
            // For dropdown items, don't include icon in label - MenuItem handles it separately
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "eye"} />
          ) : (
            <Button type="primary">{evaluatedLabel}</Button>
          )}
        </Tooltip>
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

  if (isDropdownItem) {
    return {
      key,
      label: evaluatedLabel,
      icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined,
      onClick: () => onNavigate?.(url)
    } as MenuItem;
  }

  // For table rows, return Link with Icon
  if (isTableRowAction) {
    return (
      <Tooltip title={disabledMessage}>
        <a href={ isDisabled ? undefined : url} onClick={(e) => { e.preventDefault(); onNavigate?.(url); }}>
          <Icon iconName={action.icon} />
        </a>
      </Tooltip>
    );
  }

  // For page headers, return Button
  return (
    <Tooltip title={disabledMessage}>
      <Button
        key={key}
        type="primary"
        disabled={isDisabled}
        onClick={() => onNavigate?.(url)}
      >
        {evaluatedLabel}
      </Button>
    </Tooltip>
  );
};

