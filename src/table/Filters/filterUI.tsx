import { FilterFilled } from '@ant-design/icons';
import { Input, Button, Space, Tag, Alert } from 'antd';
import { Icon } from '../../core/common';
import React from 'react';
import { filterOperators } from './filterOperators';

interface IColumnFilterProps {
  dataIndex: string
  title: string
  fieldType: Array<string>
}

export const filterUI = (
  {dataIndex, title, fieldType} : IColumnFilterProps, applyFilters: Function
) => {
    const [ filterOperator, setFilterOperator ] = React.useState<string>("");
    const [ filterValue, setFilterValue ] = React.useState<string>("");
    const [ filterEndValue, setFilterEndValue ] = React.useState<string>("");
    const [ filterInList , setFilterInList ] = React.useState<Array<string>>([]);
    const [ errors, setErrors ] = React.useState<Record<string, string>>({})
    const isListFilter = filterOperator === "in" || filterOperator === "nin" 
    const isBetweenFilter = filterOperator === "bt"
    const isFilterValueRequired = filterOperator !== "isEmpty" && filterOperator !== "isNull" && filterOperator !== "in" && filterOperator !== "nin"
    const hideFilterValue = filterOperator === "isEmpty" || filterOperator === "isNull" 

    const resetState = () => {
        setFilterOperator("");
        setFilterEndValue("");
        setFilterInList([]);
        setErrors({});
        setFilterValue("");
    }

    const applyFilter = ( close: Function ) => {
      //run validations
      if( filterOperator === "") {
        setErrors({filterOperator: "Please select filter operator"})
      } else if( ( isBetweenFilter && (filterValue === "" || filterEndValue === "") ) || ( isListFilter && filterInList.length === 0 ) || ( isFilterValueRequired && filterValue === "") ) {
          setErrors({filterValue: "Please enter value", filterEndValue: "Please enter value"})
        } else {
          //apply filter
          applyFilters(dataIndex, filterOperator, isBetweenFilter ? [filterValue, filterEndValue] : isListFilter ? filterInList : filterValue)
          resetState()
          close()
        }
    }

    const handleAddToList = () => {
      if( filterValue !== "" ) {
        setFilterInList([...filterInList, filterValue])
        setFilterValue("");
        setErrors({});
      } else {
        setErrors({filterValue: "Please enter value"})
      }
      
    }

    const handleRemoveFromList = (index: number) => {
      const list = filterInList.filter((item, idx) => idx !== index)
      setFilterInList([...list] );
    }

    return {
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          close,
        }) => (
          <div style={{ padding: 8, display: "flex", flexDirection: "column" }} onKeyDown={(e) => e.stopPropagation()}>
            <div >
              <div style={{ display: "flex"}}>
              { !hideFilterValue && <Input placeholder={`${title}`} value={filterValue}
                onChange={(e) =>
                  setFilterValue(e.target.value)
                }
                style={{ marginBottom: 8, display: "block" }} /> }

            { isListFilter && <span style={{paddingLeft: 1}} ><Button onClick={ handleAddToList } type="primary" htmlType="button" >
              <Icon iconName="plus" />
            </Button></span> }
            </div>
            <Alert message={errors.filterValue} type="error" style={{display: errors.filterValue ? "block" : "none"}} />
            { isBetweenFilter && <><Input
              placeholder={`${title} End Value`}
              value={filterValue}
              onChange={(e) =>
                setFilterEndValue(e.target.value)
              }
              style={{ marginBottom: 8, display: "block" }}
            />
            <Alert message={errors.filterEndValue} type="error" style={{display: errors.filterEndValue ? "block" : "none"}} />
            </>
             }
            { isListFilter && <div style={{padding: 4, display: "flex"}}>{ [...filterInList].map((item, index) => {
              return <Tag key={index} color="#108ee9" closable onClose={(e) => {
                e.preventDefault()
                handleRemoveFromList(index)
              }}>{item}</Tag>
            })}</div> }

            <Space>
              <Button type="primary" onClick={() => applyFilter( close ) } size="small" style={{ width: 90 }} > Apply </Button>
              <Button onClick={() => resetState() } size="small" style={{ width: 90 }}> Reset </Button>
              <Button type="link" size="small" onClick={() => {
                    resetState()
                    close();
                }}
              >
                close
              </Button>
            </Space>
            </div>
            <div style={{paddingTop: 1}}>
              <h4>Filter Operators</h4>
              <Alert message={errors.filterOperator} type="error" style={{display: errors.filterOperator ? "block" : "none"}} />
              <Space size={["small",4]} wrap style={{ display: "inline-grid", gridTemplateColumns: "auto auto auto"}}>
              { filterOperators.map((item, index) => { 
                  return (
                      <Button key={index} type={ filterOperator === item.value ? "primary" : "default"} size="middle" onClick={() => setFilterOperator( item.value) }>{item.label}</Button>
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
