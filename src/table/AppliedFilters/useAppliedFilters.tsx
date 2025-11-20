import React, { Fragment } from "react";
import { Tag, Button } from 'antd';
import { getFilterOperatorByValue } from "../Filters/filterOperators";

export const useAppliedFilters = ({
  appliedFilters,
  setAppliedFilters,
  getColumnNameByKey,
  onFilterChange // Callback to trigger refetch after filter changes
}) => {
  //Filter Methods
  const applyFilters = (column: string, filterOperator: string, value: string | Array<string>) => {
    //if the column value does not exist in appliedFilters object, add it as a new key
    setAppliedFilters({
      ...appliedFilters,
      [ column ]: {
        [ filterOperator ]: value
      }
    })
  }

  // Internal removeFilter for building the return API (used by filter UI for nested format)
  const removeFilter = (column: string, filterOperator: string) => {
    //find the column and remove the filter
    if (appliedFilters[ column ] && appliedFilters[ column ][ filterOperator ]) {
      const newFilters = { ...appliedFilters };
      delete newFilters[ column ][ filterOperator ];
      if (Object.keys(newFilters[ column ]).length === 0) {
        delete newFilters[ column ];
      }
      setAppliedFilters(newFilters);
      if (onFilterChange) onFilterChange();
    }
  }

  const clearAllFilters = () => {
    setAppliedFilters({});
    // Note: onFilterChange is called by the wrapper in useTable
  };

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

  /**
   * Applied Filters UI
   * authorName : {"in":["GS"], "eq":"GS"}
   * should be displayed as:
   * Author Name : "in" : ["GS"]
   * Author Name : "eq" : "GS"
   */
  const DisplayAppliedFilters = () => {
    // Helper to remove filter by key (for dot notation and plain value filters)
    const removeFilterByKey = (keyToRemove: string) => {
      const newFilters = { ...appliedFilters };
      delete newFilters[keyToRemove];
      setAppliedFilters(newFilters);
      if (onFilterChange) onFilterChange();
    };
    
    return (
      <Fragment>
        {hasActiveFilters && Object.keys(appliedFilters).flatMap((key) => {
          const filterValue = appliedFilters[key];
          
          // Backend sends filters in dot notation: { 'teamId.eq': 'value' }
          // Parse key to extract field and operator
          const OPERATORS = ['eq', 'ne', 'neq', 'in', 'nin', 'gte', 'gt', 'lte', 'lt', 'contains', 'notContains', 'beginsWith'];
          const parts = key.split('.');
          const hasDotOperator = parts.length === 2 && OPERATORS.includes(parts[1]);
          
          if (hasDotOperator) {
            // Format: 'teamId.eq' with primitive value
            const [field, operator] = parts;
            const handleClose = (e) => {
              e.preventDefault();
              removeFilterByKey(key);
            };
            
            return [(
              <Tag key={key} color="blue" closable onClose={handleClose}>
                {getColumnNameByKey(field)} : {getFilterOperatorByValue(operator)} : {JSON.stringify(filterValue)}
              </Tag>
            )];
          }
          
          // Handle nested format: { teamId: { eq: 'value' } }
          if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue)) {
            return Object.keys(filterValue).map((operator) => {
              const handleClose = (e) => {
                e.preventDefault();
                removeFilter(key, operator);
              };

              return (
                <Tag key={`${key}-${operator}`} color="blue" closable onClose={handleClose}>
                  {getColumnNameByKey(key)} : {getFilterOperatorByValue(operator)} : {JSON.stringify(filterValue[operator])}
                </Tag>
              );
            });
          }
          
          // Handle plain value format (fallback): { teamId: 'value' }
          const handleClose = (e) => {
            e.preventDefault();
            removeFilterByKey(key);
          };
          
          return [(
            <Tag key={`${key}-eq`} color="blue" closable onClose={handleClose}>
              {getColumnNameByKey(key)} : eq : {JSON.stringify(filterValue)}
            </Tag>
          )];
        })}
      </Fragment>
    );
  }

  return {
    applyFilters,
    DisplayAppliedFilters,
    clearAllFilters,
    removeFilter,
    hasActiveFilters,
    activeFiltersCount: Object.keys(appliedFilters).length
  }
}