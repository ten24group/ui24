import React, { Fragment, useMemo } from "react";
import { ITablePropertiesConfig, IActionIndexValue, IRecord, IPageAction } from "../type";
import type { TableProps, MenuProps } from "antd";
import { Icon, Link } from "../../core/common";
import { Space, Tooltip, Dropdown } from 'antd';
import { useAppContext, useEvaluationContext, useModalContext } from "../../core/context";
import { renderSingleAction, MenuItem } from "../../core/utils/actionRenderer";
import { useEvaluation } from "../../core/hooks";
import { useCoreNavigator } from "../../routes/Navigation";


export const addActionUI = (propertiesConfig: Array<ITablePropertiesConfig>, getRecordsCallback: () => void, routeParams: Record<string, string> = {}) => {

  const columns: TableProps<any>[ "columns" ] = propertiesConfig
    .filter((item: ITablePropertiesConfig) => !item?.hidden)
    .map((item, index) => {
      const column = {
        title: item.helpText ? (
          <Tooltip 
            title={item.helpText}
            placement="top"
            styles={{ root: { maxWidth: '300px' } }}
          >
            <span style={{ cursor: 'help' }}>{item.name}</span>
          </Tooltip>
        ) : item.name,
        dataIndex: item.dataIndex,
        key: item.dataIndex,
        name: item.name,  // Preserve name for RelationFieldRenderer label
        fieldType: item.fieldType,
        type: item.type,  // Preserve data type (list, map, etc.)
        isFilterable: item.isFilterable,
        isSortable: item.isSortable,
        filterConfig: item.filterConfig,
        relationConfig: item.relationConfig,  // For relation field rendering
        template: item.template,  // For template-based rendering
        groupTitle: item.groupTitle,  // For column grouping
        durationUnit: item.durationUnit,  // For duration field rendering
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
        
        // NEW: Auto-detect primary identifier from propertiesConfig (Problem 1)
        if (!primaryIndexValue || primaryIndexValue === '') {
          const identifierField = propertiesConfig.find((prop: ITablePropertiesConfig) => prop.isIdentifier);
          if (identifierField && record[identifierField.dataIndex]) {
            primaryIndexValue = String(record[identifierField.dataIndex]);
          } else if (record.id) {
            // Fallback to 'id' field
            primaryIndexValue = String(record.id);
          }
        }

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

const ListPageAction = React.memo(({ item, record, primaryIndexValue, getRecordsCallback, routeParams }: { 
  item: IPageAction, 
  record: IRecord, 
  primaryIndexValue: string,
  getRecordsCallback: () => void,
  routeParams: Record<string, string>
}) => {

  const { notifySuccess } = useAppContext()
  const { isInModal } = useModalContext()
  const navigate = useCoreNavigator();

  return (
    <ListPageActionInner 
      item={item}
      record={record}
      primaryIndexValue={primaryIndexValue}
      getRecordsCallback={getRecordsCallback}
      routeParams={routeParams}
      notifySuccess={notifySuccess}
      isInModal={isInModal}
      navigate={navigate}
    />
  );
});

const ListPageActionInner = React.memo(({ 
  item, 
  record, 
  primaryIndexValue, 
  getRecordsCallback, 
  routeParams,
  notifySuccess,
  isInModal,
  navigate
}: { 
  item: IPageAction, 
  record: IRecord, 
  primaryIndexValue: string,
  getRecordsCallback: () => void,
  routeParams: Record<string, string>,
  notifySuccess: (message: string) => void,
  isInModal: boolean,
  navigate: (path: string) => void
}) => {
  
  // Use raw API data for evaluation (before display formatting mutations)
  // This ensures boolean conditions work correctly (false vs "No")
  const rawRecord = (record as any).__raw__ || record;
  const { visible, enabled, disabledMessage } = useEvaluation(item.visibility, { record: rawRecord });
  
  // Don't render if not visible
  if (!visible) return null;
  
  // Check if this is a dropdown action
  const actionType = item.type || (item.items && item.items.length > 0 ? 'dropdown' : 'button');
  const isDisabled = !enabled;
  
  if (actionType === 'dropdown' && item.items && item.items.length > 0) {
    const menuItems: MenuProps['items'] = item.items.map((dropItem, dropIndex) => 
      renderSingleAction({
        action: dropItem,
        key: `${item.label}-${dropIndex}`,
        isDropdownItem: true,
        isTableRowAction: true,
        isInModal,
        routeParams,
        primaryIndex: primaryIndexValue,
        record,
        onSuccessCallback: (response) => {
          notifySuccess("Operation Successful")
          getRecordsCallback()
        },
        onNavigate: (url) => navigate(url)
      }) as MenuItem
    );
    
    const dropdownTrigger = (
      <a onClick={(e) => e.preventDefault()} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }}>
        <Icon iconName={item.icon || "more"} />
      </a>
    );
    
    return (
      <Fragment>
        <Tooltip title={isDisabled ? disabledMessage : undefined}>
          <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={isDisabled}>
            {dropdownTrigger}
        </Dropdown>
        </Tooltip>
      </Fragment>
    );
  }
  
  // Regular single action - render as Icon for table rows with disabled state
  const modifiedAction = isDisabled ? { ...item, disabled: true } : item;
  
  const actionElement = renderSingleAction({
    action: modifiedAction,
        key: `action-${item.label}`,
        isDropdownItem: false,
        isTableRowAction: true,
        isInModal,
        routeParams,
        primaryIndex: primaryIndexValue,
        record,
        onSuccessCallback: (response) => {
          notifySuccess("Operation Successful")
          getRecordsCallback()
        },
        onNavigate: (url) => navigate(url)
  }) as React.ReactNode;
  
  if (isDisabled && disabledMessage) {
    return (
      <Fragment>
        <Tooltip title={disabledMessage}>
          <span>{actionElement}</span>
        </Tooltip>
      </Fragment>
    );
  }
  
  return (
    <Fragment>
      {actionElement}
      {" "}
    </Fragment>
  );
});