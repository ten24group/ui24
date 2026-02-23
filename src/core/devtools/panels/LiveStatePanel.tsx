import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Segmented, Button, Tooltip, Slider } from 'antd';
import {
  FormOutlined,
  TableOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SearchOutlined,
  RightOutlined,
  DownOutlined,
  ExpandOutlined,
  ShrinkOutlined,
  DiffOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useDevToolsStore, BridgeEntry, BridgeEntryType, getEntryHistory } from '../store/snapshot';
import { jsonDiff, formatValue, type DiffEntry } from '../utils/jsonDiff';

const { Text } = Typography;

type TypeFilter = 'all' | BridgeEntryType;

const TYPE_CONFIG: Record<BridgeEntryType, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode; label: string }> = {
  page:     { color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',  bgColor: 'var(--ant-color-bg-layout, #fafafa)',      borderColor: 'var(--ant-color-border, #d9d9d9)',              icon: <AppstoreOutlined />,  label: 'Page' },
  form:     { color: '#1677ff',  bgColor: 'var(--ant-color-primary-bg, #e6f4ff)',   borderColor: 'var(--ant-color-primary-border, #91caff)',    icon: <FormOutlined />,      label: 'Form' },
  table:    { color: '#52c41a',  bgColor: 'var(--ant-color-success-bg, #f6ffed)',   borderColor: 'var(--ant-color-success-border, #b7eb8f)',    icon: <TableOutlined />,     label: 'Table' },
  detail:   { color: '#722ed1',  bgColor: 'var(--ant-color-purple-1, #f9f0ff)',     borderColor: '#d3adf7',                                     icon: <FileTextOutlined />,  label: 'Detail' },
  pageData: { color: '#fa8c16',  bgColor: 'var(--ant-color-warning-bg, #fff7e6)',   borderColor: 'var(--ant-color-warning-border, #ffd591)',    icon: <DatabaseOutlined />,  label: 'Data' },
};

function getSummary(entry: BridgeEntry): string {
  const d = entry.data as Record<string, unknown> | null;
  if (!d) return '';

  switch (entry.type) {
    case 'page': {
      const parts: string[] = [];
      if (d.pageType) parts.push(String(d.pageType));
      if (d.entityName) parts.push(String(d.entityName));
      if (d.route && typeof d.route === 'object' && (d.route as Record<string, unknown>).pathname) {
        parts.push(String((d.route as Record<string, unknown>).pathname));
      }
      return parts.join(' · ');
    }
    case 'form': {
      const fields = d.formValues ? Object.keys(d.formValues as object).length : 0;
      const parts = [`${fields} fields`];
      if (d.isDirty) parts.push('dirty');
      if (d.isValid === false) parts.push('invalid');
      return parts.join(' · ');
    }
    case 'table': {
      const sel = Array.isArray(d.selectedRecords) ? d.selectedRecords.length : 0;
      const filterCount = d.filters ? Object.keys(d.filters as object).length : 0;
      const parts: string[] = [];
      if (sel > 0) parts.push(`${sel} selected`);
      if (filterCount > 0) parts.push(`${filterCount} filters`);
      if (d.searchQuery) parts.push(`search: "${d.searchQuery}"`);
      return parts.join(' · ') || 'no selection';
    }
    case 'detail': {
      if (d.isLoading) return 'loading...';
      return d.record != null ? 'record loaded' : 'no record';
    }
    case 'pageData': {
      const parts: string[] = [];
      if (d.pageType) parts.push(String(d.pageType));
      if (d.entityName) parts.push(String(d.entityName));
      if (d.modalDepth && Number(d.modalDepth) > 0) parts.push(`modal:${d.modalDepth}`);
      return parts.join(' · ');
    }
    default:
      return '';
  }
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

const DIFF_TYPE_STYLE: Record<DiffEntry['type'], { color: string; bg: string; icon: React.ReactNode }> = {
  added: { color: '#52c41a', bg: '#f6ffed', icon: <PlusCircleOutlined /> },
  removed: { color: '#ff4d4f', bg: '#fff2f0', icon: <MinusCircleOutlined /> },
  changed: { color: '#fa8c16', bg: '#fff7e6', icon: <EditOutlined /> },
};

const DiffView: React.FC<{ entryId: string; currentData: unknown }> = ({ entryId, currentData }) => {
  const history = getEntryHistory(entryId);
  if (history.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>No previous state to diff against</Text>;
  }

  const previous = history[history.length - 1];
  const diffs = jsonDiff(previous.data, currentData);

  if (diffs.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>No changes since last update</Text>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>
        {diffs.length} change{diffs.length > 1 ? 's' : ''} since {timeAgo(previous.timestamp)}
      </Text>
      {diffs.slice(0, 50).map((diff, i) => {
        const style = DIFF_TYPE_STYLE[diff.type];
        return (
          <div key={i} style={{
            padding: '3px 8px',
            borderRadius: 4,
            background: style.bg,
            border: `1px solid ${style.color}20`,
            fontSize: 11,
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}>
            <span style={{ color: style.color, flexShrink: 0 }}>{style.icon}</span>
            <span style={{ color: 'var(--ant-color-text, rgba(0, 0, 0, 0.88))', fontWeight: 500, flexShrink: 0 }}>{diff.path}</span>
            {diff.type === 'changed' && (
              <span style={{ color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{formatValue(diff.oldValue)}</span>
                {' → '}
                <span style={{ color: '#52c41a' }}>{formatValue(diff.newValue)}</span>
              </span>
            )}
            {diff.type === 'added' && (
              <span style={{ color: '#52c41a' }}>{formatValue(diff.newValue)}</span>
            )}
            {diff.type === 'removed' && (
              <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{formatValue(diff.oldValue)}</span>
            )}
          </div>
        );
      })}
      {diffs.length > 50 && (
        <Text type="secondary" style={{ fontSize: 10 }}>...and {diffs.length - 50} more changes</Text>
      )}
    </div>
  );
};

function formatAbsoluteTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

const ExpandedEntry: React.FC<{
  entry: BridgeEntry;
  showDiffs: boolean;
  cfg: typeof TYPE_CONFIG[BridgeEntryType];
}> = ({ entry, showDiffs, cfg }) => {
  const history = getEntryHistory(entry.id);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // The "current" snapshot is always the latest. history[history.length - 1] is the PREVIOUS snapshot.
  // scrubIndex: null = current, 0 = oldest history, history.length-1 = most recent history
  const displayData = scrubIndex === null ? entry.data : history[scrubIndex]?.data ?? entry.data;
  const displayTs = scrubIndex === null ? entry.timestamp : history[scrubIndex]?.timestamp ?? entry.timestamp;
  const isScrubbing = scrubIndex !== null;
  const totalSnapshots = history.length + 1; // history + current

  return (
    <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${cfg.borderColor}` }}>
      {/* History scrubber (only if there is history) */}
      {history.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}>
              History: {totalSnapshots} snapshot{totalSnapshots > 1 ? 's' : ''}
            </span>
            {isScrubbing && (
              <Tag
                color="orange"
                style={{ fontSize: 10, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setScrubIndex(null)}
              >
                #{scrubIndex! + 1} of {history.length} — {formatAbsoluteTime(displayTs as number)} · click to return to live
              </Tag>
            )}
            {!isScrubbing && (
              <Tag color="green" style={{ fontSize: 10 }}>
                Live · {formatAbsoluteTime(displayTs as number)}
              </Tag>
            )}
          </div>
          <Slider
            min={0}
            max={history.length}
            value={scrubIndex ?? history.length}
            onChange={(v: number) => setScrubIndex(v === history.length ? null : v)}
            tooltip={{
              formatter: (v) => {
                if (v === history.length) return 'Current (live)';
                const snap = history[v as number];
                return snap ? formatAbsoluteTime(snap.timestamp) : String(v);
              },
            }}
            marks={{
              0: <span style={{ fontSize: 9 }}>Oldest</span>,
              [history.length]: <span style={{ fontSize: 9 }}>Live</span>,
            }}
            style={{ margin: '4px 8px' }}
          />
        </div>
      )}

      {showDiffs && scrubIndex === null ? (
        <DiffView entryId={entry.id} currentData={entry.data} />
      ) : (
        <JsonViewer
          data={displayData as Record<string, unknown>}
          maxHeight={400}
        />
      )}
    </div>
  );
};

export const LiveStatePanel: React.FC = () => {
  const store = useDevToolsStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDiffs, setShowDiffs] = useState(false);

  const entries = useMemo(() => {
    const arr = Array.from(store.values());
    arr.sort((a, b) => {
      const typeOrder: BridgeEntryType[] = ['page', 'pageData', 'form', 'table', 'detail'];
      const ai = typeOrder.indexOf(a.type);
      const bi = typeOrder.indexOf(b.type);
      if (ai !== bi) return ai - bi;
      return a.timestamp - b.timestamp;
    });
    return arr;
  }, [store]);

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== 'all') {
      result = result.filter(e => e.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.label.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        getSummary(e).toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<BridgeEntryType, number>> = {};
    for (const e of entries) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(filtered.map(e => e.id)));
  }, [filtered]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  if (entries.length === 0 && !search) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Empty description="No active components reporting state" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Navigate to a page to see live state from forms, tables, details, and modals.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
            placeholder="Filter components..."
            size="small"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <Tooltip title={showDiffs ? 'Hide diffs' : 'Show state diffs'}>
            <Button
              size="small"
              type={showDiffs ? 'primary' : 'text'}
              icon={<DiffOutlined />}
              onClick={() => setShowDiffs(!showDiffs)}
            />
          </Tooltip>
          <Tooltip title="Expand all">
            <Button size="small" type="text" icon={<ExpandOutlined />} onClick={expandAll} disabled={filtered.length === 0} />
          </Tooltip>
          <Tooltip title="Collapse all">
            <Button size="small" type="text" icon={<ShrinkOutlined />} onClick={collapseAll} disabled={expanded.size === 0} />
          </Tooltip>
        </div>
        <Segmented
          size="small"
          value={typeFilter}
          onChange={val => setTypeFilter(val as TypeFilter)}
          options={[
            { label: `All (${entries.length})`, value: 'all' },
            ...(Object.entries(TYPE_CONFIG) as [BridgeEntryType, typeof TYPE_CONFIG[BridgeEntryType]][])
              .filter(([type]) => (typeCounts[type] || 0) > 0)
              .map(([type, cfg]) => ({
                label: `${cfg.label} (${typeCounts[type] || 0})`,
                value: type,
              })),
          ]}
        />
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {filtered.length === 0 ? (
          <Empty description={search ? `No matches for "${search}"` : 'No entries'} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(entry => {
              const cfg = TYPE_CONFIG[entry.type];
              const isOpen = expanded.has(entry.id);
              const summary = getSummary(entry);

              return (
                <div
                  key={entry.id}
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${isOpen ? cfg.borderColor : '#f0f0f0'}`,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => toggle(entry.id)}
                    style={{
                      padding: '7px 10px',
                      cursor: 'pointer',
                      background: isOpen ? cfg.bgColor : 'transparent',
                      userSelect: 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Line 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isOpen
                        ? <DownOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', flexShrink: 0 }} />
                        : <RightOutlined style={{ fontSize: 9, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', flexShrink: 0 }} />
                      }
                      <Tag
                        icon={cfg.icon}
                        style={{
                          margin: 0,
                          flexShrink: 0,
                          fontSize: 11,
                          border: `1px solid ${cfg.borderColor}`,
                          background: cfg.bgColor,
                          color: cfg.color,
                        }}
                      >
                        {cfg.label}
                      </Tag>
                      <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.label}
                      </Text>
                      {entry.modalDepth != null && entry.modalDepth > 0 && (
                        <Tag color="volcano" style={{ margin: 0, flexShrink: 0, fontSize: 10 }}>
                          modal:{entry.modalDepth}
                        </Tag>
                      )}
                    </div>
                    {/* Line 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, paddingLeft: 21 }}>
                      <Text type="secondary" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {summary}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                        {timeAgo(entry.timestamp)}
                      </Text>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <ExpandedEntry entry={entry} showDiffs={showDiffs} cfg={cfg} />
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
