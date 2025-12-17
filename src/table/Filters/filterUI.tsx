import { FilterFilled } from '@ant-design/icons';
import { Input, Button, Space, Tag, Alert, Checkbox, Switch, Divider, Select, DatePicker } from 'antd';
import { Icon } from '../../core/common';
import React from 'react';
import { filterOperators } from './filterOperators';
import { FieldType } from '../../core/types/field-types';
import { OptionSelector, type IFieldOptionsAPIConfig } from '../../core/forms/FormField/OptionSelector';
import dayjs from 'dayjs';

interface IColumnFilterProps {
  dataIndex: string
  title: string
  fieldType: FieldType
  filterConfig?: {
    filterType?: 'text' | 'select' | 'datetime' | 'number' | 'boolean' | 'relation';
    defaultOperator?: string;
    availableOperators?: string[];
    predefinedOptions?: IFieldOptionsAPIConfig | Array<{ label: string; value: string }>;
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
  // Ensure title is a string (could be React node from column config)
  const safeTitle = typeof title === 'string' ? title : (dataIndex || 'Filter');

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

    // Store the initial/applied filter state for Cancel button
    const [ initialFilterState, setInitialFilterState ] = React.useState<{
      operator: string;
      value: string;
      endValue: string;
      inList: string[];
      facets: string[];
      isActive: boolean;
    }>({
      operator: defaultOperator,
      value: "",
      endValue: "",
      inList: [],
      facets: [],
      isActive: false
    });
    const isListFilter = filterOperator === "in" || filterOperator === "nin"
    const isBetweenFilter = filterOperator === "bt"
    // Operators that don't require a value input (existence checks)
    const noValueOperators = [ "exists", "notExists", "isEmpty", "isNull", "notEmpty", "notNull" ];
    const isFilterValueRequired = !noValueOperators.includes(filterOperator) && filterOperator !== "in" && filterOperator !== "nin"
    const hideFilterValue = noValueOperators.includes(filterOperator)
    const [ showAdvanced, setShowAdvanced ] = React.useState<boolean>(false);
    const [ isFilterActive, setIsFilterActive ] = React.useState<boolean>(false);
    const columnFacets = facetResults?.[ dataIndex ] ?? {};
    const hasFacets = Object.keys(columnFacets).length > 0;
    const isFacetEnabled = facetedColumns.includes(dataIndex);
    const appliedFilterForColumn = getAppliedFilterForColumn(dataIndex);
    const appliedInFilterValues = (appliedFilterForColumn.in || []) as string[];

    // Check if predefinedOptions is API config or inline array
    const predefinedOptions = filterConfig?.predefinedOptions;
    const isApiConfig = predefinedOptions && typeof predefinedOptions === 'object' && !Array.isArray(predefinedOptions) && 'apiMethod' in predefinedOptions;
    const hasInlineOptions = predefinedOptions && Array.isArray(predefinedOptions) && predefinedOptions.length > 0;
    const hasPredefinedOptions = isApiConfig || hasInlineOptions;
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

        let valueStr = '';
        let endValueStr = '';
        let inListArr: string[] = [];

        if (Array.isArray(value)) {
          // Use operator directly, not the state variable 'isBetweenFilter' which might be stale
          if (operator === 'bt') {
            valueStr = value[ 0 ];
            endValueStr = value[ 1 ];
            setFilterValue(value[ 0 ]);
            setFilterEndValue(value[ 1 ]);
          } else {
            inListArr = value;
            setFilterInList(value);
          }
        } else if (typeof value === 'boolean' || typeof value === 'object') {
          // Boolean/object value (e.g., exists: true) - don't show in input
          setFilterValue('');
        } else {
          valueStr = String(value ?? '');
          setFilterValue(String(value ?? ''));
        }

        // Store the applied state for Cancel button
        setInitialFilterState({
          operator,
          value: valueStr,
          endValue: endValueStr,
          inList: inListArr,
          facets: [],
          isActive: true
        });
      }
      // Note: Removed auto-prefill for datetime fields - users should start with empty state
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

    const restoreInitialState = () => {
      // Restore to the last applied filter state
      setFilterOperator(initialFilterState.operator);
      setFilterValue(initialFilterState.value);
      setFilterEndValue(initialFilterState.endValue);
      setFilterInList(initialFilterState.inList);
      setSelectedFacets(initialFilterState.facets);
      setIsFilterActive(initialFilterState.isActive);
      setErrors({});
    }

    const applyFilter = (closeFn: Function) => {
      //run validations
      if (filterOperator === "") {
        setErrors({ filterOperator: "Please select filter operator" })
      } else if ((selectedFacets.length === 0 && isBetweenFilter && (filterValue === "" || filterEndValue === "")) || (selectedFacets.length === 0 && isListFilter && filterInList.length === 0) || (selectedFacets.length === 0 && isFilterValueRequired && filterValue === "")) {
        setErrors({ filterValue: "Please enter value", filterEndValue: "Please enter value" })
      } else {
        //apply filter
        // NOTE: Placeholder resolution (e.g., :startOfMonth → actual date) happens in useTableData
        // before sending to API. This allows filters to work with all placeholder types (dates, actor, etc.)
        const isExistenceOperator = noValueOperators.includes(filterOperator);
        const filterToApply = selectedFacets.length > 0 ? selectedFacets : isListFilter ? filterInList : isExistenceOperator ? true : filterValue;
        const operatorToApply = selectedFacets.length > 0 ? 'in' : filterOperator;
        applyFilters(dataIndex, operatorToApply, isBetweenFilter ? [ filterValue, filterEndValue ] : filterToApply)

        // Save the current state as the new initial state for Cancel button
        setInitialFilterState({
          operator: filterOperator,
          value: filterValue,
          endValue: filterEndValue,
          inList: [ ...filterInList ],
          facets: [ ...selectedFacets ],
          isActive: true
        });

        setIsFilterActive(true);
        closeFn()
      }
    }

    const clearFilter = (closeFn: Function) => {
      removeFilter(dataIndex);
      resetState();
      // Reset the initial state to defaults when clearing
      setInitialFilterState({
        operator: defaultOperator,
        value: "",
        endValue: "",
        inList: [],
        facets: [],
        isActive: false
      });
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

      // Use OptionSelector for select/relation fields with API config or inline options
      if ((filterType === 'select' || filterType === 'relation') && (isApiConfig || hasInlineOptions)) {
        return (
          <OptionSelector
            fieldType="select"
            options={isApiConfig ? (predefinedOptions as IFieldOptionsAPIConfig) : (predefinedOptions as Array<{ label: string; value: string }>)}
            value={filterValue}
            onOptionChange={(value: string) => setFilterValue(value)}
          />
        );
      }

      if (filterType === 'datetime') {
        // If inline quick date options exist, show select
        if (hasInlineOptions) {
          // If value starts with ':', it's a predefined option, otherwise it's custom
          const isPredefined = filterValue && filterValue.startsWith(':');
          const showCustomPicker = filterValue === 'custom' || (filterValue && !isPredefined);

          return (
            <>
              <Select
                size="small"
                placeholder={`Select ${safeTitle}`}
                value={isPredefined ? filterValue : (showCustomPicker ? 'custom' : undefined)}
                onChange={(value) => {
                  if (value === 'custom') {
                    setFilterValue('custom');
                  } else {
                    setFilterValue(value);
                  }
                }}
                style={{ width: '100%' }}
                dropdownStyle={{ minWidth: '200px' }}
                options={(predefinedOptions as Array<{ label: string; value: string }>).map(option => ({
                  label: option.label,
                  value: option.value === null ? 'custom' : String(option.value)
                }))}
              />

              {/* Show DatePicker when custom is selected */}
              {(filterValue === 'custom' || (filterValue && !filterValue.startsWith(':'))) && (
                <DatePicker
                  size="small"
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="Pick date and time"
                  value={filterValue && filterValue !== 'custom' ? dayjs(filterValue) : null}
                  onChange={(date) => {
                    if (date) {
                      // Store as ISO string for DynamoDB string comparison
                      setFilterValue(date.toISOString());
                    } else {
                      // Clear to empty string, not 'custom'
                      setFilterValue('');
                    }
                  }}
                  style={{ width: '100%', marginTop: '4px' }}
                  needConfirm={true}
                  showNow={false}
                  getPopupContainer={(trigger) => trigger.parentElement || document.body}
                />
              )}
            </>
          );
        }

        // Default DatePicker with time selection (no presets)
        return (
          <DatePicker
            size="small"
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={`${safeTitle}`}
            value={filterValue ? dayjs(filterValue) : null}
            onChange={(date) => {
              if (date) {
                // Store as ISO string for DynamoDB string comparison
                setFilterValue(date.toISOString());
              } else {
                setFilterValue('');
              }
            }}
            style={{ width: '100%' }}
            needConfirm={true}
            showNow={false}
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
          />
        );
      }

      if (filterType === 'number') {
        return (
          <Input
            size="small"
            type="number"
            placeholder={`${safeTitle}`}
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        );
      }

      if (filterType === 'boolean') {
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Checkbox
              checked={filterValue === 'true' || filterValue === 'True'}
              onChange={(e) => setFilterValue(e.target.checked ? 'true' : 'false')}
            >
              {safeTitle}
            </Checkbox>
          </div>
        );
      }

      // Default text input
      return (
        <Input
          size="small"
          placeholder={`${safeTitle}`}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
      );
    };

    return (
      <div
        style={{ padding: '8px', minWidth: '300px' }}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>

          {/* Facet Filters (if enabled) */}
          {enableFacetFilters && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)' }}>Show value counts</span>
                <Switch
                  checked={isFacetEnabled}
                  onChange={() => toggleFacetedColumn(dataIndex)}
                  size="small"
                />
              </div>

              {isFacetEnabled && hasFacets && (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <Checkbox.Group
                      style={{ display: 'flex', flexDirection: 'column' }}
                      onChange={(values) => setSelectedFacets(values as string[])}
                      value={[ ...appliedInFilterValues, ...selectedFacets ]}
                    >
                      {Object.entries(columnFacets).map(([ value, count ]) => (
                        <Checkbox key={value} value={value}>
                          {value} <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>({count})</span>
                        </Checkbox>
                      ))}
                    </Checkbox.Group>
                  </div>
                </>
              )}
            </>
          )}

          {/* Filter Input Section */}
          {(!isFacetEnabled || !hasFacets) && (
            <>
              {(enableFacetFilters && isFacetEnabled && hasFacets) && <Divider style={{ margin: '4px 0' }} />}

              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                {/* Main filter input with operator inline for compact view */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                  {/* Operator dropdown */}
                  <Select
                    value={filterOperator}
                    onChange={handleOperatorChange}
                    size="small"
                    style={{ minWidth: '140px', flex: '0 0 auto' }}
                    options={availableOperators.map(op => ({
                      label: op.label,
                      value: op.value
                    }))}
                  />

                  {/* Filter input - only show if operator needs a value */}
                  {!hideFilterValue && (
                    <>
                      <div style={{ flex: 1 }}>
                        {renderFilterInput()}
                      </div>

                      {/* Add button for list filters */}
                      {isListFilter && (
                        <Button
                          onClick={handleAddToList}
                          type="primary"
                          size="small"
                          icon={<Icon iconName="plus" />}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Errors */}
                {errors.filterOperator && (
                  <Alert message={errors.filterOperator} type="error" showIcon banner />
                )}
                {errors.filterValue && (
                  <Alert message={errors.filterValue} type="error" showIcon banner />
                )}

                {/* Between Filter - End Value */}
                {isBetweenFilter && !hideFilterValue && (
                  <>
                    <Input
                      size="small"
                      placeholder={`${safeTitle} (end)`}
                      value={filterEndValue}
                      onChange={(e) => setFilterEndValue(e.target.value)}
                    />
                    {errors.filterEndValue && (
                      <Alert message={errors.filterEndValue} type="error" showIcon banner />
                    )}
                  </>
                )}

                {/* List Filter - Selected Items */}
                {isListFilter && filterInList.length > 0 && !hideFilterValue && (
                  <div style={{ paddingTop: '4px' }}>
                    {filterInList.map((item, index) => (
                      <Tag
                        key={index}
                        closable
                        onClose={(e) => {
                          e.preventDefault();
                          handleRemoveFromList(index);
                        }}
                        style={{ marginBottom: '4px' }}
                      >
                        {item}
                      </Tag>
                    ))}
                  </div>
                )}
              </Space>
            </>
          )}

          {/* Action Buttons */}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space size={4}>
              <Button onClick={() => resetState()} size="small">
                Reset
              </Button>
              {isFilterActive && (
                <Button danger onClick={() => clearFilter(close)} size="small">
                  Clear
                </Button>
              )}
            </Space>
            <Space size={4}>
              <Button
                onClick={() => {
                  restoreInitialState();
                  close();
                }}
                size="small"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => applyFilter(close)}
                size="small"
              >
                OK
              </Button>
            </Space>
          </div>
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
