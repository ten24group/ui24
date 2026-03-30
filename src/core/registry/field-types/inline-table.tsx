import React, { useMemo } from 'react';
import { Table, Button } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import { OpenInModal } from '../../../modal/Modal';
import { createModalConfig } from '../../../table/utils/modalConfigHelper';
import type { BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import type { IInlineTableConfig, IInlineTableColumnConfig } from '../../types/field-config';

function buildAntColumns(config: IInlineTableConfig) {
  return config.columns.map((col: IInlineTableColumnConfig) => ({
    title: col.label || col.key.charAt(0).toUpperCase() + col.key.slice(1),
    dataIndex: col.key,
    key: col.key,
    width: col.width,
    align: col.align || ('left' as const),
    render: (val: unknown) => (val !== null && val !== undefined ? String(val) : '—'),
  }));
}

const InlineTableDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const inlineConfig = config.inlineTableConfig;

  const rows = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((item, idx) => ({
      ...( typeof item === 'object' && item !== null ? item as Record<string, unknown> : {} ),
      _rowKey: idx,
    }));
  }, [ value ]);

  if (rows.length === 0) return <span style={{ color: '#8c8c8c' }}>—</span>;

  if (!inlineConfig?.columns?.length) {
    const sampleKeys = Object.keys(rows[ 0 ]).filter(k => k !== '_rowKey');
    const autoConfig: IInlineTableConfig = {
      columns: sampleKeys.map(key => ({ key })),
      size: 'small',
      showHeader: true,
      bordered: true,
    };
    return <InlineTableCore rows={rows} config={autoConfig} />;
  }

  return <InlineTableCore rows={rows} config={inlineConfig} />;
};

const InlineTableCore: React.FC<{
  rows: Array<Record<string, unknown>>;
  config: IInlineTableConfig;
}> = ({ rows, config }) => {
  const columns = useMemo(() => buildAntColumns(config), [ config ]);

  const scroll = config.maxRows && rows.length > config.maxRows
    ? { y: config.maxRows * 40 }
    : undefined;

  return (
    <Table
      dataSource={rows}
      columns={columns}
      rowKey="_rowKey"
      size={config.size || 'small'}
      showHeader={config.showHeader !== false}
      bordered={config.bordered !== false}
      pagination={false}
      scroll={scroll}
      style={{ width: '100%' }}
    />
  );
};

const InlineTableTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!Array.isArray(value) || value.length === 0) return <span>—</span>;

  const dataKey = column?.column || column?.name || 'value';
  const detailsConfig = createModalConfig(undefined, value, { dataIndex: dataKey }, 'list');
  const columnName = (typeof column?.label === 'string' ? column.label : undefined) || dataKey;

  return (
    <OpenInModal modalType="details" modalTitle={columnName} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<TableOutlined />} type="link">
        View ({value.length})
      </Button>
    </OpenInModal>
  );
};

export const inlineTableRegistrations: Record<string, FieldTypeRegistration> = {
  'inline-table': {
    detail: InlineTableDetail,
    table: InlineTableTable,
  },
};
