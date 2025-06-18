import React, { Fragment, Key } from "react";
import { Tag } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';

interface IUseAppliedSorts {
  sort: SorterResult<any>[];
  setSort: (sort: SorterResult<any>[]) => void;
  getColumnNameByKey: (key: string) => string;
}

export const useAppliedSorts = ({ sort, setSort, getColumnNameByKey }: IUseAppliedSorts) => {
  const removeSort = (field: string | Key) => {
    setSort(sort.filter(s => s.field !== field));
  };

  const clearAllSorts = () => {
    setSort([]);
  };

  const hasActiveSorts = sort.length > 0;

  const DisplayAppliedSorts = () => {
    return (
      <Fragment>
        {hasActiveSorts && sort.map(s => {
          if (!s.field || Array.isArray(s.field)) return null;
          const handleClose = (e) => {
            e.preventDefault();
            removeSort(s.field as string);
          };

          const sortOrder = s.order === 'ascend' ? 'ASC' : 'DESC';

          return (
            <Tag key={s.field as string} color="blue" closable onClose={handleClose}>
              {getColumnNameByKey(s.field as string)} : {sortOrder}
            </Tag>
          );
        })}
      </Fragment>
    );
  };

  return {
    DisplayAppliedSorts,
    clearAllSorts,
    hasActiveSorts,
  };
}; 