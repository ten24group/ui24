import React, { Fragment } from "react";
import { ITablePropertiesConfig, IActionIndexValue, IRecord, IPageAction } from "../type";
import type { TableProps } from "antd";
import { Modal } from "../../modal/Modal";
import { Icon, Link } from "../../core/common";
import { Space } from 'antd';

export const addActionUI = ( propertiesConfig: Array<ITablePropertiesConfig>, getRecordsCallback: () => void) => {

    const columns: TableProps<any>["columns"] = propertiesConfig
      .filter((item: ITablePropertiesConfig) => !item?.hidden)
      .map((item, index) => {
        const column = {
          title: item.name,
          dataIndex: item.dataIndex,
          key: item.dataIndex,
          fieldType: item.fieldType,
          isFilterable: item.isFilterable,
        }
        
        return column;
      });
    
    //Add action column in Table
    //loop over propertiesConfig and create an object where key is the dataIndex and value is the actions array
    //if the actions array is empty, then do not include the key in the object
    const actionIndexValue: IActionIndexValue = propertiesConfig
      .map((item, index) => {
        return {
          [item.dataIndex]: item.actions,
        };
      })
      .filter((item) => Object.values(item)?.length > 0)
      ?.reduce((acc: IActionIndexValue, item) => {
        return { ...acc, ...item };
      });
  
    //check if actionIndexValue has any keys, if yes, then add a column for actions
    if (Object.keys(actionIndexValue).length > 0) {
      columns.push({
        title: (
          <div style={{ display: "flex", justifyContent: "end" }}>Action</div>
        ),
        key: "action",
        render: (_, record: IRecord) => {
          //create a list of values from the record object based on the keys in actionIndexValue for every action added
          let primaryIndexValue: Array<string> | string = [];
          let recordActions: Array<IPageAction> = [];
          for (let key in record) {
            if (key in actionIndexValue && actionIndexValue[key]) {
              primaryIndexValue.push(record[key]);
              recordActions = actionIndexValue[key];
            }
          }
          primaryIndexValue = primaryIndexValue.join("|");
  
          return (
            <div style={{ display: "flex", justifyContent: "end" }}>
              <Space size="middle" align="end">
                {recordActions?.map((item: IPageAction, index) => {
                  return (
                    <Fragment key={index}>
                      {item.openInModel ? (
                        <Modal
                          onSuccessCallback={getRecordsCallback}
                          primaryIndex={primaryIndexValue}
                          {...item.modelConfig}
                        />
                      ) : (
                        <Link url={item.url + "/" + primaryIndexValue}>
                          <Icon iconName={item.icon} />
                        </Link>
                      )}{" "}
                    </Fragment>
                  );
                })}
              </Space>
            </div>
          );
        },
      });
    }
  
    return columns
  }