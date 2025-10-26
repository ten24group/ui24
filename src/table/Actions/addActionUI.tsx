import React, { Fragment } from "react";
import { ITablePropertiesConfig, IActionIndexValue, IRecord, IPageAction } from "../type";
import type { TableProps } from "antd";
import { OpenInModal } from "../../modal/Modal";
import { Icon, Link } from "../../core/common";
import { Space, Tooltip, Dropdown } from 'antd';
import { useAppContext } from "../../core/context";

// Utility to replace URL parameters with values
const replaceUrlParams = (url: string, params: Record<string, string> = {}) => {
  return url.replace(/:(\w+)/g, (_, param) => params[param] || `:${param}`);
};

// Check if URL has placeholder parameters
const hasUrlPlaceholders = (url: string): boolean => {
  return /:(\w+)/.test(url);
};

export const addActionUI = (propertiesConfig: Array<ITablePropertiesConfig>, getRecordsCallback: () => void, routeParams: Record<string, string> = {}) => {

  const columns: TableProps<any>[ "columns" ] = propertiesConfig
    .filter((item: ITablePropertiesConfig) => !item?.hidden)
    .map((item, index) => {
      const column = {
        title: item.helpText ? (
          <Tooltip 
            title={item.helpText}
            placement="top"
            overlayStyle={{ maxWidth: '300px' }}
          >
            <span style={{ cursor: 'help' }}>{item.name}</span>
          </Tooltip>
        ) : item.name,
        dataIndex: item.dataIndex,
        key: item.dataIndex,
        fieldType: item.fieldType,
        isFilterable: item.isFilterable,
        isSortable: item.isSortable,
        filterConfig: item.filterConfig, // Add this line to preserve filterConfig
      }

      return column;
    });

  //Add action column in Table
  //loop over propertiesConfig and create an object where key is the dataIndex and value is the actions array
  //if the actions array is empty, then do not include the key in the object
  const actionIndexValue: IActionIndexValue = propertiesConfig
    .filter(item => Array.isArray(item.actions) && item.actions.length > 0)
    .reduce((acc: IActionIndexValue, item) => {
      acc[ item.dataIndex ] = item.actions;
      return acc;
    }, {});


  //check if actionIndexValue has any keys, if yes, then add a column for actions
  if (Object.keys(actionIndexValue).length > 0) {
    columns.push({
      title: (
        <div style={{ display: "flex", justifyContent: "end" }}>Action</div>
      ),
      key: "action",
      fixed: 'right',
      render: (_, record: IRecord) => {
        //create a list of values from the record object based on the keys in actionIndexValue for every action added
        let primaryIndexValue: Array<string> | string = [];
        let recordActions: Array<IPageAction> = [];
        
        for (let key in record) {
          if (key in actionIndexValue && actionIndexValue[ key ]) {
            primaryIndexValue.push(record[ key ]);
            recordActions = actionIndexValue[ key ];
          }
        }
        
        // If no actions found through record matching, find the first configured action set
        if (recordActions.length === 0) {
          for (let key in actionIndexValue) {
            if (actionIndexValue[key]) {
              recordActions = actionIndexValue[key];
              break;
            }
          }
        }
        
        primaryIndexValue = primaryIndexValue.join("|");

        const finalRouteParams = {
          ...routeParams,
          ...record
        }

        return (
          <div style={{ display: "flex", justifyContent: "end" }}>
            <Space size="middle" align="end">
              {recordActions?.map((item: IPageAction, index) => {
                return <ListPageAction getRecordsCallback={getRecordsCallback} key={index} item={item} record={record} primaryIndexValue={primaryIndexValue} routeParams={finalRouteParams} />;
              })}
            </Space>
          </div>
        );
      },
    });
  }

  return columns
}

const ListPageAction = ({ item, record, primaryIndexValue, getRecordsCallback, routeParams }: { 
  item: IPageAction, 
  record: IRecord, 
  primaryIndexValue: string,
  getRecordsCallback: () => void,
  routeParams: Record<string, string>
}) => {

  const { notifySuccess } = useAppContext()
  
  /**
   * Renders a single action (used for both regular actions and dropdown items)
   */
  const renderSingleAction = (
    action: IPageAction,
    key: string,
    isDropdownItem: boolean = false
  ): React.ReactNode | { key: string; label: React.ReactNode; icon?: React.ReactNode } => {
    // Handle modal actions
    if (action.openInModal && action.modalConfig) {
      const modalTrigger = (
        <OpenInModal
          key={key}
          onSuccessCallback={(response) => {
            notifySuccess("Operation Successful")
            getRecordsCallback()
          }}
          primaryIndex={primaryIndexValue}
          routeParams={routeParams}
          {...action.modalConfig}
        >
          {isDropdownItem ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              {action.icon && <Icon iconName={action.icon} />}
              {action.label}
            </span>
          ) : (
            <Icon iconName={action.icon || "delete"} />
          )}
        </OpenInModal>
      );
      
      if (isDropdownItem) {
        return {
          key,
          label: modalTrigger,
          icon: action.icon ? <Icon iconName={action.icon} /> : undefined
        };
      }
      return modalTrigger;
    }
    
    // Handle navigation actions
    let actionUrl = action.url || '';
    if (hasUrlPlaceholders(actionUrl)) {
      actionUrl = replaceUrlParams(actionUrl, record);
    } else {
      actionUrl = primaryIndexValue ? `${actionUrl}/${primaryIndexValue}` : actionUrl;
    }
    
    if (isDropdownItem) {
      return {
        key,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {action.icon && <Icon iconName={action.icon} />}
            {action.label}
          </span>
        ),
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined,
        onClick: () => window.location.href = actionUrl
      };
    }
    
    return (
      <Link url={actionUrl}>
        <Icon iconName={action.icon} />
      </Link>
    );
  };
  
  // Check if this is a dropdown action
  const actionType = item.type || (item.items && item.items.length > 0 ? 'dropdown' : 'button');
  
  if (actionType === 'dropdown' && item.items && item.items.length > 0) {
    const menuItems = item.items.map((dropItem, dropIndex) => 
      renderSingleAction(
        dropItem,
        `${item.label}-${dropIndex}`,
        true
      )
    );
    
    return (
      <Fragment>
        <Dropdown menu={{ items: menuItems as any }} trigger={['click']}>
          <a onClick={(e) => e.preventDefault()} style={{ cursor: 'pointer' }}>
            <Icon iconName={item.icon || "more"} />
          </a>
        </Dropdown>
      </Fragment>
    );
  }
  
  // Regular single action
  return <Fragment>{renderSingleAction(item, `action-${item.label}`, false)}{" "}</Fragment>
}