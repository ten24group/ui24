import React from "react";
import { Button, MenuProps } from "antd";
import { Icon } from "../common/Icons/Icons";
import { OpenInModal } from "../../modal/Modal";
import { OpenRouteInModal } from "../../modal/OpenRouteInModal";
import { IPageAction } from "../../table/type";
import { substituteUrlParams } from "../utils";

export type MenuItem = Required<MenuProps>['items'][number];

interface RenderActionOptions {
  action: IPageAction;
  key: string;
  isDropdownItem?: boolean;
  isTableRowAction?: boolean;
  isInModal?: boolean;  // NEW: Pass modal context from parent component
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
  
  // Pattern 1: Modal with inline config
  if (action.openInModal && action.modalConfig) {
    const modalTrigger = (
      <OpenInModal
        key={key}
        {...action.modalConfig}
        primaryIndex={primaryIndex || routeParams.id}
        routeParams={routeParams}
        onSuccessCallback={onSuccessCallback}
      >
        {isDropdownItem ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            {action.icon && <Icon iconName={action.icon} />}
            {action.label}
          </span>
        ) : isTableRowAction ? (
          <Icon iconName={action.icon || "delete"} />
        ) : (
          <Button type="primary">{action.label}</Button>
        )}
      </OpenInModal>
    );
    
    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }
    return modalTrigger;
  }
  
  // Pattern 2: Modal with route resolution (NEW)
  if (action.openInModal && action.url && !action.modalConfig) {
    const modalTrigger = (
      <OpenRouteInModal
        key={key}
        url={action.url}
        routeParams={record || routeParams}
        primaryIndex={primaryIndex}
        modalWidth={action.modalWidth}
        modalTitle={action.modalTitle}
        openInModalCondition={action.openInModalCondition}
        onSuccessCallback={onSuccessCallback}
      >
        {isDropdownItem ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            {action.icon && <Icon iconName={action.icon} />}
            {action.label}
          </span>
        ) : isTableRowAction ? (
          <Icon iconName={action.icon || "eye"} />
        ) : (
          <Button type="primary">{action.label}</Button>
        )}
      </OpenRouteInModal>
    );
    
    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
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
      label: action.label,
      icon: action.icon ? <Icon iconName={action.icon} /> : undefined,
      onClick: () => onNavigate?.(url)
    } as MenuItem;
  }
  
  // For table rows, return Link with Icon
  if (isTableRowAction) {
    return (
      <a href={url} onClick={(e) => { e.preventDefault(); onNavigate?.(url); }}>
        <Icon iconName={action.icon} />
      </a>
    );
  }
  
  // For page headers, return Button
  return (
    <Button
      key={key}
      type="primary"
      onClick={() => onNavigate?.(url)}
    >
      {action.label}
    </Button>
  );
};

