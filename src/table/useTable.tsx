import React, { Fragment, useEffect, Key } from "react";
import { ITablePropertiesConfig } from "./type";
import { IApiConfig, useApi } from "../core/context";
import { Pagination as AntPagination } from "antd";
import type { SorterResult } from 'antd/es/table/interface';

import { addActionUI } from "./Actions/addActionUI";
import { useAppContext } from "../core/context/AppContext";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useFormat } from "../core/hooks";
import { FilterFilled } from "@ant-design/icons";
import { useAppliedSorts } from "./AppliedFilters/useAppliedSorts";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
  routeParams?: Record<string, string>;
}

const recordPerPage = 10;

// Utility to replace URL parameters with values
const replaceUrlParams = (url: string, params: Record<string, string> = {}) => {
  const result = url.replace(/:(\w+)/g, (_, param) => params[ param ] || `:${param}`);
  return result;
};

const getFilterPayload = (filters: Record<string, any>, apiMethod: string = "GET") => {
  if (apiMethod === "GET") {
    //convention for every filter would be column_operator=value
    //example: name.eq=John
    let transformedFilters: Record<string, any> = {};
    for (let key in filters) {
      for (let operator in filters[ key ]) {
        //if value is array, convert it into a list of values separated by comma
        if (Array.isArray(filters[ key ][ operator ])) {
          transformedFilters[ `${key}.${operator}` ] = filters[ key ][ operator ].join(",");
        } else {
          transformedFilters[ `${key}.${operator}` ] = filters[ key ][ operator ];
        }
      }
    }
    return transformedFilters;
  }

  return {
    filters: filters
  };
}

export const useTable = ({ propertiesConfig, apiConfig, routeParams = {} }: IuseTable) => {
  const recordIdentifierKey = '__recordIdentifierKey__';
  const identifierColumns = React.useMemo(() => propertiesConfig.filter(property => property.isIdentifier), [ propertiesConfig ]);
  const formattingColumns = React.useMemo(() => propertiesConfig.filter(property =>
    [ 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle' ]
      .includes(property.fieldType?.toLocaleLowerCase())
  ), [ propertiesConfig ]);

  const [ listRecords, setListRecords ] = React.useState([]);
  const [ isLoading, setIsLoading ] = React.useState(false);
  const [ currentPage, setCurrentPage ] = React.useState(0);
  const [ pageCursor, setPageCursor ] = React.useState<Record<number, string>>({});
  const [ isLastPage, setIsLastPage ] = React.useState(false);
  const [ appliedFilters, setAppliedFilters ] = React.useState<Record<string, any>>({});
  const [ searchQuery, setSearchQuery ] = React.useState<string>('');
  const [ totalRecords, setTotalRecords ] = React.useState(0);
  const [ sort, setSort ] = React.useState<SorterResult<any>[]>([]);
  const [ visibleColumns, setVisibleColumns ] = React.useState<string[]>(propertiesConfig.map(p => p.dataIndex));
  const [ columnSettings, setColumnSettings ] = React.useState(
    propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    }))
  );
  const [ facetResults, setFacetResults ] = React.useState<Record<string, Record<string, number>>>({});
  const [ facetedColumns, setFacetedColumns ] = React.useState<string[]>([]);
  const { callApiMethod } = useApi();
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();

  // Track if we've made the initial API call
  const hasInitialLoad = React.useRef(false);
  // Track the last API call parameters to prevent duplicate calls
  const lastCallParams = React.useRef({
    url: '',
    filters: {},
    page: 0,
    cursor: '',
    q: '',
    sort: '',
    attributes: '',
    facetedColumns: '',
  });

  const onSearch = (value: string) => {
    setSearchQuery(value);
  }

  const handleTableChange = (pagination: any, filters: any, sorter: SorterResult<any> | SorterResult<any>[]) => {
    const newSorters = Array.isArray(sorter) ? sorter : [ sorter ];
    setSort(newSorters.filter(s => s.order)); // Only keep sorts with an active order
  };

  const getSortString = () => {
    if (!sort.length) return '';
    return sort
      .map(s => s.field && s.order ? `${s.field}:${s.order === 'ascend' ? 'asc' : 'desc'}` : null)
      .filter(Boolean)
      .join(',');
  }

  //call API get records
  const getRecords = React.useCallback(async (
    pageNumber: number = 1,
    currentPageCursor: string = ""
  ) => {
    const apiUrl = replaceUrlParams(apiConfig.apiUrl, routeParams);
    const currentFilters = { ...appliedFilters };
    const isSearchActive = apiConfig.useSearch;
    const sortString = getSortString();

    // Check if this is a duplicate call
    const callSignature = JSON.stringify({
      url: apiUrl,
      filters: currentFilters,
      page: pageNumber,
      cursor: currentPageCursor,
      q: searchQuery,
      sort: sortString,
      attributes: visibleColumns.join(','),
      facetedColumns: facetedColumns.join(','),
    });
    const lastCallSignature = JSON.stringify(lastCallParams.current);
    if (callSignature === lastCallSignature) {
      return;
    }

    // Update last call parameters
    lastCallParams.current = {
      url: apiUrl,
      filters: currentFilters,
      page: pageNumber,
      cursor: currentPageCursor,
      q: searchQuery,
      sort: sortString,
      attributes: visibleColumns.join(','),
      facetedColumns: facetedColumns.join(','),
    };

    const payload: any = {
      ...getFilterPayload(currentFilters, apiConfig.apiMethod),
    };

    if (isSearchActive) {
      payload.q = searchQuery;
      payload.page = pageNumber;
      payload.hitsPerPage = recordPerPage;
      if (sortString) {
        payload.sort = sortString;
      }
      //Always fetch identifier columns
      const identifierColumnKeys = identifierColumns.map(c => c.dataIndex);
      const attributes = Array.from(new Set([ ...visibleColumns, ...identifierColumnKeys ]));
      if (attributes.length > 0) {
        payload.attributes = attributes.join(',');
      }

      if (facetedColumns.length > 0) {
        payload.facets = facetedColumns.join(',');
      }

      delete payload.cursor;
      delete payload.limit;
    } else {
      payload.cursor = currentPageCursor;
      payload.limit = recordPerPage;
    }

    setIsLoading(true);

    try {
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl,
        payload: payload,
      });

      if (response?.status === 200) {
        const isSearchActive = apiConfig.useSearch;
        const records = isSearchActive ? response.data.items : response.data[ apiConfig.responseKey ];

        if (isSearchActive && response.data.facets) {
          setFacetResults(response.data.facets);
        }

        records.forEach((record: any) => {
          formattingColumns.forEach((property) => {
            if (record[ property.dataIndex ] === null || record[ property.dataIndex ] === undefined || record[ property.dataIndex ] === '') {
              record[ property.dataIndex ] = '';
              return;
            }
            if ([ 'date', 'datetime', 'time' ].includes(property.fieldType?.toLocaleLowerCase())) {
              const itemValue = record[ property.dataIndex ].toString().startsWith('0') ?
                new Date(parseInt(record[ property.dataIndex ])).toISOString() :
                record[ property.dataIndex ];
              record[ property.dataIndex ] = formatDate(itemValue, property.fieldType?.toLocaleLowerCase() as any);
            } else if ([ 'boolean', 'switch', 'toggle' ].includes(property.fieldType?.toLocaleLowerCase())) {
              record[ property.dataIndex ] = formatBoolean(record[ property.dataIndex ]);
            }
          });

          const identifiers = identifierColumns.map(column => ({
            [ column.dataIndex ]: record[ column.dataIndex ]
          }));
          record[ recordIdentifierKey ] = JSON.stringify(identifiers);
        });

        setListRecords(records);
        setCurrentPage(pageNumber);
        if (isSearchActive) {
          setTotalRecords(response.data.total);
        } else {
          setPageCursor(prev => ({ ...prev, [ pageNumber + 1 ]: response.data?.cursor }));
          setIsLastPage(response.data?.cursor === null);
        }
      } else {
        notifyError(response?.error);
      }
    } catch (error) {
      notifyError('Failed to fetch records');
      console.error('Error fetching records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ apiConfig, routeParams, appliedFilters, formattingColumns, identifierColumns, searchQuery, sort, callApiMethod, notifyError, formatDate, formatBoolean, visibleColumns, facetedColumns ]);

  const handleRefresh = React.useCallback(() => {
    // Resets everything and re-fetches
    setAppliedFilters({});
    setSort([]);
    setSearchQuery('');
    setCurrentPage(1);
    setPageCursor({});
    lastCallParams.current = { url: '', filters: {}, page: 0, cursor: '', q: '', sort: '', attributes: '', facetedColumns: '' };
    getRecords(1, "");
  }, [ getRecords ]);

  const handleReload = React.useCallback(() => {
    // Fetches the current view again
    lastCallParams.current = { url: '', filters: {}, page: 0, cursor: '', q: '', sort: '', attributes: '', facetedColumns: '' };
    getRecords(currentPage, pageCursor[ currentPage ] || "");
  }, [ getRecords, currentPage, pageCursor ]);

  React.useEffect(() => {
    getRecords(1, "");
  }, [ appliedFilters, searchQuery, sort, facetedColumns, apiConfig.apiUrl ]);

  const getColumnNameByKey = (dataIndex: string) => {
    return propertiesConfig.find((column) => column.dataIndex === dataIndex)?.name;
  }

  const removeFilter = (column: string) => {
    if (appliedFilters[ column ]) {
      const newFilters = { ...appliedFilters };
      delete newFilters[ column ];
      setAppliedFilters(newFilters);
    }
  }

  const getAppliedFilterForColumn = (column: string) => {
    return appliedFilters[ column ] || {};
  }

  //Filters
  const { applyFilters, DisplayAppliedFilters, clearAllFilters, hasActiveFilters, activeFiltersCount } = useAppliedFilters({
    appliedFilters,
    setAppliedFilters,
    getColumnNameByKey
  });

  const toggleFacetedColumn = (dataIndex: string) => {
    setFacetedColumns(prev =>
      prev.includes(dataIndex)
        ? prev.filter(d => d !== dataIndex)
        : [ ...prev, dataIndex ]
    );
  };

  //Sorts
  const { DisplayAppliedSorts, clearAllSorts, hasActiveSorts, activeSortsCount } = useAppliedSorts({
    sort,
    setSort,
    getColumnNameByKey
  });

  const isSearchActive = apiConfig.useSearch;

  //Pagination
  const { Pagination: CursorPagination } = usePagination({
    pageCursor,
    getRecords,
    currentPage,
    isLastPage
  });

  const NumericalPagination = () => (
    <AntPagination
      current={currentPage}
      total={totalRecords}
      pageSize={recordPerPage}
      onChange={(page) => getRecords(page)}
      showSizeChanger={false}
    />
  );

  const selectableColumns = React.useMemo(() => propertiesConfig.filter(p => !p.isIdentifier), [ propertiesConfig ]);

  const handleColumnSettingsChange = (newSettings) => {
    setColumnSettings(newSettings);
    setVisibleColumns(newSettings.filter(c => c.visible).map(c => c.key));
  };

  const resetColumnSettings = () => {
    const defaultSettings = propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    }));
    handleColumnSettingsChange(defaultSettings);
  };

  //add action UI and filter UI
  const columns = addFilterUI(addActionUI(propertiesConfig, getRecords), applyFilters, removeFilter, getAppliedFilterForColumn, facetResults, facetedColumns, toggleFacetedColumn)
    .map((column, index) => {

      let renderer = column.render;

      if (column.key === 'action') {
        // ignore sorter, filters and rest of stuff for action column
        return {
          ...column,
        }
      }

      if (column.fieldType === 'color') {
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

      const hasActiveFilter = !!appliedFilters[ column.dataIndex ];
      const columnTitle = propertiesConfig.find(p => p.dataIndex === column.dataIndex)?.name || column.dataIndex;
      const sortOrder = sort.find(s => s.field === column.dataIndex)?.order;
      const columnSetting = columnSettings.find(s => s.key === column.dataIndex);

      return {
        ...column,
        title: columnTitle,
        render: renderer,
        fixed: columnSetting?.fixed,
        // Assign a priority to each column for multi-sort
        sorter: apiConfig.useSearch ? { multiple: index + 1 } : undefined,
        sortOrder: sortOrder,
        filterIcon: (filtered: boolean) => (
          <FilterFilled style={{ color: hasActiveFilter ? "#1677ff" : undefined }} />
        ),
      }

    }).filter(c => c.key === 'action' || columnSettings.find(s => s.key === c.dataIndex)?.visible)
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      if (a.key === 'action') return 1; // action column always last
      if (b.key === 'action') return -1;
      return aIndex - bIndex;
    });

  const pinnedLeftColumns = columns
    .filter(c => columnSettings.find(s => s.key === c.dataIndex)?.fixed === 'left')
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      return aIndex - bIndex;
    });

  const pinnedRightColumns = columns
    .filter(c => c.key === 'action' || columnSettings.find(s => s.key === c.dataIndex)?.fixed === 'right')
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      if (a.key === 'action') return 1;
      if (b.key === 'action') return -1;
      return aIndex - bIndex;
    });

  const normalColumns = columns
    .filter(c => !columnSettings.find(s => s.key === c.dataIndex)?.fixed)
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      return aIndex - bIndex;
    })
    .filter(c => c.key !== 'action' && columnSettings.find(s => s.key === c.dataIndex)?.visible);

  const finalColumns = [ ...pinnedLeftColumns, ...normalColumns, ...pinnedRightColumns ];

  return {
    recordIdentifierKey,
    columns: finalColumns,
    listRecords,
    isLoading,
    Pagination: isSearchActive ? <NumericalPagination /> : CursorPagination,
    DisplayAppliedFilters,
    onSearch,
    handleTableChange,
    hasActiveFilters,
    activeFiltersCount,
    clearAllFilters,
    DisplayAppliedSorts,
    clearAllSorts,
    hasActiveSorts,
    activeSortsCount,
    visibleColumns,
    setVisibleColumns,
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    handleRefresh,
    handleReload,
    selectableColumns,
    facetedColumns,
    toggleFacetedColumn,
    searchQuery
  };
};
