import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Input, Button, Tag, Empty, Tooltip, Table, Descriptions, message, Segmented, Space } from 'antd';
import {
  CopyOutlined,
  SearchOutlined,
  CodeOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useDevToolsStore } from '../store/snapshot';
import { extractFieldsFromStore, getLatestPageConfig, ExtractedField } from '../utils/fieldExtractor';

const { Text } = Typography;

type ViewMode = 'fields' | 'raw';

const FieldConfigPopover: React.FC<{ field: ExtractedField }> = ({ field }) => {
  const [ showRaw, setShowRaw ] = useState(false);
  return (
    <div>
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 8 }}>
        <Descriptions.Item label="Name">{field.name}</Descriptions.Item>
        <Descriptions.Item label="Type">{field.fieldType || 'text'}</Descriptions.Item>
        {field.label && <Descriptions.Item label="Label">{field.label}</Descriptions.Item>}
        <Descriptions.Item label="Required">{field.required ? 'Yes' : 'No'}</Descriptions.Item>
        {field.hidden != null && <Descriptions.Item label="Hidden">{field.hidden ? 'Yes' : 'No'}</Descriptions.Item>}
        {field.visibility && <Descriptions.Item label="Visibility" span={2}>
          <Text code style={{ fontSize: 10, wordBreak: 'break-all' }}>
            {JSON.stringify(field.visibility)}
          </Text>
        </Descriptions.Item>}
        {field.enablement && <Descriptions.Item label="Enablement" span={2}>
          <Text code style={{ fontSize: 10, wordBreak: 'break-all' }}>
            {JSON.stringify(field.enablement)}
          </Text>
        </Descriptions.Item>}
      </Descriptions>
      <Button size="small" type="link" onClick={() => setShowRaw(!showRaw)} style={{ padding: 0, fontSize: 11 }}>
        {showRaw ? 'Hide raw config' : 'Show raw config'}
      </Button>
      {showRaw && (
        <div style={{ marginTop: 8 }}>
          <JsonViewer data={field.fullConfig} maxHeight={300} />
        </div>
      )}
    </div>
  );
};

export const ConfigInspectorPanel: React.FC = () => {
  const store = useDevToolsStore();
  const [ mode, setMode ] = useState<ViewMode>('fields');
  const [ search, setSearch ] = useState('');
  const [ expandedRowKeys, setExpandedRowKeys ] = useState<string[]>([]);

  const fields = useMemo(() => extractFieldsFromStore(store), [ store ]);
  const pageConfig = useMemo(() => getLatestPageConfig(store), [ store ]);

  const filteredFields = useMemo(() => {
    if (!search) return fields;
    const q = search.toLowerCase();
    return fields.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.label?.toLowerCase().includes(q)) ||
      (f.fieldType?.toLowerCase().includes(q)) ||
      f.source.toLowerCase().includes(q)
    );
  }, [ fields, search ]);

  const copyConfig = useCallback(async () => {
    if (!pageConfig) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(pageConfig, null, 2));
      message.success('Page config copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  }, [ pageConfig ]);

  const copyFieldConfig = useCallback(async (field: ExtractedField) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(field.fullConfig, null, 2));
      message.success(`Copied config for "${field.name}"`);
    } catch {
      message.error('Failed to copy');
    }
  }, []);

  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string, record: ExtractedField) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{name}</Text>
          {record.label && record.label !== name && (
            <div><Text type="secondary" style={{ fontSize: 10 }}>{record.label}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'fieldType',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag style={{ margin: 0, fontSize: 10 }}>{type || 'text'}</Tag>,
    },
    {
      title: 'Flags',
      key: 'flags',
      width: 140,
      render: (_: unknown, record: ExtractedField) => (
        <Space size={2}>
          {record.required && <Tag color="red" style={{ margin: 0, fontSize: 9 }}>required</Tag>}
          {record.hidden && <Tag color="default" style={{ margin: 0, fontSize: 9 }}>hidden</Tag>}
          {record.visibility && <Tag color="purple" style={{ margin: 0, fontSize: 9 }}>conditional</Tag>}
          {record.enablement && <Tag color="blue" style={{ margin: 0, fontSize: 9 }}>enablement</Tag>}
        </Space>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (s: string) => <Text type="secondary" style={{ fontSize: 11 }}>{s}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 40,
      render: (_: unknown, record: ExtractedField) => (
        <Tooltip title="Copy field config">
          <Button
            size="small" type="text"
            icon={<CopyOutlined style={{ fontSize: 11 }} />}
            onClick={(e) => { e.stopPropagation(); copyFieldConfig(record); }}
          />
        </Tooltip>
      ),
    },
  ], [ copyFieldConfig ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Segmented
            size="small"
            value={mode}
            onChange={val => setMode(val as ViewMode)}
            options={[
              { label: <span><UnorderedListOutlined /> Fields ({fields.length})</span>, value: 'fields' },
              { label: <span><CodeOutlined /> Raw Config</span>, value: 'raw' },
            ]}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Button size="small" icon={<CopyOutlined />} onClick={copyConfig} disabled={!pageConfig}>
              Copy Config
            </Button>
          </div>
        </div>

        {mode === 'fields' && (
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
            placeholder="Filter fields..."
            size="small"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'fields' ? (
          filteredFields.length === 0 ? (
            <Empty
              description={search ? 'No matching fields' : 'No fields in current page config'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 32 }}
            />
          ) : (
            <Table
              dataSource={filteredFields}
              columns={columns}
              size="small"
              pagination={false}
              rowKey="key"
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: keys => setExpandedRowKeys(keys as string[]),
                expandedRowRender: (record: ExtractedField) => <FieldConfigPopover field={record} />,
              }}
              style={{ fontSize: 12 }}
            />
          )
        ) : (
          <div style={{ padding: 12 }}>
            {pageConfig ? (
              <JsonViewer data={pageConfig} maxHeight={600} />
            ) : (
              <Empty description="No page config available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
