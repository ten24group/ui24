import React, { Fragment, useEffect, Key } from "react";
import { ITablePropertiesConfig } from "./type";
import { IApiConfig, useApi } from "../core/context";

import { addActionUI } from "./Actions/addActionUI";
import { useAppContext } from "../core/context/AppContext";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useFormat } from "../core/hooks";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
}

const recordPerPage = 10;

const getFilterPayload = (filters: Record<string, any>, apiMethod: string = "GET") => {
  if( apiMethod === "GET" ) {
    //convention for every filter would be column_operator=value
    //example: name.eq=John
    let transformedFilters: Record<string, any> = {};
    for( let key in filters ) {
      for( let operator in filters[key] ) {
        //if value is array, convert it into a list of values separated by comma
        if( Array.isArray(filters[key][operator]) ) {
          transformedFilters[`${key}.${operator}`] = filters[key][operator].join(",");
        } else {
          transformedFilters[`${key}.${operator}`] = filters[key][operator];
        }
      }
    }
    return transformedFilters;

  }

  return {
    filters: filters
  };
}

export const useTable = ({ propertiesConfig, apiConfig }: IuseTable) => {
  
  const recordIdentifierKey = '__recordIdentifierKey__';
  const identifierColumns = propertiesConfig.filter( property => property.isIdentifier );
  const formattingColumns = propertiesConfig.filter( property => 
    ['date', 'datetime', 'time', 'boolean', 'switch', 'toggle']
      .includes(property.fieldType?.toLocaleLowerCase())
  );

  const [listRecords, setListRecords] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [pageCursor, setPageCursor] = React.useState<Record<number, string>>(
    {}
  );
  const [isLastPage, setIsLastPage] = React.useState(false);
  const [ appliedFilters, setAppliedFilters] = React.useState<Record<string, any>>({});
  const { callApiMethod } = useApi();
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();

  //call API get records
  const getRecords = async (
    pageNumber: number = 1,
    currentPageCursor: string = ""
  ) => {
    const payload = {
      cursor: currentPageCursor,
      limit: recordPerPage,
      debug: true,
      ...getFilterPayload({...appliedFilters}, apiConfig.apiMethod),
    };
    setIsLoading(true);
    const response: any = await callApiMethod({
      ...apiConfig,
      payload: payload,
    });

    setIsLoading(false);

    if (response?.status === 200) {

      const records = response.data[apiConfig.responseKey];

      records.forEach((record: any) => {
        formattingColumns.forEach((property) => {
          if([ 'date', 'datetime', 'time' ].includes(property.fieldType?.toLocaleLowerCase())){
            // formate the date value using uiConfig's date-time-formats
            record[property.dataIndex] = formatDate(record[property.dataIndex], property.fieldType?.toLocaleLowerCase() as any);
          } else if (['boolean', 'switch', 'toggle'].includes(property.fieldType?.toLocaleLowerCase())){
            // format the boolean value using uiConfig's boolean-formats
            record[property.dataIndex] = formatBoolean(record[property.dataIndex]);
          }
        })

        // make sure all the identifiers are captured for each records
        const identifiers = identifierColumns.map( column => {
          return { [column.dataIndex] : record[column.dataIndex] };
        });
        record[recordIdentifierKey] = JSON.stringify(identifiers);
      });

      setListRecords(records);

      setCurrentPage(pageNumber === 1 ? 1 : pageNumber);

      setPageCursor({ ...pageCursor, [pageNumber + 1]: response.data?.cursor });

      setIsLastPage(response.data?.cursor === null);

    } else {

      notifyError(response?.error);
    }
  };  

  useEffect(() => {
    getRecords();
  }, [ appliedFilters ]);

  const getColumnNameByKey = ( dataIndex: string ) => {
    return columns.find((column) => column.dataIndex === dataIndex)?.title;
  }

  //Filters
  const { applyFilters, DisplayAppliedFilters } = useAppliedFilters({
    appliedFilters,
    setAppliedFilters,
    getColumnNameByKey
  });

  //Pagination
  const { Pagination } = usePagination({
    pageCursor,
    getRecords,
    currentPage,
    isLastPage
  });

  //add action UI and filter UI
  const columns = addFilterUI( addActionUI(propertiesConfig, getRecords ), applyFilters )
  .map( column => { 

    let renderer = column.render;

    if(column.fieldType === 'color'){
      renderer = (text: string, record: any) => {
        return {
          children: <>
            <svg width="12" height="12">
              <rect width="12" height="12" fill={text} strokeWidth={1} stroke="rgb(0,0,0)" />
            </svg>
            <span> {text}</span>
          </>
        }
      }
    }

    return {  ...column, render: renderer}
    
   });

  return { recordIdentifierKey, columns, listRecords, isLoading, Pagination, DisplayAppliedFilters };
};
