import React, { Fragment, useEffect } from "react";
import { ITablePropertiesConfig, IActionIndexValue, IRecord, IPageAction } from "./type";
import { IApiConfig } from "../core";
import type { TableProps } from "antd";
import { callApiMethod } from "../core";
import { Modal } from "../modal/Modal";
import { Icon } from "../core/common";
import { Link } from "../core/common";
import { useAppContext } from "../core/context/AppContext";
import { Space } from 'antd';
import { getColumnFilterProps } from "./filters";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: IApiConfig;
}

const recordPerPage = 10;

export const useTable = ({ propertiesConfig, apiConfig }: IuseTable) => {
  
  const [listRecords, setListRecords] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [pageCursor, setPageCursor] = React.useState<Record<number, string>>(
    {}
  );
  const [isLastPage, setIsLastPage] = React.useState(false);

  const { notifyError } = useAppContext();

  //call API get records
  const getRecords = async (
    pageNumber: number = 1,
    currentPageCursor: string = ""
  ) => {
    const payload = {
      cursor: currentPageCursor,
      limit: recordPerPage,
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
    } else if (response?.status === 400 || response?.status === 500) {
      notifyError(response?.error);
    }
  };

  useEffect(() => {
    getRecords();
  }, []);

  const columns = transformColumns(propertiesConfig, getRecords);

  return { columns, getRecords, listRecords, isLoading, currentPage, isLastPage, pageCursor};
};

const transformColumns = ( propertiesConfig: Array<ITablePropertiesConfig>, getRecordsCallback: () => void ) => {
  const columns: TableProps<any>["columns"] = propertiesConfig
    .filter((item: ITablePropertiesConfig) => !item?.hidden)
    .map((item, index) => {
      const column = {
        title: item.name,
        dataIndex: item.dataIndex,
        key: item.dataIndex,
      }
      //add filters on column
      if( item?.isFilterable === true || item?.isFilterable === undefined ) {
        return {
          ...column,
          ...getColumnFilterProps( column.dataIndex, column.title )
        }
      }
      return column;
    });
  
  //Add action column in Table
  //loop over propertiesConfig and create an object where key is the dataIndex and value is the actions array
  //if the actions array is empty, then do not include the key in the object
  const actionIndexValue: IActionIndexValue = propertiesConfig
    .map((item, index) => {
      return {
        [item.dataIndex]: item.actions,
      };
    })
    .filter((item) => Object.values(item)?.length > 0)
    ?.reduce((acc: IActionIndexValue, item) => {
      return { ...acc, ...item };
    });

  //check if actionIndexValue has any keys, if yes, then add a column for actions
  if (Object.keys(actionIndexValue).length > 0) {
    columns.push({
      title: (
        <div style={{ display: "flex", justifyContent: "end" }}>Action</div>
      ),
      key: "action",
      render: (_, record: IRecord) => {
        //create a list of values from the record object based on the keys in actionIndexValue for every action added
        let primaryIndexValue: Array<string> | string = [];
        let recordActions: Array<IPageAction> = [];
        for (let key in record) {
          if (key in actionIndexValue && actionIndexValue[key]) {
            primaryIndexValue.push(record[key]);
            recordActions = actionIndexValue[key];
          }
        }
        primaryIndexValue = primaryIndexValue.join("|");

        return (
          <div style={{ display: "flex", justifyContent: "end" }}>
            <Space size="middle" align="end">
              {recordActions?.map((item: IPageAction, index) => {
                return (
                  <Fragment key={index}>
                    {item.openInModel ? (
                      <Modal
                        onSuccessCallback={getRecordsCallback}
                        primaryIndex={primaryIndexValue}
                        {...item.modelConfig}
                      />
                    ) : (
                      <Link url={item.url + "/" + primaryIndexValue}>
                        <Icon iconName={item.icon} />
                      </Link>
                    )}{" "}
                  </Fragment>
                );
              })}
            </Space>
          </div>
        );
      },
    });
  }

  return columns
}
