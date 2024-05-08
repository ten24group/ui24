import React, { Fragment, useEffect } from "react";
import { Space, Table as AntTable, Spin } from "antd";
import { CustomPagination } from "./Pagination/Pagination";


import { useTable } from "./useTable";
import { ITableConfig } from "./type";

export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  paginationType = "default",
}: ITableConfig) => {
  
  const { columns, getRecords, listRecords, pageCursor, isLoading, currentPage, isLastPage } = useTable({
    propertiesConfig,
    apiConfig
  });
  

  const onPageChange = (pageNumber: number) => {
    const nextPageCursor = pageCursor[pageNumber] ?? "";
    getRecords(pageNumber, nextPageCursor);
  };

  return (
    <React.Fragment>
      <AntTable
        scroll={{ x: true }}
        columns={columns}
        dataSource={listRecords}
        pagination={false}
        loading={{
          indicator: (
            <div>
              <Spin />
            </div>
          ),
          spinning: isLoading,
        }}
      />
      {currentPage > 0 && (
        <CustomPagination
          currentPage={currentPage}
          onPageChange={onPageChange}
          isLastPage={isLastPage}
        />
      )}
    </React.Fragment>
  );
};
