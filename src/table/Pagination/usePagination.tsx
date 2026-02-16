import { Pagination as AntPagination } from "antd";
import React from "react";

interface UsePaginationProps {
  pageCursor: Record<number, string>;
  getRecords: (pageNumber: number, cursor?: string) => void;
  currentPage: number;
  isLastPage: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPageRecordCount: number;
}

export const usePagination = ({
  pageCursor,
  getRecords,
  currentPage,
  isLastPage,
  pageSize,
  onPageSizeChange,
  currentPageRecordCount
}: UsePaginationProps) => {
  const onPageChange = (page: number, newPageSize: number) => {
    // If page size changed, reset to page 1 and trigger refetch
    if (newPageSize !== pageSize) {
      onPageSizeChange(newPageSize);
      return;
    }

    const nextPageCursor = pageCursor[ page ] ?? "";
    getRecords(page, nextPageCursor);
  };

  // For cursor-based pagination, we don't know the total upfront.
  // On intermediate pages, fake total = (currentPage + 1) * pageSize to show a "Next" button.
  // On the last page, compute the real total from prior full pages + actual records on this page.
  const computedTotal = isLastPage
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
      showTotal={(total, range) => `${range[ 0 ]}-${range[ 1 ]} of ${isLastPage ? total : '∞'}`}
      pageSizeOptions={[ '10', '20', '50', '100' ]}
      disabled={false}
    />
  );

  return {
    Pagination
  }
}