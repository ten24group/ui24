import React from 'react';
import { useApi, IApiConfig } from '../../core/context';
import { useAppContext } from '../../core/context/AppContext';
import { SorterResult } from 'antd/es/table/interface';
import { ITablePropertiesConfig } from '../type';
import { useFormat } from '../../core/hooks';

const recordPerPage = 10;

// Utility to replace URL parameters with values
const replaceUrlParams = (url: string, params: Record<string, string> = {}) => {
  return url.replace(/:(\w+)/g, (_, param) => params[ param ] || `:${param}`);
};

const getFilterPayload = (filters: Record<string, any>, apiMethod: string = "GET") => {
  if (apiMethod === "GET") {
    let transformedFilters: Record<string, any> = {};
    for (let key in filters) {
      for (let operator in filters[ key ]) {
        if (Array.isArray(filters[ key ][ operator ])) {
          transformedFilters[ `${key}.${operator}` ] = filters[ key ][ operator ].join(",");
        } else {
          transformedFilters[ `${key}.${operator}` ] = filters[ key ][ operator ];
        }
      }
    }
    return transformedFilters;
  }
  return { filters };
};

interface IUseTableDataProps {
  apiConfig: IApiConfig;
  routeParams?: Record<string, string>;
  appliedFilters: Record<string, any>;
  searchQuery: string;
  sort: SorterResult<any>[];
  visibleColumns: string[];
  facetedColumns: string[];
  propertiesConfig: ITablePropertiesConfig[];
  recordIdentifierKey: string;
}

export const useTableData = ({
  apiConfig,
  routeParams = {},
  appliedFilters,
  searchQuery,
  sort,
  visibleColumns,
  facetedColumns,
  propertiesConfig,
  recordIdentifierKey,
}: IUseTableDataProps) => {
  const [ listRecords, setListRecords ] = React.useState([]);
  const [ isLoading, setIsLoading ] = React.useState(false);
  const [ currentPage, setCurrentPage ] = React.useState(1);
  const [ pageCursor, setPageCursor ] = React.useState<Record<number, string>>({ 1: "" });
  const [ isLastPage, setIsLastPage ] = React.useState(false);
  const [ totalRecords, setTotalRecords ] = React.useState(0);
  const [ facetResults, setFacetResults ] = React.useState<Record<string, Record<string, number>>>({});

  const { callApiMethod } = useApi();
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();

  const identifierColumns = React.useMemo(() => propertiesConfig.filter(property => property.isIdentifier), [ propertiesConfig ]);
  const formattingColumns = React.useMemo(() => propertiesConfig.filter(property =>
    [ 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle' ]
      .includes(property.fieldType?.toLocaleLowerCase())
  ), [ propertiesConfig ]);

  const getSortString = () => {
    if (!sort.length) return '';
    return sort
      .map(s => s.field && s.order ? `${s.field as string}:${s.order === 'ascend' ? 'asc' : 'desc'}` : null)
      .filter(Boolean)
      .join(',');
  };

  const fetchRecords = React.useCallback(async (pageNumber: number = 1, forceCursor?: string) => {
    const apiUrl = replaceUrlParams(apiConfig.apiUrl, routeParams);
    const isSearchActive = apiConfig.useSearch;
    const sortString = getSortString();
    const currentPageCursor = forceCursor !== undefined ? forceCursor : pageCursor[ pageNumber ] || "";

    const payload: any = {
      ...getFilterPayload(appliedFilters, apiConfig.apiMethod),
    };

    // shared payload for both search and list APIs
    const identifierColumnKeys = identifierColumns.map(c => c.dataIndex);
    const attributes = Array.from(new Set([ ...visibleColumns, ...identifierColumnKeys ]));
    if (attributes.length > 0) {
      payload.attributes = attributes.join(',');
    }

    if (isSearchActive) {
      payload.q = searchQuery;
      payload.page = pageNumber;
      payload.hitsPerPage = recordPerPage;
      if (sortString) {
        payload.sort = sortString;
      }
      if (facetedColumns.length > 0) {
        payload.facets = facetedColumns.join(',');
      }
    } else {
      payload.cursor = currentPageCursor;
      payload.count = recordPerPage;
    }

    setIsLoading(true);

    try {
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl,
        payload,
      });

      if (response?.status === 200) {
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
          if (response.data?.cursor) {
            setPageCursor(prev => ({ ...prev, [ pageNumber + 1 ]: response.data.cursor }));
          }
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
  }, [ apiConfig, routeParams, appliedFilters, searchQuery, sort, visibleColumns, facetedColumns, identifierColumns, formattingColumns, pageCursor, callApiMethod, notifyError, formatDate, formatBoolean, recordIdentifierKey ]);

  return {
    listRecords,
    isLoading,
    currentPage,
    pageCursor,
    isLastPage,
    totalRecords,
    facetResults,
    fetchRecords,
    recordPerPage
  };
}; 