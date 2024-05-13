import React, { Fragment } from "react";
import { Tag } from 'antd';
import { getFilterOperatorByValue } from "../Filters/filterOperators";

export const useAppliedFilters = ({
    appliedFilters,
    setAppliedFilters,
    getColumnNameByKey
}) => {
    //Filter Methods
  const applyFilters = ( column: string, filterOperator: string, value: string | Array<string>) => {
    //append the column value to the appliedFilters object if already exists for another filterOperator
    //if the column value does not exist in appliedFilters object, add it as a new key
    setAppliedFilters({
      ...appliedFilters,
      [column]: {
        ...appliedFilters[column],
        [filterOperator]: value
      }
    })
  }

  const removeFilter = ( column: string, filterOperator: string ) => {
    //remove the filterOperator from the column key
    //if no filterOperator is left, remove the column key from appliedFilters object
    if( appliedFilters[column] && appliedFilters[column][filterOperator] ) {
      delete appliedFilters[column][filterOperator];
      if( Object.keys(appliedFilters[column]).length === 0 ) {
        delete appliedFilters[column];
      }
      setAppliedFilters({...appliedFilters})
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
          return Object.keys(appliedFilters[key]).map((operator) => {
            return (
              <Tag key={key} color="blue" closable onClose={(e)=>{
                e.preventDefault();
                removeFilter(key, operator);
              }}>
                { getColumnNameByKey(key) } : { getFilterOperatorByValue(operator) } : {JSON.stringify(appliedFilters[key][operator])}
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