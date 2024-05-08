import { FilterFilled } from '@ant-design/icons';
import type { TableColumnType } from 'antd';
import { Button, Input, Space, } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import React from 'react';
interface IFilterOperator {
    title: string;
    value: string;
}
const filterOperators: Array<IFilterOperator> = [{
    title: "Equals",
    value: "eq",
}, {
    title: "Not Equals",
    value: "neq",
}, , {
    title: "Greater Than",
    value: "gt",
}, {
    title: "Less Than",
    value: "lt",
}, {
    title: "Greater Than Equals",
    value: "gte",
}, {
    title: "Less Than Equals",
    value: "lte",
}, {
    title: "Between",
    value: "bt",
}, {
    title: "Is Empty",
    value: "isEmpty",
}, {
    title: "Is Null",
    value: "isNull",
}, {
    title: "Contains",
    value: "contains",
}, {
    title: "Does Not Contain",
    value: "notContains",
}, {
    title: "Contains Some",
    value: "containsSome"
},
{
    title: "Starts With",
    value: "startsWith",
}, {
    title: "Ends With",
    value: "endsWith",
}, {
    title: "Like",
    value: "like",
}, {
    title: "In List",
    value: "in",
}, {
    title: "Not In List",
    value: "nin",
}
]

const handleSearch = (
  selectedKeys: string[],
  confirm: FilterDropdownProps["confirm"],
  dataIndex: string
) => {
  console.log("selectedKeys", selectedKeys);
};

export const getColumnFilterProps = (
  dataIndex: string,
  title: string
) => {
    const [ filterOperator, setFilterOperator ] = React.useState<string>("");

    const resetState = () => {
        setFilterOperator("");
    }

    return {
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          close,
        }) => (
          <div style={{ padding: 8, display: "flex", flexDirection: "column" }} onKeyDown={(e) => e.stopPropagation()}>
            <div><Input
              // ref={searchInput}
              placeholder={`${title}`}
              value={selectedKeys[0]}
              onChange={(e) =>
                setSelectedKeys(e.target.value ? [e.target.value] : [])
              }
              onPressEnter={() =>
                handleSearch(selectedKeys as string[], confirm, dataIndex)
              }
              style={{ marginBottom: 8, display: "block" }}
            />
            <Space>
              <Button
                type="primary"
                onClick={() =>
                  handleSearch(selectedKeys as string[], confirm, dataIndex)
                }
                size="small"
                style={{ width: 90 }}
              >
                Apply
              </Button>
              <Button onClick={() => resetState() } size="small" style={{ width: 90 }}>
                Reset
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => {
                    resetState()
                    close();
                }}
              >
                close
              </Button>
            </Space></div>
            <div style={{paddingTop: 1}}>
              <h4>Filter Operators</h4>
              <Space size={["small",4]} wrap style={{ display: "inline-grid", gridTemplateColumns: "auto auto auto"}}>
              { filterOperators.map((item, index) => { 
                  return (
                      <Button key={index} type={ filterOperator === item.value ? "primary" : "default"} size="middle" onClick={() => setFilterOperator( item.value) }>{item.title}</Button>
                  )
              } )}
            </Space>
            </div>
          </div>
        ),
        filterIcon: (filtered: boolean) => (
          <FilterFilled style={{ color: filtered ? "#1677ff" : undefined }} />
        ),
      }


};
