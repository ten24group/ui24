import { CustomPagination } from "./Pagination";
import React  from "react";
export const usePagination = ({
    pageCursor,
    getRecords,
    currentPage,
    isLastPage
}) => {
    //PAGINATION
  const onPageChange = (pageNumber: number) => {
    const nextPageCursor = pageCursor[pageNumber] ?? "";
    getRecords(pageNumber, nextPageCursor);
  };

  const Pagination = currentPage > 0 &&  <CustomPagination
      currentPage={currentPage}
      onPageChange={onPageChange}
      isLastPage={isLastPage}
    />

  return {
    Pagination
  }
}