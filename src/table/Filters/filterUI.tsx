import { FilterFilled } from '@ant-design/icons';
import { Input, Button, Space, Tag, Alert, Checkbox, Switch, Divider, Select } from 'antd';
import { Icon } from '../../core/common';
import React from 'react';
import { filterOperators } from './filterOperators';
import { FieldType } from '../../core/types/field-types';

interface IColumnFilterProps {
  dataIndex: string
  title: string
  fieldType: FieldType
  filterConfig?: {
    defaultOperator?: string;
    availableOperators?: string[];
    predefinedOptions?: Array<{ label: string; value: string }>;
    filterType?: 'text' | 'select' | 'datetime' | 'number' | 'boolean';
  };
}

export const filterUI = (
  { dataIndex, title, fieldType, filterConfig }: IColumnFilterProps,
  applyFilters: Function,
  removeFilter: Function,
  getAppliedFilterForColumn: Function,
  facetResults: Record<string, Record<string, number>>,
  facetedColumns: string[],
  toggleFacetedColumn: (dataIndex: string) => void,
  enableFacetFilters: boolean = false
) => {

  const FilterDropdownComponent = ({ close, confirm }) => {
    const nonTextualTypes = [ 'number', 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle' ];
    const isTextColumn = fieldType ? !nonTextualTypes.includes(fieldType.toLowerCase()) : true;
    
    // Use filterConfig.defaultOperator if provided, otherwise fall back to fieldType-based logic
    const defaultOperator = filterConfig?.defaultOperator || (isTextColumn ? 'contains' : 'eq');

    // Get available operators - use filterConfig.availableOperators if provided, otherwise use all operators
    const availableOperators = filterConfig?.availableOperators 
      ? filterOperators.filter(op => filterConfig.availableOperators!.includes(op.value))
      : filterOperators;

    const [ filterOperator, setFilterOperator ] = React.useState<string>(defaultOperator);
    const [ filterValue, setFilterValue ] = React.useState<string>("");
    const [ filterEndValue, setFilterEndValue ] = React.useState<string>("");
    const [ filterInList, setFilterInList ] = React.useState<Array<string>>([]);
    const [ selectedFacets, setSelectedFacets ] = React.useState<Array<string>>([]);
    const [ errors, setErrors ] = React.useState<Record<string, string>>({})
    const isListFilter = filterOperator === "in" || filterOperator === "nin"
    const isBetweenFilter = filterOperator === "bt"
    const isFilterValueRequired = filterOperator !== "isEmpty" && filterOperator !== "isNull" && filterOperator !== "in" && filterOperator !== "nin"
    const hideFilterValue = filterOperator === "isEmpty" || filterOperator === "isNull"
    const [ showAdvanced, setShowAdvanced ] = React.useState<boolean>(false);
    const [ isFilterActive, setIsFilterActive ] = React.useState<boolean>(false);
    const columnFacets = facetResults?.[ dataIndex ] ?? {};
    const hasFacets = Object.keys(columnFacets).length > 0;
    const isFacetEnabled = facetedColumns.includes(dataIndex);
    const appliedFilterForColumn = getAppliedFilterForColumn(dataIndex);
    const appliedInFilterValues = (appliedFilterForColumn.in || []) as string[];

    // Check if this column has predefined options
    const hasPredefinedOptions = filterConfig?.predefinedOptions && filterConfig.predefinedOptions.length > 0;
    const filterType = filterConfig?.filterType || (isTextColumn ? 'text' : 'text');

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
      } else if (filterType === 'datetime') {
        // Prefill datetime fields with current date when no previous filter exists
        const now = new Date();
        // Format as YYYY-MM-DDTHH:MM for datetime-local input
        const currentDateTime = now.toISOString().slice(0, 16);
        setFilterValue(currentDateTime);
      }
    }, []);

    const resetState = () => {
      setFilterOperator(defaultOperator);
      setFilterEndValue("");
      setFilterInList([]);
      setErrors({});
      setFilterValue("");
      setIsFilterActive(false);
      setSelectedFacets([]);
    }

    const applyFilter = (closeFn: Function) => {
      //run validations
      if (filterOperator === "") {
        setErrors({ filterOperator: "Please select filter operator" })
      } else if ((selectedFacets.length === 0 && isBetweenFilter && (filterValue === "" || filterEndValue === "")) || (selectedFacets.length === 0 && isListFilter && filterInList.length === 0) || (selectedFacets.length === 0 && isFilterValueRequired && filterValue === "")) {
        setErrors({ filterValue: "Please enter value", filterEndValue: "Please enter value" })
      } else {
        //apply filter
        const filterToApply = selectedFacets.length > 0 ? selectedFacets : isListFilter ? filterInList : filterValue;
        const operatorToApply = selectedFacets.length > 0 ? 'in' : filterOperator;
        applyFilters(dataIndex, operatorToApply, isBetweenFilter ? [ filterValue, filterEndValue ] : filterToApply)
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

    // Render appropriate input based on filterType and predefined options
    const renderFilterInput = () => {
      if (hideFilterValue) return null;

      if (hasPredefinedOptions && (filterOperator === 'eq' || filterOperator === 'in' || filterOperator === 'nin')) {
        return (
          <Select
            placeholder={`Select ${title}`}
            value={filterValue}
            onChange={(value) => setFilterValue(value)}
            style={{ width: '100%' }}
            options={filterConfig!.predefinedOptions!.map(option => ({
              label: option.label,
              value: option.value
            }))}
          />
        );
      }

      if (filterType === 'select' && hasPredefinedOptions) {
        return (
          <Select
            placeholder={`Select ${title}`}
            value={filterValue}
            onChange={(value) => setFilterValue(value)}
            style={{ width: '100%' }}
            options={filterConfig!.predefinedOptions!.map(option => ({
              label: option.label,
              value: option.value
            }))}
          />
        );
      }

      if (filterType === 'datetime') {
        return (
          <Input
            type="datetime-local"
            placeholder={`${title}`}
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        );
      }

      if (filterType === 'number') {
        return (
          <Input
            type="number"
            placeholder={`${title}`}
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        );
      }

      if (filterType === 'boolean') {
        return (
          <Select
            placeholder={`Select ${title}`}
            value={filterValue}
            onChange={(value) => setFilterValue(value)}
            style={{ width: '100%' }}
            options={[
              { label: 'True', value: 'true' },
              { label: 'False', value: 'false' }
            ]}
          />
        );
      }

      // Default text input
      return (
        <Input
          placeholder={`${title}`}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
      );
    };

    return (
      <div style={{ padding: '12px', width: '320px' }} onKeyDown={(e) => e.stopPropagation()}>
        <Space direction="vertical" style={{ width: '100%' }}>

          {enableFacetFilters && (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Show value counts</span>
              <Switch
                checked={isFacetEnabled}
                onChange={() => toggleFacetedColumn(dataIndex)}
                size="small"
              />
            </Space>
          )}

          {isFacetEnabled && hasFacets && <Divider style={{ margin: '4px 0' }} />}

          {isFacetEnabled && hasFacets && (
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              <Checkbox.Group
                style={{ display: 'flex', flexDirection: 'column' }}
                onChange={(values) => setSelectedFacets(values as string[])}
                value={[ ...appliedInFilterValues, ...selectedFacets ]}
              >
                {Object.entries(columnFacets).map(([ value, count ]) => (
                  <Checkbox key={value} value={value}>
                    {value} ({count})
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </div>
          )}

          {(!isFacetEnabled || !hasFacets) &&
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: "flex" }}>
                {renderFilterInput()}

                {isListFilter && <span style={{ paddingLeft: '8px' }} ><Button onClick={handleAddToList} type="primary" htmlType="button" >
                  <Icon iconName="plus" />
                </Button></span>}
              </div>
              <Alert message={errors.filterValue} type="error" style={{ display: errors.filterValue ? "block" : "none", marginBottom: '8px' }} />
              {isBetweenFilter && <><Input
                placeholder={`${title} End Value`}
                value={filterEndValue}
                onChange={(e) =>
                  setFilterEndValue(e.target.value)
                }
              />
                <Alert message={errors.filterEndValue} type="error" style={{ display: errors.filterEndValue ? "block" : "none" }} />
              </>
              }
              {isListFilter && <div style={{ padding: '4px 0', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{[ ...filterInList ].map((item, index) => {
                return <Tag key={index} color="#108ee9" closable onClose={(e) => {
                  e.preventDefault()
                  handleRemoveFromList(index)
                }}>{item}</Tag>
              })}</div>}

              <a onClick={() => setShowAdvanced(!showAdvanced)} style={{ fontSize: 12, cursor: 'pointer', marginTop: '8px', display: 'inline-block' }}>
                <Icon iconName={showAdvanced ? "up" : "down"} /> {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </a>

              {showAdvanced && <div style={{ paddingTop: '8px' }}>
                <h4>Filter Operators</h4>
                <Alert message={errors.filterOperator} type="error" style={{ display: errors.filterOperator ? "block" : "none" }} />
                <Space size={[ 8, 8 ]} wrap >
                  {availableOperators.map((item, index) => {
                    return (
                      <Button key={index} type={filterOperator === item.value ? "primary" : "default"} size="middle" onClick={() => handleOperatorChange(item.value)}>{item.label}</Button>
                    )
                  })}
                </Space>
              </div>}
            </Space>
          }
          <Divider style={{ margin: '8px 0' }} />
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button onClick={() => resetState()} size="small"> Reset </Button>
              {isFilterActive && <Button danger onClick={() => clearFilter(close)} size="small"> Clear </Button>}
            </Space>
            <Space>
              <Button onClick={() => {
                resetState()
                close();
              }} size="small"
              >
                Close
              </Button>
              <Button type="primary" onClick={() => applyFilter(close)} size="small"  > Apply </Button>
            </Space>
          </Space>
        </Space>
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
