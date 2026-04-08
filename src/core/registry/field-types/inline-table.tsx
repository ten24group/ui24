import React, { useMemo, useState } from 'react';
import { Table, Button, Space, Typography } from 'antd';
import { TableOutlined, CodeOutlined } from '@ant-design/icons';
import { OpenInModal } from '../../../modal/Modal';
import { createModalConfig } from '../../../table/utils/modalConfigHelper';
import type { BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import type { IInlineTableConfig, IInlineTableColumnConfig } from '../../types/field-config';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';

function renderPrimitiveValue(val: unknown) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'bigint') return String(val);
  return String(val);
}

function CellValue({ value, title }: { value: unknown; title: string }) {
  if (value && typeof value === 'object') {
    return (
      <JsonViewer
        data={value}
        title={title}
        compact={true}
        showCopy={false}
        showStats={false}
      />
    );
  }
  return <span>{renderPrimitiveValue(value)}</span>;
}

const InlineJsonView: React.FC<{ rawData: unknown; title?: string }> = ({ rawData, title }) => (
  <JsonViewer
    data={rawData}
    title={title}
    compact={false}
    showCopy={true}
    showStats={true}
  />
);

const InlineModeToggle: React.FC<{
  currentMode: 'table' | 'json';
  tableLabel?: string;
  jsonLabel?: string;
  onToggle: () => void;
}> = ({ currentMode, tableLabel, jsonLabel, onToggle }) => (
  <Space size={4} style={{ justifyContent: 'flex-end', width: '100%' }}>
    <Button
      type="text"
      size="small"
      icon={currentMode === 'json' ? <CodeOutlined /> : <TableOutlined />}
      onClick={onToggle}
    >
      {currentMode === 'json' ? jsonLabel : tableLabel}
    </Button>
  </Space>
);

function buildAntColumns(config: IInlineTableConfig) {
  return config.columns.map((col: IInlineTableColumnConfig) => ({
    title: col.label || col.key.charAt(0).toUpperCase() + col.key.slice(1),
    dataIndex: col.key,
    key: col.key,
    width: col.width,
    align: col.align || ('left' as const),
    render: (val: unknown) => (
      <CellValue value={val} title={col.label || col.key} />
    ),
  }));
}

const InlineTableDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const inlineConfig = config.inlineTableConfig;

  const rows = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((item, idx) => ({
      ...(typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}),
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
    return <InlineTableWithModes rows={rows} rawData={value} config={autoConfig} />;
  }

  return <InlineTableWithModes rows={rows} rawData={value} config={inlineConfig} />;
};

const InlineTableWithModes: React.FC<{
  rows: Array<Record<string, unknown>>;
  rawData: unknown;
  config: IInlineTableConfig;
}> = ({ rows, rawData, config }) => {
  const hasNestedValues = useMemo(
    () =>
      rows.some((row) =>
        Object.entries(row).some(([ key, value ]) => key !== '_rowKey' && value !== null && typeof value === 'object'),
      ),
    [ rows ],
  );
  const viewMode = config.viewMode || 'table';
  const tableLabel = config.tabLabels?.table;
  const jsonLabel = config.tabLabels?.json;
  const [ currentMode, setCurrentMode ] = useState<'table' | 'json'>(
    viewMode === 'json' ? 'json' : 'table',
  );

  const canToggleJson = hasNestedValues || viewMode === 'json' || viewMode === 'tabs';
  const effectiveMode: 'table' | 'json' =
    viewMode === 'json' ? 'json' : (!canToggleJson || currentMode === 'table' ? 'table' : 'json');

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      {canToggleJson && (
        <InlineModeToggle
          currentMode={effectiveMode}
          tableLabel={tableLabel}
          jsonLabel={jsonLabel}
          onToggle={() => setCurrentMode((mode) => (mode === 'json' ? 'table' : 'json'))}
        />
      )}
      {effectiveMode === 'table'
        ? <InlineTableCore rows={rows} config={config} />
        : <InlineJsonView rawData={rawData} title={jsonLabel} />}
    </Space>
  );
};

const InlineTableCore: React.FC<{
  rows: Array<Record<string, unknown>>;
  config: IInlineTableConfig;
}> = ({ rows, config }) => {
  const columns = useMemo(() => buildAntColumns(config), [ config ]);

  const scroll = config.maxRows && rows.length > config.maxRows
    ? { y: config.maxRows * 40 }
    : undefined;

  const pagination = useMemo(() => {
    if (config.pagination === false) return false;

    const defaults = {
      pageSize: 5,
      showSizeChanger: true,
      pageSizeOptions: [ 10, 25, 50, 100 ],
      size: 'small' as const,
      showTotal: (total: number, range: [ number, number ]) => `${range[ 0 ]}-${range[ 1 ]} of ${total}`,
    };

    if (config.pagination === true || config.pagination === undefined) {
      return rows.length > defaults.pageSize ? defaults : false;
    }

    return {
      ...defaults,
      ...config.pagination,
      pageSizeOptions: (config.pagination.pageSizeOptions || defaults.pageSizeOptions).map(String),
    };
  }, [ config.pagination, rows.length ]);

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'}
      </Typography.Text>
      <Table
        dataSource={rows}
        columns={columns}
        rowKey="_rowKey"
        size={config.size || 'small'}
        showHeader={config.showHeader !== false}
        bordered={config.bordered !== false}
        virtual={true}
        pagination={pagination}
        scroll={{x: true}}
        style={{ width: '100%' }}
      />
    </Space>
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
