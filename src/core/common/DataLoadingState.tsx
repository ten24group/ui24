import React from 'react';
import { Spin } from 'antd';
import { PageSkeleton } from './PageSkeleton';

interface DataLoadingStateProps {
  type?: 'skeleton' | 'spinner';
  pageType: 'form' | 'detail' | 'table' | 'card-grid' | 'kanban' | 'calendar' | 'tree' | 'map';
  rows?: number;
  columns?: number;
}

export const DataLoadingState: React.FC<DataLoadingStateProps> = ({
  type = 'skeleton',
  pageType,
  rows,
  columns,
}) => {
  if (type === 'spinner') {
    return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>;
  }
  return <PageSkeleton type={pageType} rows={rows} columns={columns} />;
};
