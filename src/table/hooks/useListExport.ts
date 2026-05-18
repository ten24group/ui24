import React from 'react';
import { message } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { useApi } from '../../core/context/ApiContext';
import { PASS_THROUGH_URL_PARAMS } from '../constants';
import { getNestedValue, substituteUrlParams } from '../../core/utils';
import { resolveFilterPlaceholders } from '../../core/utils/placeholderResolver';
import { usePlaceholderContext } from './usePlaceholderContext';
import {
  downloadExportFile,
  prepareRecordsForExport,
  recordsToCsv,
  recordsToExcelXml,
  sanitizeFilenamePart,
  type ExportColumn,
  type ExportFormat,
} from '../../core/utils/exportUtils';
import { getFilterPayload } from './useTableData';
import type { IExportConfig, ITableApiConfig, ITablePropertiesConfig } from '../type';

const DEFAULT_EXPORT_PAGE_SIZE = 500;
const DEFAULT_MAX_RECORDS = 10_000;

export type ExportScope = 'currentPage' | 'filtered';

interface UseListExportOptions {
  entityName?: string;
  apiConfig: ITableApiConfig;
  routeParams?: Record<string, string>;
  appliedFilters: Record<string, unknown>;
  searchQuery: string;
  sort: SorterResult<unknown>[];
  /** When true, uses the search API (`q`, page/hitsPerPage). Otherwise database API (cursor/count). */
  isSearchMode: boolean;
  propertiesConfig: ITablePropertiesConfig[];
  visibleColumns: string[];
  listRecords: Record<string, unknown>[];
  exportConfig?: IExportConfig;
}

function getSortString(sort: SorterResult<unknown>[]): string {
  if (!sort.length) return '';
  return sort
    .map(s => s.field && s.order ? `${String(s.field)}:${s.order === 'ascend' ? 'asc' : 'desc'}` : null)
    .filter(Boolean)
    .join(',');
}

/**
 * List export hook for entity tables.
 *
 * Supports CSV and Excel downloads for:
 * - the current page (rows already loaded in the table), and
 * - all rows matching the active filters (paginated fetch using the same API as the table).
 *
 * Respects database vs search mode so exports always use the endpoint the user selected.
 */
export function useListExport({
  entityName,
  apiConfig,
  routeParams = {},
  appliedFilters,
  searchQuery,
  sort,
  isSearchMode,
  propertiesConfig,
  visibleColumns,
  listRecords,
  exportConfig,
}: UseListExportOptions) {
  const { callApiMethod } = useApi();
  const placeholderContext = usePlaceholderContext(routeParams);
  const [ exporting, setExporting ] = React.useState(false);

  const enabled = exportConfig?.enabled !== false && !!apiConfig?.apiUrl;
  const formats = exportConfig?.formats ?? [ 'csv', 'xlsx' ];
  const maxRecords = exportConfig?.maxRecords ?? DEFAULT_MAX_RECORDS;
  const exportPageSize = Math.min(exportConfig?.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE, maxRecords);

  const exportColumns = React.useMemo<ExportColumn[]>(() => {
    const columnMap = new Map(propertiesConfig.map(p => [ p.dataIndex, p ]));
    return visibleColumns
      .map(dataIndex => {
        const property = columnMap.get(dataIndex);
        if (!property) return null;
        return {
          dataIndex,
          label: property.label || property.name || dataIndex,
        };
      })
      .filter((col): col is ExportColumn => col !== null);
  }, [ propertiesConfig, visibleColumns ]);

  /** Mirrors useTableData payload construction so export queries match the visible table. */
  const buildBasePayload = React.useCallback(() => {
    const resolvedFilters = resolveFilterPlaceholders(appliedFilters, placeholderContext);
    const filterPayload = getFilterPayload(resolvedFilters, apiConfig.apiMethod);
    const payload: Record<string, unknown> = { ...filterPayload };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if ((PASS_THROUGH_URL_PARAMS as readonly string[]).includes(key)) {
          payload[ key ] = value;
        }
      });
    }

    const sortString = getSortString(sort);
    if (isSearchMode) {
      if (searchQuery) payload.q = searchQuery;
      if (sortString) payload.sort = sortString;
    } else if (sort.length > 0 && sort[ 0 ].order) {
      payload.order = sort[ 0 ].order === 'ascend' ? 'asc' : 'desc';
    } else if (typeof apiConfig.defaultSort === 'string') {
      payload.order = apiConfig.defaultSort;
    }

    return payload;
  }, [
    appliedFilters,
    placeholderContext,
    apiConfig.apiMethod,
    apiConfig.defaultSort,
    sort,
    isSearchMode,
    searchQuery,
  ]);

  /** Fetches all pages for the current filter set (search: page index, database: cursor). */
  const fetchAllFilteredRecords = React.useCallback(async (): Promise<Record<string, unknown>[]> => {
    const apiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams);
    const responseKey = apiConfig.responseKey || 'items';
    const collected: Record<string, unknown>[] = [];

    if (isSearchMode) {
      let page = 1;
      while (collected.length < maxRecords) {
        const payload = {
          ...buildBasePayload(),
          page,
          hitsPerPage: Math.min(exportPageSize, maxRecords - collected.length),
        };
        const response = await callApiMethod({
          ...apiConfig,
          apiUrl,
          payload,
        });
        if (response.status < 200 || response.status >= 300) {
          throw response;
        }
        const items = getNestedValue(response.data, responseKey) ?? response.data?.items ?? [];
        if (!Array.isArray(items) || items.length === 0) break;
        collected.push(...items);
        if (items.length < (payload.hitsPerPage as number)) break;
        page += 1;
      }
    } else {
      let cursor = '';
      while (collected.length < maxRecords) {
        const payload = {
          ...buildBasePayload(),
          cursor,
          count: Math.min(exportPageSize, maxRecords - collected.length),
        };
        const response = await callApiMethod({
          ...apiConfig,
          apiUrl,
          payload,
        });
        if (response.status < 200 || response.status >= 300) {
          throw response;
        }
        const items = getNestedValue(response.data, responseKey) ?? response.data?.items ?? [];
        if (!Array.isArray(items) || items.length === 0) break;
        collected.push(...items);
        const nextCursor = response.data?.cursor;
        if (!nextCursor || items.length < (payload.count as number)) break;
        cursor = nextCursor;
      }
    }

    return collected.slice(0, maxRecords);
  }, [
    apiConfig,
    routeParams,
    buildBasePayload,
    callApiMethod,
    exportPageSize,
    isSearchMode,
    maxRecords,
  ]);

  const runExport = React.useCallback(async (
    format: ExportFormat,
    scope: ExportScope
  ) => {
    if (!exportColumns.length) {
      message.warning('No visible columns to export');
      return;
    }

    setExporting(true);
    try {
      const rawRecords = scope === 'currentPage'
        ? listRecords
        : await fetchAllFilteredRecords();

      if (!rawRecords.length) {
        message.info('No records to export');
        return;
      }

      const records = prepareRecordsForExport(rawRecords);
      const modeLabel = isSearchMode ? 'search' : 'database';
      const scopeLabel = scope === 'currentPage' ? 'page' : 'filtered';
      const entityPart = sanitizeFilenamePart(entityName || 'list');
      const filenameBase = `${entityPart}-${modeLabel}-${scopeLabel}`;

      if (format === 'csv') {
        downloadExportFile(
          recordsToCsv(records, exportColumns),
          `${filenameBase}.csv`,
          'text/csv;charset=utf-8'
        );
      } else {
        downloadExportFile(
          recordsToExcelXml(records, exportColumns),
          `${filenameBase}.xls`,
          'application/vnd.ms-excel'
        );
      }

      message.success(`Exported ${records.length} record${records.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [
    exportColumns,
    listRecords,
    fetchAllFilteredRecords,
    isSearchMode,
    entityName,
  ]);

  const exportMenuItems = React.useMemo(() => {
    const modeLabel = isSearchMode ? 'search' : 'database';
    const items: Array<{ key: string; label: string; onClick: () => void }> = [];

    if (formats.includes('csv')) {
      items.push({
        key: 'csv-page',
        label: `CSV — current page (${modeLabel})`,
        onClick: () => { void runExport('csv', 'currentPage'); },
      });
      items.push({
        key: 'csv-filtered',
        label: `CSV — all filtered (${modeLabel})`,
        onClick: () => { void runExport('csv', 'filtered'); },
      });
    }

    if (formats.includes('xlsx')) {
      items.push({
        key: 'xlsx-page',
        label: `Excel — current page (${modeLabel})`,
        onClick: () => { void runExport('xlsx', 'currentPage'); },
      });
      items.push({
        key: 'xlsx-filtered',
        label: `Excel — all filtered (${modeLabel})`,
        onClick: () => { void runExport('xlsx', 'filtered'); },
      });
    }

    return items;
  }, [ formats, isSearchMode, runExport ]);

  return {
    enabled,
    exporting,
    exportMenuItems,
  };
}
