import React, { Fragment, useEffect } from "react";

import { Space, Table as AntTable, Tag, notification } from 'antd';
import type { TableProps, Breakpoint } from 'antd';
import { Icon } from "../core/common";
import { Link } from "../core/common";
import { Modal, IModalConfig } from "../modal/Modal";
import { callApiMethod, IApiConfig } from "../core";


type ITableActions = "view" | "edit" | "delete";
type IPageAction = {
  url: string;
  label: string;
  icon: string;
  htmlType: string;
  openInModel?: boolean;
  modelConfig?: IModalConfig;
}

export interface ITableConfig {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
  records?: Array<any>;
}

interface ITablePropertiesConfig {
  name: string;
  dataIndex: string;
  actions?: Array<IPageAction>;
  hidden?: boolean;
}

interface IActionIndexValue {
  [key: string]: Array<IPageAction>;
}

interface IRecord {
  [key: string]: string;
}
export const Table = ({ propertiesConfig, records = [], apiConfig } : ITableConfig ) => {
    const [ api, contextHolder ] = notification.useNotification();
    //loop over propertiesConfig and create an object where key is the dataIndex and value is the actions array
    //if the actions array is empty, then do not include the key in the object
    const actionIndexValue: IActionIndexValue = propertiesConfig.map( ( item, index ) => {
        return {
            [item.dataIndex]: item.actions
        }
    }).filter( item => Object.values( item )[0]?.length > 0 )?.reduce( ( acc: IActionIndexValue , item ) => {
        return { ...acc, ...item }
    })

    const columns: TableProps<any>['columns'] = propertiesConfig.filter( ( item: ITablePropertiesConfig ) => !item?.hidden ).map( ( item, index ) => {
        return {
            title: item.name,
            dataIndex: item.dataIndex,
            key: item.dataIndex,
        }
    })

    //call API get records
    const getRecords = async () => {
      const response: any = await callApiMethod(apiConfig);
      if( response?.status === 200 ) {
        setListRecords( response.data.data )
      }  else if( response?.status === 400 || response?.status === 500 ) {
        api.error({ message: response?.error, duration: 2 })
      }
    };

    //check if actionIndexValue has any keys, if yes, then add a column for actions
    if( Object.keys( actionIndexValue ).length > 0 ) {
      columns.push({
            title: <div style={{ display: "flex", justifyContent: "end" }}>Action</div>,
            key: 'action',
            render: (_, record:IRecord ) => {
              //create a list of values from the record object based on the keys in actionIndexValue for every action added
              let primaryIndexValue: Array<string> | string = []
              let recordActions: Array<IPageAction> = [];
              for( let key in record ) {
                if( key in actionIndexValue ) {
                  primaryIndexValue.push( record[key] )
                  recordActions = actionIndexValue[key]
                }
              }
              primaryIndexValue = primaryIndexValue.join("|")

              
              return <div style={{ display: "flex", justifyContent: "end" }}>
                <Space size="middle" align="end">
                  {
                    recordActions.map( ( item: IPageAction, index ) => {
                      return <Fragment key={ index }>{ item.openInModel ? <Modal onSuccessCallback={ getRecords } primaryIndex={ primaryIndexValue } {...item.modelConfig} />  : <Link url={ item.url + "/" + primaryIndexValue}><Icon iconName={ item.icon } /></Link> } </Fragment> 
                    })
                  }
                </Space>
              </div>
            },
      })
    }

    const [ listRecords, setListRecords ] = React.useState( records )

    
    
    useEffect(() => {
      //if records is empty and apiConfig is not empty, then call the api
      if (records.length === 0 && apiConfig?.apiUrl !== "") {
        getRecords();
      }
    }, []);
      
    return <React.Fragment>
      { contextHolder }
      <AntTable scroll={{ x: true}} columns={columns} dataSource={listRecords} />
      </React.Fragment>
}