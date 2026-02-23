/**
 * Error Panel — displays captured console.error, console.warn, window.onerror,
 * and unhandledrejection events with deduplication, filtering and stack traces.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Button, Collapse } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useErrorStore, clearErrors, type ErrorEntry, type ErrorSeverity } from '../store/errors';
import { mono12, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

type SeverityFilter = 'all' | ErrorSeverity;

const SEVERITY_CONFIG: Record<ErrorSeverity, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  error: { color: '#cf1322', bg: '#fff2f0', border: '#ffccc7', icon: <CloseCircleOutlined />, label: 'Error' },
  warn:  { color: '#d46b08', bg: '#fff7e6', border: '#ffd591', icon: <WarningOutlined />,      label: 'Warning' },
};

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

function formatStack(stack: string): string {
  return stack
    .split('\n')
    .filter(line => !line.includes('node_modules'))
    .slice(0, 10)
    .join('\n');
}

const ErrorRow: React.FC<{ entry: ErrorEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[entry.severity];

  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        overflow: 'hidden',
        marginBottom: 4,
      }}
    >
      <div
        onClick={() => entry.stack ? setExpanded(v => !v) : undefined}
        style={{
          padding: '6px 10px',
          cursor: entry.stack ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          userSelect: 'none',
        }}
      >
        {entry.stack
          ? (expanded
              ? <DownOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', marginTop: 3, flexShrink: 0 }} />
              : <RightOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', marginTop: 3, flexShrink: 0 }} />)
          : <span style={{ width: 9, flexShrink: 0 }} />
        }
        <span style={{ color: cfg.color, flexShrink: 0, fontSize: 13 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {entry.count > 1 && (
              <Tag
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: '16px',
                  padding: '0 5px',
                  background: cfg.color,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                }}
              >
                ×{entry.count}
              </Tag>
            )}
            <Text
              style={{
                fontSize: 12,
                color: cfg.color,
                wordBreak: 'break-word',
                lineHeight: '1.4',
              }}
            >
              {entry.message}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {entry.source && (
              <Text type="secondary" style={{ ...mono12, fontSize: 10 }}>{entry.source}</Text>
            )}
            <Text type="secondary" style={{ fontSize: 10 }}>{timeAgo(entry.timestamp)}</Text>
          </div>
        </div>
      </div>

      {expanded && entry.stack && (
        <div style={{ padding: '4px 12px 10px', borderTop: `1px solid ${cfg.border}` }}>
          <Text style={{ ...mono12, fontSize: 10, whiteSpace: 'pre-wrap', color: 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))', display: 'block' }}>
            {formatStack(entry.stack)}
          </Text>
        </div>
      )}
    </div>
  );
};

export const ErrorPanel: React.FC = () => {
  const entries = useErrorStore();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const filtered = useMemo(() => {
    let result = [...entries].reverse();
    if (severityFilter !== 'all') {
      result = result.filter(e => e.severity === severityFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.message.toLowerCase().includes(q) ||
        (e.source?.toLowerCase().includes(q)) ||
        (e.stack?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, search, severityFilter]);

  const counts = useMemo(() => ({
    errors:   entries.filter(e => e.severity === 'error').length,
    warnings: entries.filter(e => e.severity === 'warn').length,
  }), [entries]);

  if (entries.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Empty description="No errors captured" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          console.error, console.warn, unhandled rejections and window.onerror will appear here.
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
        gap: 12,
        alignItems: 'center',
        fontSize: 12,
      }}>
        {counts.errors > 0 && (
          <Text style={{ color: '#cf1322', fontSize: 12 }}>
            <CloseCircleOutlined style={{ marginRight: 4 }} />{counts.errors} error{counts.errors > 1 ? 's' : ''}
          </Text>
        )}
        {counts.warnings > 0 && (
          <Text style={{ color: '#d46b08', fontSize: 12 }}>
            <WarningOutlined style={{ marginRight: 4 }} />{counts.warnings} warning{counts.warnings > 1 ? 's' : ''}
          </Text>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button
            size="small"
            type="text"
            icon={<DeleteOutlined />}
            onClick={clearErrors}
            style={{ fontSize: 12 }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        padding: '6px 12px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
          placeholder="Search errors..."
          size="small"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        {(['all', 'error', 'warn'] as SeverityFilter[]).map(s => (
          <Tag
            key={s}
            color={
              s === 'all' ? (severityFilter === 'all' ? 'default' : undefined) :
              s === 'error' ? (severityFilter === 'error' ? 'error' : undefined) :
              (severityFilter === 'warn' ? 'orange' : undefined)
            }
            onClick={() => setSeverityFilter(s)}
            style={{
              cursor: 'pointer',
              fontSize: 11,
              margin: 0,
              opacity: severityFilter === s ? 1 : 0.55,
              userSelect: 'none',
            }}
          >
            {s === 'all' ? 'All' : s === 'error' ? 'Errors' : 'Warnings'}
          </Tag>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {filtered.length === 0 ? (
          <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
        ) : (
          filtered.map(entry => <ErrorRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
};

export { useErrorCount } from '../store/errors';
