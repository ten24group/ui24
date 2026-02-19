import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Segmented, Button, Tooltip } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  ApiOutlined,
  CompassOutlined,
  FormOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useActivityLog, clearActivityLog, ActivityEvent, ActivityEventType } from '../devtoolsBridge';

const { Text } = Typography;

type FilterType = 'all' | 'api' | 'navigation' | 'form' | 'error';

const TYPE_CONFIG: Record<ActivityEventType, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  group: FilterType;
}> = {
  'api-request':  { icon: <ApiOutlined />,           color: '#1677ff', bgColor: '#e6f4ff', borderColor: '#91caff', label: 'Request',  group: 'api' },
  'api-response': { icon: <CheckCircleOutlined />,   color: '#52c41a', bgColor: '#f6ffed', borderColor: '#b7eb8f', label: 'Response', group: 'api' },
  'api-error':    { icon: <CloseCircleOutlined />,   color: '#ff4d4f', bgColor: '#fff2f0', borderColor: '#ffccc7', label: 'API Error',group: 'api' },
  'navigation':   { icon: <CompassOutlined />,       color: '#722ed1', bgColor: '#f9f0ff', borderColor: '#d3adf7', label: 'Navigate', group: 'navigation' },
  'form-submit':  { icon: <FormOutlined />,          color: '#13c2c2', bgColor: '#e6fffb', borderColor: '#87e8de', label: 'Form',     group: 'form' },
  'error':        { icon: <CloseCircleOutlined />,   color: '#ff4d4f', bgColor: '#fff2f0', borderColor: '#ffccc7', label: 'Error',    group: 'error' },
  'warning':      { icon: <WarningOutlined />,       color: '#faad14', bgColor: '#fffbe6', borderColor: '#ffe58f', label: 'Warning',  group: 'error' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const base = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${base}.${ms}`;
}

function relativeTime(ts: number, baseTs: number): string {
  const diff = ts - baseTs;
  if (diff < 1000) return `+${diff}ms`;
  if (diff < 60_000) return `+${(diff / 1000).toFixed(1)}s`;
  return `+${(diff / 60_000).toFixed(1)}m`;
}

export const TimelinePanel: React.FC = () => {
  const log = useActivityLog();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const events = useMemo(() => {
    let result = [...log].reverse();
    if (filter !== 'all') {
      result = result.filter(e => TYPE_CONFIG[e.type]?.group === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.label.toLowerCase().includes(q));
    }
    return result;
  }, [log, filter, search]);

  const baseTimestamp = useMemo(() => {
    return log.length > 0 ? log[0].timestamp : Date.now();
  }, [log]);

  const typeCounts = useMemo(() => {
    const counts: Record<FilterType, number> = { all: log.length, api: 0, navigation: 0, form: 0, error: 0 };
    for (const e of log) {
      const group = TYPE_CONFIG[e.type]?.group;
      if (group) counts[group]++;
    }
    return counts;
  }, [log]);

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
      {/* Filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Filter events..."
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
            value={filter}
            onChange={val => setFilter(val as FilterType)}
            options={[
              { label: `All (${typeCounts.all})`, value: 'all' },
              { label: `API (${typeCounts.api})`, value: 'api' },
              { label: `Nav (${typeCounts.navigation})`, value: 'navigation' },
              { label: `Form (${typeCounts.form})`, value: 'form' },
              { label: `Error (${typeCounts.error})`, value: 'error' },
            ]}
          />
        </div>
      </div>

      {/* Event timeline */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px 12px' }}>
        {events.length === 0 ? (
          <Empty
            description={search ? 'No matching events' : 'No events captured yet'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 32 }}
          />
        ) : (
          <div style={{ position: 'relative', paddingLeft: 32 }}>
            {/* Vertical connector line */}
            <div style={{
              position: 'absolute',
              left: 11,
              top: 12,
              bottom: 12,
              width: 2,
              background: 'linear-gradient(to bottom, #d9d9d9, #f0f0f0)',
              borderRadius: 1,
            }} />

            {events.map((event, idx) => {
              const cfg = TYPE_CONFIG[event.type] || { icon: null, color: '#8c8c8c', bgColor: '#fafafa', borderColor: '#f0f0f0', label: event.type };
              const isOpen = expanded.has(event.id);
              const hasData = event.data != null;

              return (
                <div
                  key={event.id}
                  style={{
                    position: 'relative',
                    marginBottom: 4,
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: -27,
                    top: 8,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: cfg.bgColor,
                    border: `2px solid ${cfg.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}>
                    <span style={{ fontSize: 8, color: cfg.color, lineHeight: 1 }}>
                      {cfg.icon}
                    </span>
                  </div>

                  {/* Event card */}
                  <div style={{
                    borderRadius: 6,
                    border: `1px solid ${isOpen ? cfg.borderColor : '#f0f0f0'}`,
                    overflow: 'hidden',
                    background: isOpen ? cfg.bgColor : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <div
                      onClick={() => hasData ? toggle(event.id) : undefined}
                      style={{
                        padding: '6px 10px',
                        cursor: hasData ? 'pointer' : 'default',
                        userSelect: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {/* Type label */}
                      <Tag
                        style={{
                          margin: 0,
                          fontSize: 10,
                          lineHeight: '16px',
                          border: `1px solid ${cfg.borderColor}`,
                          background: cfg.bgColor,
                          color: cfg.color,
                          fontWeight: 600,
                          flexShrink: 0,
                          minWidth: 60,
                          textAlign: 'center',
                        }}
                      >
                        {cfg.label}
                      </Tag>

                      {/* Event label */}
                      <Text style={{
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                        fontFamily: event.type.startsWith('api') || event.type === 'navigation' ? 'monospace' : undefined,
                      }}>
                        {event.label}
                      </Text>

                      {/* Status + Duration + Time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {event.status != null && (
                          <Tag
                            color={event.status >= 400 ? 'red' : 'green'}
                            style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}
                          >
                            {event.status}
                          </Tag>
                        )}
                        {event.duration != null && (
                          <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                            {event.duration < 1000 ? `${event.duration}ms` : `${(event.duration / 1000).toFixed(1)}s`}
                          </Text>
                        )}
                        <Tooltip title={formatTime(event.timestamp)}>
                          <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace', color: '#bfbfbf' }}>
                            {relativeTime(event.timestamp, baseTimestamp)}
                          </Text>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && hasData && (
                      <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${cfg.borderColor}` }}>
                        <JsonViewer data={event.data as Record<string, unknown>} maxHeight={300} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
