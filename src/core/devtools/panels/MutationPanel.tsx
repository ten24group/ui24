/**
 * Mutation Panel — shows all write operations (POST/PUT/PATCH/DELETE) captured
 * by the network store. Gives developers a focused view of state-changing calls:
 * entity affected, operation type, payload, result, and timing.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Button, Tooltip, Descriptions } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RightOutlined,
  DownOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useNetworkStore, clearNetworkEntries, type NetworkEntry } from '../store/network';
import { devtoolsNavigate } from '../store/devtools-navigation';
import { filterBar, mono12, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const METHOD_COLORS: Record<string, string> = {
  POST:   '#1677ff',
  PUT:    '#fa8c16',
  PATCH:  '#13c2c2',
  DELETE: '#f5222d',
};

const OPERATION_LABELS: Record<string, string> = {
  POST:   'Create',
  PUT:    'Update',
  PATCH:  'Partial update',
  DELETE: 'Delete',
};

function deriveEntityName(endpoint: string): string {
  const parts = endpoint.replace(/^\/+/, '').split('/').filter(Boolean);
  return parts[parts.length - 1]?.replace(/-/g, ' ') || endpoint;
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '…';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

type StatusFilter = 'all' | 'pending' | 'success' | 'error';

const STATUS_COLORS: Record<StatusFilter, string> = {
  all: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
  pending: '#1677ff',
  success: '#52c41a',
  error: '#f5222d',
};

function statusIcon(entry: NetworkEntry) {
  if (entry.networkStatus === 'pending') return <LoadingOutlined style={{ color: '#1677ff' }} />;
  if (entry.networkStatus === 'error' || (entry.status != null && entry.status >= 400)) {
    return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
  }
  return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
}

function statusTagColor(entry: NetworkEntry): string {
  if (entry.networkStatus === 'pending') return 'processing';
  if (entry.networkStatus === 'error' || (entry.status != null && entry.status >= 400)) return 'error';
  return 'success';
}

const MutationDetail: React.FC<{ entry: NetworkEntry }> = ({ entry }) => (
  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Descriptions size="small" column={2} bordered={false} labelStyle={{ color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', fontSize: 11 }}>
      <Descriptions.Item label="URL">
        <Text style={{ ...mono12, wordBreak: 'break-all', fontSize: 11 }}>{entry.url}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="Status">
        <Tag color={statusTagColor(entry)} style={{ margin: 0, fontSize: 11 }}>
          {entry.networkStatus === 'pending' ? 'Pending' : entry.status ?? 'Error'}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Duration">
        <Text style={{ fontSize: 11 }}>{formatDuration(entry.duration)}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="Time">
        <Text style={{ fontSize: 11 }}>{formatTimestamp(entry.timestamp)}</Text>
      </Descriptions.Item>
    </Descriptions>

    {entry.errorMessage && (
      <div style={{ padding: '4px 8px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
        <Text style={{ fontSize: 11, color: '#cf1322' }}>{entry.errorMessage}</Text>
      </div>
    )}

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {entry.requestPayload != null && (
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Request payload</Text>
          <JsonViewer data={entry.requestPayload as Record<string, unknown>} maxHeight={200} />
        </div>
      )}
      {entry.responseBody != null && (
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Response body</Text>
          <JsonViewer data={entry.responseBody as Record<string, unknown>} maxHeight={200} />
        </div>
      )}
    </div>

    {entry.spanId && (
      <div>
        <Button
          size="small"
          type="link"
          icon={<LinkOutlined />}
          style={{ padding: 0, fontSize: 11 }}
          onClick={() => devtoolsNavigate('debug', 'traces', { spanId: entry.spanId })}
        >
          View in Traces
        </Button>
      </div>
    )}
  </div>
);

export const MutationPanel: React.FC = () => {
  const allEntries = useNetworkStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const mutations = useMemo(
    () => allEntries.filter(e => WRITE_METHODS.has(e.method)).slice().reverse(),
    [allEntries],
  );

  const filtered = useMemo(() => {
    let result = mutations;
    if (statusFilter !== 'all') {
      result = result.filter(e => {
        if (statusFilter === 'error') return e.networkStatus === 'error' || (e.status != null && e.status >= 400);
        if (statusFilter === 'pending') return e.networkStatus === 'pending';
        return e.networkStatus === 'success' && (e.status == null || e.status < 400);
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.endpoint.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        (e.url.toLowerCase().includes(q))
      );
    }
    return result;
  }, [mutations, search, statusFilter]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const counts = useMemo(() => {
    const pending = mutations.filter(e => e.networkStatus === 'pending').length;
    const errors = mutations.filter(e => e.networkStatus === 'error' || (e.status != null && e.status >= 400)).length;
    const success = mutations.filter(e => e.networkStatus === 'success' && (e.status == null || e.status < 400)).length;
    return { pending, errors, success };
  }, [mutations]);

  if (mutations.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Empty description="No mutations recorded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          POST, PUT, PATCH and DELETE calls will appear here once you interact with forms.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary bar */}
      <div style={{
        padding: '6px 12px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bgLight,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        fontSize: 12,
      }}>
        <Text strong style={{ fontSize: 12 }}>{mutations.length} total</Text>
        {counts.errors > 0 && <Text style={{ color: '#f5222d', fontSize: 12 }}>{counts.errors} errors</Text>}
        {counts.pending > 0 && <Text style={{ color: '#1677ff', fontSize: 12 }}>{counts.pending} pending</Text>}
        <Text style={{ color: '#52c41a', fontSize: 12 }}>{counts.success} success</Text>
        <div style={{ marginLeft: 'auto' }}>
          <Button
            size="small"
            type="text"
            icon={<DeleteOutlined />}
            onClick={clearNetworkEntries}
            style={{ fontSize: 12 }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...filterBar, gap: 6 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
          placeholder="Filter by endpoint..."
          size="small"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        {(['all', 'success', 'error', 'pending'] as StatusFilter[]).map(s => (
          <Tag
            key={s}
            color={statusFilter === s ? STATUS_COLORS[s] : undefined}
            onClick={() => setStatusFilter(s)}
            style={{
              cursor: 'pointer',
              fontSize: 11,
              margin: 0,
              opacity: statusFilter === s ? 1 : 0.6,
              userSelect: 'none',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Tag>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.length === 0 ? (
          <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
        ) : (
          filtered.map(entry => {
            const isOpen = expanded.has(entry.id);
            const isError = entry.networkStatus === 'error' || (entry.status != null && entry.status >= 400);
            const methodColor = METHOD_COLORS[entry.method] || 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))';
            const entity = deriveEntityName(entry.endpoint);

            return (
              <div
                key={entry.id}
                style={{
                  borderRadius: 6,
                  border: `1px solid ${isError ? 'var(--ant-color-error-border, #ffccc7)' : isOpen ? 'var(--ant-color-border, #d9d9d9)' : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
                  background: isError ? 'var(--ant-color-error-bg, #fff2f0)' : 'var(--ant-color-bg-container, #fff)',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                <div
                  onClick={() => toggle(entry.id)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    userSelect: 'none',
                  }}
                >
                  {isOpen
                    ? <DownOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', flexShrink: 0 }} />
                    : <RightOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', flexShrink: 0 }} />
                  }
                  <span style={{ ...mono12, fontSize: 11, fontWeight: 700, color: methodColor, flexShrink: 0 }}>
                    {entry.method}
                  </span>
                  <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                    {OPERATION_LABELS[entry.method] ?? entry.method}
                  </Text>
                  <Text strong style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entity}
                  </Text>
                  <span style={{ flexShrink: 0 }}>{statusIcon(entry)}</span>
                  {entry.duration !== undefined && (
                    <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                      {formatDuration(entry.duration)}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                    {formatTimestamp(entry.timestamp)}
                  </Text>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
                    <MutationDetail entry={entry} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
