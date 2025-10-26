import React from "react";
import { Button, MenuProps } from "antd";
import { Icon } from "../common/Icons/Icons";
import { OpenInModal } from "../../modal/Modal";
import { IPageAction } from "../../table/type";
import { substituteUrlParams } from "../utils";

export type MenuItem = Required<MenuProps>['items'][number];

interface RenderActionOptions {
  action: IPageAction;
  key: string;
  isDropdownItem?: boolean;
  isTableRowAction?: boolean;
  routeParams?: Record<string, string>;
  primaryIndex?: string;
  record?: Record<string, any>;
  onSuccessCallback?: (response?: any) => void;
  onNavigate?: (url: string) => void;
}

/**
 * Renders a single action (button or dropdown item) with support for modals and navigation
 * Can be used for both page header actions and table row actions
 */
export const renderSingleAction = ({
  action,
  key,
  isDropdownItem = false,
  isTableRowAction = false,
  routeParams = {},
  primaryIndex,
  record,
  onSuccessCallback,
  onNavigate
}: RenderActionOptions): React.ReactNode | MenuItem => {
  // Handle modal actions
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
  
  // Handle navigation actions
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

