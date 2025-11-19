import React, { Fragment } from "react";
import { Tag, Button } from 'antd';
import { getFilterOperatorByValue } from "../Filters/filterOperators";

export const useAppliedFilters = ({
  appliedFilters,
  setAppliedFilters,
  getColumnNameByKey
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

  const removeFilter = (column: string, filterOperator: string) => {
    //find the column and remove the filter
    if (appliedFilters[ column ] && appliedFilters[ column ][ filterOperator ]) {
      const newFilters = { ...appliedFilters };
      delete newFilters[ column ][ filterOperator ];
      if (Object.keys(newFilters[ column ]).length === 0) {
        delete newFilters[ column ];
      }
      setAppliedFilters(newFilters)
    }
  }

  const clearAllFilters = () => {
    setAppliedFilters({});
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
              const newFilters = { ...appliedFilters };
              delete newFilters[key];
              setAppliedFilters(newFilters);
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
            const newFilters = { ...appliedFilters };
            delete newFilters[key];
            setAppliedFilters(newFilters);
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
    hasActiveFilters,
    activeFiltersCount: Object.keys(appliedFilters).length
  }
}