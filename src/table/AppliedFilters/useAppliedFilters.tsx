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
        {hasActiveFilters && Object.keys(appliedFilters).map((key) => {
          return Object.keys(appliedFilters[ key ]).map((operator) => {
            const handleClose = (e) => {
              e.preventDefault();
              removeFilter(key, operator);
            }

            return (
              <Tag key={`${key}-${operator}`} color="blue" closable onClose={handleClose}>
                {getColumnNameByKey(key)} : {getFilterOperatorByValue(operator)} : {JSON.stringify(appliedFilters[ key ][ operator ])}
              </Tag>
            );
          });
        })}
      </Fragment>
    );
  }

  return {
    applyFilters,
    DisplayAppliedFilters,
    clearAllFilters,
    hasActiveFilters
  }
}