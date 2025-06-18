import { ITablePropertiesConfig } from "../type";
import { filterUI } from "./filterUI";

export const addFilterUI = (propertiesConfig: Array<any>, applyFilters: Function, removeFilter: Function, getAppliedFilterForColumn: Function) => {
  return propertiesConfig.map((column: any) => {
    //add filters on column
    if ((column?.isFilterable === true || column?.isFilterable === undefined) && column.key !== "action") {
      return {
        ...column,
        ...filterUI({ ...column }, applyFilters, removeFilter, getAppliedFilterForColumn)
      }
    }
    return column
  })
}