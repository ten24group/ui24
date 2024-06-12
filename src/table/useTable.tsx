import React, { Fragment, useEffect } from "react";
import { ITablePropertiesConfig } from "./type";
import { IApiConfig, useApi } from "../core/context";

import { addActionUI } from "./Actions/addActionUI";
import { useAppContext } from "../core/context/AppContext";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";

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
      setListRecords(response.data[apiConfig.responseKey]);
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
  const columns = addFilterUI( addActionUI(propertiesConfig, getRecords ), applyFilters );

  return { columns, listRecords, isLoading, Pagination, DisplayAppliedFilters };
};
