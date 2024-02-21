import React from "react";

import { Space, Table as AntTable, Tag } from 'antd';
import type { TableProps, Breakpoint } from 'antd';
import { Icon } from "../icons/icon";
import { Link } from "../forms/PostAuthForm";

interface DataType {
  key: string;
  name: string;
  age: number;
  address: string;
  tags: string[];
}

interface ITablePropertiesConfig {

}

export const Table = ({ propertiesConfig } : { propertiesConfig : ITablePropertiesConfig }) => {

    const columns: TableProps<DataType>['columns'] = [
        {
          title: 'Name',
          dataIndex: 'name',
          key: 'name',
          render: (text) => <a>{text}</a>,
        },
        {
          title: 'Age',
          dataIndex: 'age',
          key: 'age',
        },
        {
          title: 'Address',
          dataIndex: 'address',
          key: 'address',
        },
        {
          title: 'Tags',
          key: 'tags',
          dataIndex: 'tags',
          render: (_, { tags }) => (
            <>
              {tags.map((tag) => {
                let color = tag.length > 5 ? 'geekblue' : 'green';
                if (tag === 'loser') {
                  color = 'volcano';
                }
                return (
                  <Tag color={color} key={tag}>
                    {tag.toUpperCase()}
                  </Tag>
                );
              })}
            </>
          ),
        },
        {
          title: <div style={{ display: "flex", justifyContent: "end" }}>Action</div>,
          key: 'action',
          render: (_, record) => (
            <div style={{ display: "flex", justifyContent: "end" }}>
              <Space size="middle" align="end">
                <Link url="/edit"><Icon iconName="edit" /></Link>
                <Link url="/delete"><Icon iconName="delete" /></Link>
              </Space>
            </div>
          ),
        },
      ];

    const data: DataType[] = [
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