import { Pagination as AntPagination } from "antd";
import React from "react";

interface UsePaginationProps {
  pageCursor: Record<number, string>;
  getRecords: (pageNumber: number, cursor?: string) => void;
  currentPage: number;
  isLastPage: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export const usePagination = ({
  pageCursor,
  getRecords,
  currentPage,
  isLastPage,
  pageSize,
  onPageSizeChange
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

  const Pagination = currentPage > 0 && (
    <AntPagination
      current={currentPage}
      pageSize={pageSize}
      total={isLastPage ? currentPage * pageSize : (currentPage + 1) * pageSize}
      onChange={onPageChange}
      onShowSizeChange={(_, size) => onPageSizeChange(size)}
      showSizeChanger
      showTotal={(total, range) => `${range[ 0 ]}-${range[ 1 ]} of ${isLastPage ? range[ 1 ] : '∞'}`}
      pageSizeOptions={[ '10', '20', '50', '100' ]}
      disabled={false}
    />
  );

  return {
    Pagination
  }
}