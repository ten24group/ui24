import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Button, Tooltip, Badge, Descriptions, Tabs } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useNetworkStore, clearNetworkEntries, type NetworkEntry, type NetworkStatus } from '../store/network';
import { devtoolsNavigate } from '../store/devtools-navigation';
import { filterBar, mono12, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

type MethodFilter = 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type StatusFilter = 'all' | 'pending' | 'success' | 'error';

const METHOD_COLORS: Record<string, string> = {
  GET:     '#52c41a',
  POST:    '#1677ff',
  PUT:     '#fa8c16',
  PATCH:   '#13c2c2',
  DELETE:  '#f5222d',
  OPTIONS: '#8c8c8c',
  HEAD:    '#8c8c8c',
};

function statusIcon(ns: NetworkStatus, httpStatus?: number) {
  if (ns === 'pending') return <LoadingOutlined style={{ color: '#1677ff' }} />;
  if (ns === 'error' || (httpStatus != null && httpStatus >= 400)) {
    return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
  }
  return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
}

function statusColor(ns: NetworkStatus, httpStatus?: number): string {
  if (ns === 'pending') return '#1677ff';
  if (ns === 'error' || (httpStatus != null && httpStatus >= 400)) return '#f5222d';
  if (httpStatus != null && httpStatus >= 300) return '#fa8c16';
  return '#52c41a';
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

function safeCleanHeaders(h?: Record<string, string>): Record<string, string> {
  if (!h) return {};
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    const kl = k.toLowerCase();
    // Redact auth headers in display
    if (kl === 'authorization' || kl === 'x-api-key') {
      safe[k] = '[redacted]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

// ── Entry Detail Pane ──────────────────────────────────────────

const EntryDetail: React.FC<{ entry: NetworkEntry; onClose: () => void }> = ({ entry, onClose }) => {
  const reqHeaders = safeCleanHeaders(entry.requestHeaders);
  const resHeaders = safeCleanHeaders(entry.responseHeaders);

  return (
    <div style={{
      width: 440,
      minWidth: 320,
      borderLeft: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--ant-color-bg-container, #fff)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--ant-color-bg-layout, #fafafa)',
      }}>
        <Tag color={METHOD_COLORS[entry.method] || '#8c8c8c'} style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
          {entry.method}
        </Tag>
        <Text style={{ fontSize: 11, ...mono12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.endpoint}
        </Text>
        {entry.status && (
          <Tag color={statusColor(entry.networkStatus, entry.status)} style={{ margin: 0, fontSize: 11 }}>
            {entry.status}
          </Tag>
        )}
        <Button type="text" size="small" onClick={onClose} style={{ padding: 0, fontSize: 14, lineHeight: 1 }}>×</Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Meta */}
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #f5f5f5' }}>
          <Descriptions size="small" column={2} style={{ fontSize: 11 }}>
            <Descriptions.Item label="Time">{formatTimestamp(entry.timestamp)}</Descriptions.Item>
            <Descriptions.Item label="Duration">{formatDuration(entry.duration)}</Descriptions.Item>
            <Descriptions.Item label="URL" span={2}>
              <Text copyable style={mono12}>{entry.url}</Text>
            </Descriptions.Item>
            {entry.spanId && (
              <Descriptions.Item label="Trace" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ ...mono12, color: '#722ed1', fontSize: 10 }}>{entry.spanId.slice(0, 16)}…</Text>
                  <Button
                    size="small"
                    type="link"
                    icon={<LinkOutlined />}
                    style={{ padding: 0, fontSize: 11, height: 'auto' }}
                    onClick={() => devtoolsNavigate('debug', 'traces', { spanId: entry.spanId })}
                  >
                    View in Traces
                  </Button>
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>

        {/* Tabs: Request / Response */}
        <Tabs
          size="small"
          style={{ padding: '0 4px' }}
          tabBarStyle={{ marginBottom: 0, paddingLeft: 8 }}
          items={[
            {
              key: 'request',
              label: 'Request',
              children: (
                <div style={{ padding: '8px 12px' }}>
                  {Object.keys(reqHeaders).length > 0 && (
                    <>
                      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Headers</Text>
                      <JsonViewer data={reqHeaders} maxHeight={120} />
                    </>
                  )}
                  {entry.requestPayload !== undefined && (
                    <>
                      <Text strong style={{ fontSize: 11, display: 'block', marginTop: 8, marginBottom: 4 }}>Payload</Text>
                      <JsonViewer data={entry.requestPayload} maxHeight={200} />
                    </>
                  )}
                  {!entry.requestPayload && Object.keys(reqHeaders).length === 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>No request payload</Text>
                  )}
                </div>
              ),
            },
            {
              key: 'response',
              label: (
                <span>
                  Response
                  {entry.status && (
                    <Tag
                      color={statusColor(entry.networkStatus, entry.status)}
                      style={{ marginLeft: 4, fontSize: 10, lineHeight: '14px', padding: '0 4px' }}
                    >
                      {entry.status}
                    </Tag>
                  )}
                </span>
              ),
              children: (
                <div style={{ padding: '8px 12px' }}>
                  {entry.networkStatus === 'pending' && (
                    <Text type="secondary" style={{ fontSize: 11 }}>Waiting for response…</Text>
                  )}
                  {entry.errorMessage && (
                    <div style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--ant-color-error-bg, #fff2f0)', border: '1px solid var(--ant-color-error-border, #ffccc7)', borderRadius: 4, fontSize: 11, color: '#cf1322' }}>
                      {entry.errorMessage}
                    </div>
                  )}
                  {Object.keys(resHeaders).length > 0 && (
                    <>
                      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Headers</Text>
                      <JsonViewer data={resHeaders} maxHeight={100} />
                    </>
                  )}
                  {entry.responseBody !== undefined && (
                    <>
                      <Text strong style={{ fontSize: 11, display: 'block', marginTop: 8, marginBottom: 4 }}>Body</Text>
                      <JsonViewer data={entry.responseBody} maxHeight={280} />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

// ── Main Panel ─────────────────────────────────────────────────

export const NetworkPanel: React.FC<{ highlightNetworkId?: string }> = ({ highlightNetworkId }) => {
  const entries = useNetworkStore();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(highlightNetworkId ?? null);

  // When a highlight comes in from cross-panel navigation, auto-select it
  React.useEffect(() => {
    if (highlightNetworkId) setSelectedId(highlightNetworkId);
  }, [highlightNetworkId]);

  const reversed = useMemo(() => [...entries].reverse(), [entries]);

  const filtered = useMemo(() => {
    let result = reversed;
    if (methodFilter !== 'all') result = result.filter(e => e.method === methodFilter);
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') result = result.filter(e => e.networkStatus === 'pending');
      else if (statusFilter === 'success') result = result.filter(e => e.networkStatus === 'success');
      else if (statusFilter === 'error') result = result.filter(e => e.networkStatus === 'error' || (e.status != null && e.status >= 400));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.endpoint.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
    }
    return result;
  }, [reversed, methodFilter, statusFilter, search]);

  const selectedEntry = useMemo(() => entries.find(e => e.id === selectedId) ?? null, [entries, selectedId]);

  const handleClear = useCallback(() => {
    clearNetworkEntries();
    setSelectedId(null);
  }, []);

  const counts = useMemo(() => {
    let pending = 0, errors = 0;
    for (const e of entries) {
      if (e.networkStatus === 'pending') pending++;
      else if (e.networkStatus === 'error' || (e.status != null && e.status >= 400)) errors++;
    }
    return { total: entries.length, pending, errors };
  }, [entries]);

  const methods = useMemo(() => {
    const m = new Set<string>();
    for (const e of entries) m.add(e.method);
    return Array.from(m);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <Empty
        image={<ApiOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />}
        description={<span style={{ fontSize: 12 }}>No requests captured yet. Make an API call to see it here.</span>}
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ ...filterBar, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input
          prefix={<SearchOutlined style={{ color: colors.textLight }} />}
          placeholder="Filter by endpoint…"
          size="small"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        {/* Method filter pills */}
        {(['all', ...methods] as const).map(m => (
          <Tag
            key={m}
            color={m === 'all' ? (methodFilter === 'all' ? '#1677ff' : undefined) : (methodFilter === m ? METHOD_COLORS[m] : undefined)}
            onClick={() => setMethodFilter(m as MethodFilter)}
            style={{ cursor: 'pointer', margin: 0, userSelect: 'none', fontSize: 11 }}
          >
            {m === 'all' ? `All (${entries.length})` : m}
          </Tag>
        ))}
        {counts.errors > 0 && (
          <Badge count={counts.errors} size="small">
            <Tag
              color={statusFilter === 'error' ? '#f5222d' : undefined}
              onClick={() => setStatusFilter(p => p === 'error' ? 'all' : 'error')}
              style={{ cursor: 'pointer', margin: 0, fontSize: 11 }}
            >
              Errors
            </Tag>
          </Badge>
        )}
        {counts.pending > 0 && (
          <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
            {counts.pending} pending
          </Tag>
        )}
        <Tooltip title="Clear all">
          <Button size="small" icon={<DeleteOutlined />} onClick={handleClear} />
        </Tooltip>
      </div>

      {/* Main content: list + optional detail pane */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Entry list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <Empty description="No matching requests" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
          ) : (
            filtered.map(entry => {
              const isSelected = selectedId === entry.id;
              const isErr = entry.networkStatus === 'error' || (entry.status != null && entry.status >= 400);
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedId(isSelected ? null : entry.id)}
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--ant-color-primary-bg, #f0f5ff)' : isErr ? 'var(--ant-color-error-bg, #fff2f0)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {/* Status icon */}
                  <span style={{ fontSize: 12, width: 14, flexShrink: 0 }}>
                    {statusIcon(entry.networkStatus, entry.status)}
                  </span>

                  {/* Method badge */}
                  <Tag
                    color={METHOD_COLORS[entry.method] || '#8c8c8c'}
                    style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', padding: '0 4px', lineHeight: '16px', flexShrink: 0 }}
                  >
                    {entry.method}
                  </Tag>

                  {/* Endpoint */}
                  <Text
                    style={{
                      ...mono12,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isErr ? '#cf1322' : undefined,
                    }}
                  >
                    {entry.endpoint}
                  </Text>

                  {/* Right side: status code + duration + time */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {entry.status && (
                      <Text style={{ fontSize: 11, color: statusColor(entry.networkStatus, entry.status), fontWeight: 600, fontFamily: 'monospace' }}>
                        {entry.status}
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace', minWidth: 44, textAlign: 'right' }}>
                      {formatDuration(entry.duration)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, minWidth: 72 }}>
                      {formatTimestamp(entry.timestamp)}
                    </Text>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail pane */}
        {selectedEntry && (
          <EntryDetail entry={selectedEntry} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
};
