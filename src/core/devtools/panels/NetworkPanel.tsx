import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Button, Segmented, Tabs, Tooltip, Statistic } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  RightOutlined,
  DownOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useActivityLog, clearActivityLog, ActivityEvent } from '../devtoolsBridge';

const { Text } = Typography;

type MethodFilter = 'all' | 'GET' | 'POST' | 'PUT' | 'DELETE';
type StatusFilter = 'all' | 'success' | 'error' | 'pending';

const METHOD_COLORS: Record<string, string> = {
  GET: '#1677ff',
  POST: '#52c41a',
  PUT: '#fa8c16',
  PATCH: '#fa8c16',
  DELETE: '#ff4d4f',
};

function formatDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function durationColor(ms?: number): string {
  if (ms == null) return '#d9d9d9';
  if (ms < 200) return '#52c41a';
  if (ms < 500) return '#73d13d';
  if (ms < 1000) return '#faad14';
  return '#ff4d4f';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface ApiPair {
  request: ActivityEvent;
  response?: ActivityEvent;
}

function getStatus(pair: ApiPair): StatusFilter {
  if (!pair.response) return 'pending';
  return pair.response.type === 'api-error' ? 'error' : 'success';
}

export const NetworkPanel: React.FC = () => {
  const log = useActivityLog();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pairs = useMemo((): ApiPair[] => {
    const requests = log.filter(e => e.type === 'api-request');
    return requests.map(req => {
      const resp = log.find(e => (e.type === 'api-response' || e.type === 'api-error') && e.requestId === req.id);
      return { request: req, response: resp };
    }).reverse();
  }, [log]);

  const filtered = useMemo(() => {
    let result = pairs;
    if (methodFilter !== 'all') {
      result = result.filter(p => {
        const d = p.request.data as Record<string, unknown> | undefined;
        return d?.method === methodFilter;
      });
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => getStatus(p) === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.request.label.toLowerCase().includes(q));
    }
    return result;
  }, [pairs, methodFilter, statusFilter, search]);

  // Summary stats
  const stats = useMemo(() => {
    const total = pairs.length;
    const errors = pairs.filter(p => p.response?.type === 'api-error').length;
    const completed = pairs.filter(p => p.response?.duration != null);
    const avgDuration = completed.length > 0
      ? Math.round(completed.reduce((s, p) => s + (p.response!.duration || 0), 0) / completed.length)
      : 0;
    const pending = pairs.filter(p => !p.response).length;
    return { total, errors, avgDuration, pending };
  }, [pairs]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        padding: '10px 12px',
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <Statistic title="Total" value={stats.total} valueStyle={{ fontSize: 18 }} />
        <Statistic
          title="Errors"
          value={stats.errors}
          valueStyle={{ fontSize: 18, color: stats.errors > 0 ? '#ff4d4f' : undefined }}
          prefix={stats.errors > 0 ? <CloseCircleOutlined style={{ fontSize: 13 }} /> : undefined}
        />
        <Statistic
          title="Avg Time"
          value={stats.total > 0 ? formatDuration(stats.avgDuration) : '—'}
          valueStyle={{ fontSize: 18, color: durationColor(stats.avgDuration) }}
        />
        <Statistic
          title="Pending"
          value={stats.pending}
          valueStyle={{ fontSize: 18, color: stats.pending > 0 ? '#1677ff' : undefined }}
          prefix={stats.pending > 0 ? <LoadingOutlined style={{ fontSize: 13 }} /> : undefined}
        />
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Filter by URL..."
            size="small"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {expanded.size > 0 && (
            <Tooltip title="Collapse all">
              <Button size="small" type="text" icon={<VerticalAlignTopOutlined />} onClick={collapseAll} />
            </Tooltip>
          )}
          <Button size="small" icon={<DeleteOutlined />} onClick={clearActivityLog}>Clear</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Segmented
            size="small"
            value={methodFilter}
            onChange={val => setMethodFilter(val as MethodFilter)}
            options={['all', 'GET', 'POST', 'PUT', 'DELETE']}
          />
          <Segmented
            size="small"
            value={statusFilter}
            onChange={val => setStatusFilter(val as StatusFilter)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'OK', value: 'success' },
              { label: 'Error', value: 'error' },
              { label: 'Pending', value: 'pending' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
            {filtered.length}/{pairs.length}
          </Text>
        </div>
      </div>

      {/* Request list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {filtered.length === 0 ? (
          <Empty
            description={search || methodFilter !== 'all' || statusFilter !== 'all' ? 'No matching requests' : 'No API requests captured yet'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 32 }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(pair => {
              const reqData = pair.request.data as Record<string, unknown> | undefined;
              const method = String(reqData?.method || '?');
              const url = String(reqData?.url || '');
              const isError = pair.response?.type === 'api-error';
              const isPending = !pair.response;
              const status = pair.response?.status;
              const duration = pair.response?.duration;
              const isOpen = expanded.has(pair.request.id);

              return (
                <div
                  key={pair.request.id}
                  style={{
                    border: '1px solid',
                    borderColor: isError ? '#ffccc7' : isOpen ? '#d9d9d9' : '#f0f0f0',
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: isError ? '#fff2f0' : undefined,
                  }}
                >
                  {/* Row header */}
                  <div
                    onClick={() => toggle(pair.request.id)}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isOpen ? '#fafafa' : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {isOpen
                      ? <DownOutlined style={{ fontSize: 9, color: '#8c8c8c', flexShrink: 0 }} />
                      : <RightOutlined style={{ fontSize: 9, color: '#8c8c8c', flexShrink: 0 }} />
                    }

                    {/* Method badge */}
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      color: METHOD_COLORS[method] || '#8c8c8c',
                      width: 42,
                      flexShrink: 0,
                    }}>
                      {method}
                    </span>

                    {/* URL */}
                    <Text style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {url}
                    </Text>

                    {/* Status + Duration + Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Status indicator */}
                      {isPending ? (
                        <LoadingOutlined style={{ fontSize: 12, color: '#1677ff' }} />
                      ) : isError ? (
                        <Tag color="red" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>{status || 'ERR'}</Tag>
                      ) : (
                        <Tag color="green" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>{status}</Tag>
                      )}

                      {/* Duration with color coding */}
                      <Tooltip title={duration != null ? `${duration}ms` : 'Pending...'}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: durationColor(duration),
                          fontFamily: 'monospace',
                          minWidth: 48,
                          textAlign: 'right',
                        }}>
                          {formatDuration(duration)}
                        </span>
                      </Tooltip>

                      {/* Timing bar */}
                      {duration != null && (
                        <div style={{
                          width: 40,
                          height: 4,
                          background: '#f0f0f0',
                          borderRadius: 2,
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}>
                          <div style={{
                            width: `${Math.min(100, (duration / 2000) * 100)}%`,
                            height: '100%',
                            background: durationColor(duration),
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      )}

                      <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                        {formatTime(pair.request.timestamp)}
                      </Text>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f0f0f0' }}>
                      <Tabs
                        size="small"
                        tabBarStyle={{ paddingLeft: 12, marginBottom: 0 }}
                        items={[
                          {
                            key: 'request',
                            label: 'Request',
                            children: (
                              <div style={{ padding: '8px 12px 12px' }}>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
                                  <Text type="secondary">Method: <Text strong>{method}</Text></Text>
                                  <Text type="secondary">URL: <Text copyable style={{ fontSize: 11 }}>{url}</Text></Text>
                                </div>
                                {reqData?.payload != null && (
                                  <>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Payload</Text>
                                    <JsonViewer data={reqData.payload as Record<string, unknown>} maxHeight={200} />
                                  </>
                                )}
                                {reqData?.headers != null && (
                                  <>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, marginBottom: 4 }}>Headers</Text>
                                    <JsonViewer data={reqData.headers as Record<string, unknown>} maxHeight={150} />
                                  </>
                                )}
                                {!reqData?.payload && !reqData?.headers && (
                                  <Text type="secondary" style={{ fontSize: 12 }}>No request payload</Text>
                                )}
                              </div>
                            ),
                          },
                          {
                            key: 'response',
                            label: (
                              <span>
                                Response
                                {isError && <CloseCircleOutlined style={{ marginLeft: 4, color: '#ff4d4f', fontSize: 11 }} />}
                                {!isPending && !isError && <CheckCircleOutlined style={{ marginLeft: 4, color: '#52c41a', fontSize: 11 }} />}
                              </span>
                            ),
                            children: pair.response ? (
                              <div style={{ padding: '8px 12px 12px' }}>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11 }}>
                                  <Text type="secondary">
                                    Status: <Tag color={isError ? 'red' : 'green'} style={{ margin: 0, fontSize: 10 }}>{pair.response.status}</Tag>
                                  </Text>
                                  <Text type="secondary">
                                    Duration: <Text strong style={{ color: durationColor(duration) }}>{formatDuration(duration)}</Text>
                                  </Text>
                                </div>
                                <JsonViewer data={(pair.response.data || {}) as Record<string, unknown>} maxHeight={300} />
                              </div>
                            ) : (
                              <div style={{ padding: 16, textAlign: 'center' }}>
                                <LoadingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>Waiting for response...</Text>
                              </div>
                            ),
                          },
                        ]}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
