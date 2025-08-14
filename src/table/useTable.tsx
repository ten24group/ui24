import React, { useEffect } from "react";
import { ITablePropertiesConfig } from "./type";
import { IApiConfig, IDualApiConfig } from "../core/context";
import { Pagination as AntPagination } from "antd";
import type { SorterResult } from 'antd/es/table/interface';

import { addActionUI } from "./Actions/addActionUI";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useAppliedSorts } from "./AppliedFilters/useAppliedSorts";
import { FilterFilled } from "@ant-design/icons";
import { useTableData } from "./hooks/useTableData";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig | IDualApiConfig;
  routeParams?: Record<string, string>;
}

// Utility functions to handle both single and dual API configurations
const isDualApiConfig = (config: IApiConfig | IDualApiConfig): config is IDualApiConfig => {
  return 'search' in config && 'database' in config;
};

const getCurrentApiConfig = (apiConfig: IApiConfig | IDualApiConfig, isSearchMode: boolean): IApiConfig => {
  if (isDualApiConfig(apiConfig)) {
    return isSearchMode ? apiConfig.search : apiConfig.database;
  }
  return apiConfig;
};

const canToggleSearchMode = (apiConfig: IApiConfig | IDualApiConfig): boolean => {
  return isDualApiConfig(apiConfig);
};

export const useTable = ({ propertiesConfig, apiConfig, routeParams = {} }: IuseTable) => {
  const recordIdentifierKey = '__recordIdentifierKey__';

  const [ appliedFilters, setAppliedFilters ] = React.useState<Record<string, any>>({});
  const [ searchQuery, setSearchQuery ] = React.useState<string>('');
  const [ sort, setSort ] = React.useState<SorterResult<any>[]>([]);
  const [ isSearchMode, setIsSearchMode ] = React.useState<boolean>(() => {
    if (isDualApiConfig(apiConfig)) {
      return true; // Default to search mode for dual config
    }
    return apiConfig.useSearch || false;
  });
  const [ visibleColumns, setVisibleColumns ] = React.useState<string[]>(
    propertiesConfig.filter(p => !p.hidden).map(p => p.dataIndex)
  );
  const [ columnSettings, setColumnSettings ] = React.useState(
    propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    }))
  );
  const [ facetedColumns, setFacetedColumns ] = React.useState<string[]>([]);

  const {
    listRecords,
    isLoading,
    currentPage,
    pageCursor,
    isLastPage,
    totalRecords,
    facetResults,
    fetchRecords,
    recordPerPage
  } = useTableData({
    apiConfig: getCurrentApiConfig(apiConfig, isSearchMode),
    routeParams,
    appliedFilters,
    searchQuery,
    sort,
    visibleColumns,
    facetedColumns,
    propertiesConfig,
    recordIdentifierKey,
    isSearchMode,
  });

  const onSearch = (value: string) => {
    setSearchQuery(value);
  }

  const toggleSearchMode = React.useCallback(() => {
    if (canToggleSearchMode(apiConfig)) {
      setIsSearchMode(prev => !prev);
      setSearchQuery('');
      setAppliedFilters({});
      setSort([]);
    }
  }, [apiConfig]);

  const handleTableChange = (_: any, __: any, sorter: SorterResult<any> | SorterResult<any>[]) => {
    const newSorters = Array.isArray(sorter) ? sorter : [ sorter ];
    setSort(newSorters.filter(s => s.order)); // Only keep sorts with an active order
  };

  useEffect(() => {
    fetchRecords(1);
  }, [ appliedFilters, searchQuery, sort, facetedColumns, isSearchMode ]);

  const handleRefresh = React.useCallback(() => {
    setAppliedFilters({});
    setSort([]);
    setSearchQuery('');
    if (isDualApiConfig(apiConfig)) {
      setIsSearchMode(true); // Reset to search mode for dual config
    } else {
      setIsSearchMode(apiConfig.useSearch || false);
    }
    fetchRecords(1, "");
  }, [ fetchRecords, apiConfig ]);

  const handleReload = React.useCallback(() => {
    fetchRecords(currentPage, pageCursor[ currentPage ]);
  }, [ fetchRecords, currentPage, pageCursor ]);

  const getColumnNameByKey = (dataIndex: string) => {
    return propertiesConfig.find((column) => column.dataIndex === dataIndex)?.name;
  }

  //Filters
  const { applyFilters, DisplayAppliedFilters, clearAllFilters, hasActiveFilters, activeFiltersCount } = useAppliedFilters({
    appliedFilters,
    setAppliedFilters,
    getColumnNameByKey
  });

  const getAppliedFilterForColumn = (column: string) => {
    return appliedFilters[ column ] || {};
  }

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

  //Pagination
  const { Pagination: CursorPagination } = usePagination({
    pageCursor,
    getRecords: fetchRecords,
    currentPage,
    isLastPage
  });

  const NumericalPagination = () => (
    <AntPagination
      current={currentPage}
      total={totalRecords}
      pageSize={recordPerPage}
      onChange={(page) => fetchRecords(page)}
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

  const columns = addFilterUI(
    addActionUI(propertiesConfig, handleReload, routeParams),
    applyFilters,
    (col) => setAppliedFilters(f => {
      const newF = { ...f };
      delete newF[ col ]; return newF;
    }),
    getAppliedFilterForColumn,
    facetResults,
    facetedColumns,
    toggleFacetedColumn,
    !!isSearchMode
  )
    .map((column, index) => {
      if (column.key === 'action') return column;

      let renderer = column.render;
      if (column.fieldType === 'color') {
        renderer = (text: string) => (
          <>
            <svg width="12" height="12" style={{ verticalAlign: 'middle' }}>
              <rect width="12" height="12" fill={text} strokeWidth={1} stroke="rgb(0,0,0)" />
            </svg>
            <span style={{ marginLeft: 8 }}> {text}</span>
          </>
        );
      }

      const columnSetting = columnSettings.find(s => s.key === column.dataIndex);
      return {
        ...column,
        title: columnSetting?.title || column.dataIndex,
        render: renderer,
        fixed: columnSetting?.fixed,
        sorter: (isSearchMode && (column.isSortable === true || column.isSortable === undefined)) ? { multiple: index + 1 } : undefined,
        sortOrder: sort.find(s => s.field === column.dataIndex)?.order,
        filterIcon: <FilterFilled style={{ color: !!appliedFilters[ column.dataIndex ] ? "#1677ff" : undefined }} />,
      }
    })
    .filter(c => c.key === 'action' || columnSettings.find(s => s.key === c.dataIndex)?.visible)
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      if (a.fixed === 'right' || a.key === 'action') return 1;
      if (b.fixed === 'right' || b.key === 'action') return -1;
      if (a.fixed === 'left') return -1;
      if (b.fixed === 'left') return 1;
      return aIndex - bIndex;
    });

  return {
    recordIdentifierKey,
    columns,
    listRecords,
    isLoading,
    Pagination: isSearchMode ? <NumericalPagination /> : CursorPagination,
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
    handleRefresh,
    handleReload,
    selectableColumns,
    searchQuery,
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode: canToggleSearchMode(apiConfig),
  };
};
