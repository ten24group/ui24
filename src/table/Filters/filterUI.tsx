import { FilterFilled } from '@ant-design/icons';
import { Input, Button, Space, Tag, Alert, Checkbox } from 'antd';
import { Icon } from '../../core/common';
import React from 'react';
import { filterOperators } from './filterOperators';

interface IColumnFilterProps {
  dataIndex: string
  title: string
  fieldType: string
}

export const filterUI = (
  { dataIndex, title, fieldType }: IColumnFilterProps, applyFilters: Function, removeFilter: Function, getAppliedFilterForColumn: Function, facetResults: Record<string, Record<string, number>>
) => {

  const FilterDropdownComponent = ({ close, confirm }) => {
    const nonTextualTypes = [ 'number', 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle' ];
    const isTextColumn = fieldType ? !nonTextualTypes.includes(fieldType.toLowerCase()) : true;
    const defaultOperator = isTextColumn ? 'contains' : 'eq';

    const [ filterOperator, setFilterOperator ] = React.useState<string>(defaultOperator);
    const [ filterValue, setFilterValue ] = React.useState<string>("");
    const [ filterEndValue, setFilterEndValue ] = React.useState<string>("");
    const [ filterInList, setFilterInList ] = React.useState<Array<string>>([]);
    const [ errors, setErrors ] = React.useState<Record<string, string>>({})
    const isListFilter = filterOperator === "in" || filterOperator === "nin"
    const isBetweenFilter = filterOperator === "bt"
    const isFilterValueRequired = filterOperator !== "isEmpty" && filterOperator !== "isNull" && filterOperator !== "in" && filterOperator !== "nin"
    const hideFilterValue = filterOperator === "isEmpty" || filterOperator === "isNull"
    const [ showAdvanced, setShowAdvanced ] = React.useState<boolean>(false);
    const [ isFilterActive, setIsFilterActive ] = React.useState<boolean>(false);
    const columnFacets = facetResults?.[ dataIndex ] ?? {};
    const hasFacets = Object.keys(columnFacets).length > 0;
    const appliedFilterForColumn = getAppliedFilterForColumn(dataIndex);
    const appliedInFilterValues = (appliedFilterForColumn.in || []) as string[];

    const handleOperatorChange = (newOperator: string) => {
      //on change of filter operator reset the values
      setFilterValue("");
      setFilterEndValue("");
      setFilterInList([]);
      setErrors({});
      setFilterOperator(newOperator);
    }

    React.useEffect(() => {
      const appliedFilterForColumn = getAppliedFilterForColumn(dataIndex);
      if (Object.keys(appliedFilterForColumn).length > 0) {
        setIsFilterActive(true);
        const operator = Object.keys(appliedFilterForColumn)[ 0 ];
        const value = appliedFilterForColumn[ operator ];
        setFilterOperator(operator);
        if (Array.isArray(value)) {
          // Use operator directly, not the state variable 'isBetweenFilter' which might be stale
          if (operator === 'bt') {
            setFilterValue(value[ 0 ]);
            setFilterEndValue(value[ 1 ]);
          } else {
            setFilterInList(value);
          }
        } else {
          setFilterValue(value);
        }
      }
    }, []);

    const resetState = () => {
      setFilterOperator(defaultOperator);
      setFilterEndValue("");
      setFilterInList([]);
      setErrors({});
      setFilterValue("");
      setIsFilterActive(false);
    }

    const applyFilter = (closeFn: Function) => {
      //run validations
      if (filterOperator === "") {
        setErrors({ filterOperator: "Please select filter operator" })
      } else if ((isBetweenFilter && (filterValue === "" || filterEndValue === "")) || (isListFilter && filterInList.length === 0) || (isFilterValueRequired && filterValue === "")) {
        setErrors({ filterValue: "Please enter value", filterEndValue: "Please enter value" })
      } else {
        //apply filter
        applyFilters(dataIndex, filterOperator, isBetweenFilter ? [ filterValue, filterEndValue ] : isListFilter ? filterInList : filterValue)
        resetState()
        closeFn()
      }
    }

    const clearFilter = (closeFn: Function) => {
      removeFilter(dataIndex);
      resetState();
      closeFn();
    }


    const handleAddToList = () => {
      if (filterValue !== "") {
        setFilterInList([ ...filterInList, filterValue ])
        setFilterValue("");
        setErrors({});
      } else {
        setErrors({ filterValue: "Please enter value" })
      }

    }

    const handleRemoveFromList = (index: number) => {
      const list = filterInList.filter((item, idx) => idx !== index)
      setFilterInList([ ...list ]);
    }


    return (
      <div style={{ padding: 8, display: "flex", flexDirection: "column" }} onKeyDown={(e) => e.stopPropagation()}>
        {hasFacets && (
          <div style={{ marginBottom: '10px' }}>
            <h4>{title}</h4>
            <Checkbox.Group
              style={{ display: 'flex', flexDirection: 'column' }}
              onChange={(values) => applyFilters(dataIndex, 'in', values)}
              value={appliedInFilterValues}
            >
              {Object.entries(columnFacets).map(([ value, count ]) => (
                <Checkbox key={value} value={value}>
                  {value} ({count})
                </Checkbox>
              ))}
            </Checkbox.Group>
            <hr style={{ margin: '10px 0' }} />
          </div>
        )}
        <div >
          <div style={{ display: "flex" }}>
            {!hideFilterValue && <Input placeholder={`${title}`} value={filterValue}
              onChange={(e) =>
                setFilterValue(e.target.value)
              }
              style={{ marginBottom: 8, display: "block" }} />}

            {isListFilter && <span style={{ paddingLeft: 1 }} ><Button onClick={handleAddToList} type="primary" htmlType="button" >
              <Icon iconName="plus" />
            </Button></span>}
          </div>
          <Alert message={errors.filterValue} type="error" style={{ display: errors.filterValue ? "block" : "none" }} />
          {isBetweenFilter && <><Input
            placeholder={`${title} End Value`}
            value={filterEndValue}
            onChange={(e) =>
              setFilterEndValue(e.target.value)
            }
            style={{ marginBottom: 8, display: "block" }}
          />
            <Alert message={errors.filterEndValue} type="error" style={{ display: errors.filterEndValue ? "block" : "none" }} />
          </>
          }
          {isListFilter && <div style={{ padding: 4, display: "flex" }}>{[ ...filterInList ].map((item, index) => {
            return <Tag key={index} color="#108ee9" closable onClose={(e) => {
              e.preventDefault()
              handleRemoveFromList(index)
            }}>{item}</Tag>
          })}</div>}

          <Space>
            <Button type="primary" onClick={() => applyFilter(close)} size="small" style={{ width: 90 }} > Apply </Button>
            <Button onClick={() => resetState()} size="small" style={{ width: 90 }}> Reset </Button>
            {isFilterActive && <Button danger onClick={() => clearFilter(close)} size="small" style={{ width: 90 }}> Clear </Button>}
            <Button type="link" size="small" onClick={() => {
              resetState()
              close();
            }}
            >
              close
            </Button>
          </Space>
          <div style={{ paddingTop: 1, marginTop: '10px' }}>
            <Button type="link" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          </div>
          {showAdvanced && <div style={{ paddingTop: 1 }}>
            <h4>Filter Operators</h4>
            <Alert message={errors.filterOperator} type="error" style={{ display: errors.filterOperator ? "block" : "none" }} />
            <Space size={[ "small", 4 ]} wrap style={{ display: "inline-grid", gridTemplateColumns: "auto auto auto" }}>
              {filterOperators.map((item, index) => {
                return (
                  <Button key={index} type={filterOperator === item.value ? "primary" : "default"} size="middle" onClick={() => handleOperatorChange(item.value)}>{item.label}</Button>
                )
              })}
            </Space>
          </div>}
        </div>
      </div>
    )

  }

  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      close,
    }) => <FilterDropdownComponent confirm={confirm} close={close} />,
    filterIcon: (filtered: boolean) => (
      <FilterFilled style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
  }
}
