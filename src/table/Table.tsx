import React, { Fragment } from "react";

import { Space, Table as AntTable, Tag } from 'antd';
import type { TableProps, Breakpoint } from 'antd';
import { Icon } from "../core/common";
import { Link } from "../core/common";
import { Modal, IModalConfig } from "../modal/Modal";

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
  records?: Array<any>;
}

interface ITablePropertiesConfig {
  name: string;
  dataIndex: string;
  actions?: Array<IPageAction>;
}

interface IActionIndexValue {
  [key: string]: Array<IPageAction>;
}

interface IRecord {
  [key: string]: string;
}
export const Table = ({ propertiesConfig, records } : ITableConfig ) => {

    //loop over propertiesConfig and create an object where key is the dataIndex and value is the actions array
    //if the actions array is empty, then do not include the key in the object
    const actionIndexValue: IActionIndexValue = propertiesConfig.map( ( item, index ) => {
        return {
            [item.dataIndex]: item.actions
        }
    }).filter( item => Object.values( item )[0]?.length > 0 )?.reduce( ( acc: IActionIndexValue , item ) => {
        return { ...acc, ...item }
    })

    const columns: TableProps<any>['columns'] = propertiesConfig.map( ( item, index ) => {
        return {
            title: item.name,
            dataIndex: item.dataIndex,
            key: item.dataIndex,
        }
    })

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
                      return <Fragment key={ index }>{ item.openInModel ? <Modal {...item.modelConfig} />  : <Link url={ item.url + "/" + primaryIndexValue}><Icon iconName={ item.icon } /></Link> } </Fragment> 
                    })
                  }
                </Space>
              </div>
            },
      })
    }

    const data: any[] = [
        {
          key: '1',
          name: 'John Brown',
          age: 32,
          address: 'New York No. 1 Lake Park',
          tags: ['nice', 'developer'],
        },
        {
          key: '2',
          name: 'Jim Green',
          age: 42,
          address: 'London No. 1 Lake Park',
          tags: ['loser'],
        },
        {
          key: '3',
          name: 'Joe Black',
          age: 32,
          address: 'Sydney No. 1 Lake Park',
          tags: ['cool', 'teacher'],
        },
      ];

      
    return <AntTable scroll={{ x: true}} columns={columns} dataSource={data} />
}