import React, { Fragment } from "react";
import { Tag } from 'antd';
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
      delete appliedFilters[ column ][ filterOperator ];
      if (Object.keys(appliedFilters[ column ]).length === 0) {
        delete appliedFilters[ column ];
      }
      setAppliedFilters({ ...appliedFilters })
    }
  }

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
        {Object.keys(appliedFilters).map((key) => {
          return Object.keys(appliedFilters[ key ]).map((operator) => {
            const handleClose = (e) => {
              e.preventDefault();
              removeFilter(key, operator);
            }

            return (
              <Tag key={key} color="blue" closable onClose={handleClose}>
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
    DisplayAppliedFilters
  }
}