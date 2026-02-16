import { Pagination as AntPagination } from "antd";
import React from "react";
import type { IPaginationConfig } from "../type";

const DEFAULT_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

/** Resolve pagination config to AntPagination-compatible props */
function resolvePageSizeOptions(config?: IPaginationConfig): string[] {
  return config?.pageSizeOptions
    ? config.pageSizeOptions.map(String)
    : DEFAULT_PAGE_SIZE_OPTIONS;
}

// ============================================================================
// CURSOR PAGINATION (database mode — unknown total)
// ============================================================================

interface UseCursorPaginationProps {
  pageCursor: Record<number, string>;
  getRecords: (pageNumber: number, cursor?: string) => void;
  currentPage: number;
  isLastPage: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPageRecordCount: number;
  paginationConfig?: IPaginationConfig;
}

export const useCursorPagination = ({
  pageCursor,
  getRecords,
  currentPage,
  isLastPage,
  pageSize,
  onPageSizeChange,
  currentPageRecordCount,
  paginationConfig,
}: UseCursorPaginationProps) => {
  const onPageChange = (page: number, newPageSize: number) => {
    if (newPageSize !== pageSize) {
      onPageSizeChange(newPageSize);
      return;
    }
    const nextPageCursor = pageCursor[page] ?? "";
    getRecords(page, nextPageCursor);
  };

  // Edge case: API returns cursor but 0 records — treat as last page
  const effectiveIsLastPage = isLastPage || currentPageRecordCount === 0;
  const showTotal = paginationConfig?.showTotal !== false;

  // For cursor pagination, total is unknown upfront.
  // Fake total to enable the "Next" button, or compute real total on last page.
  const computedTotal = effectiveIsLastPage
    ? (currentPage - 1) * pageSize + currentPageRecordCount
    : (currentPage + 1) * pageSize;

  const Pagination = currentPage > 0 && (
    <AntPagination
      current={currentPage}
      pageSize={pageSize}
      total={computedTotal}
      onChange={onPageChange}
      onShowSizeChange={(_, size) => onPageSizeChange(size)}
      showSizeChanger
      showTotal={showTotal
        ? (total, range) => effectiveIsLastPage
          ? `${range[0]}-${range[1]} of ${total}`
          : `Showing ${range[0]}-${range[1]}`
        : undefined
      }
      pageSizeOptions={resolvePageSizeOptions(paginationConfig)}
      disabled={false}
    />
  );

  return { Pagination };
};

/** @deprecated Use useCursorPagination — kept as alias for backward compatibility */
export const usePagination = useCursorPagination;

// ============================================================================
// OFFSET PAGINATION (search mode — known total)
// ============================================================================

interface OffsetPaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  paginationConfig?: IPaginationConfig;
}

export const OffsetPagination: React.FC<OffsetPaginationProps> = ({
  currentPage,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  paginationConfig,
}) => (
  <AntPagination
    current={currentPage}
    total={totalRecords}
    pageSize={pageSize}
    onChange={(page, newPageSize) => {
      if (newPageSize !== pageSize) {
        onPageSizeChange(newPageSize);
      } else {
        onPageChange(page);
      }
    }}
    onShowSizeChange={(_, size) => onPageSizeChange(size)}
    showSizeChanger
    showTotal={paginationConfig?.showTotal !== false
      ? (total, range) => `${range[0]}-${range[1]} of ${total}`
      : undefined
    }
    showQuickJumper={paginationConfig?.showQuickJumper ?? false}
    pageSizeOptions={resolvePageSizeOptions(paginationConfig)}
  />
);
