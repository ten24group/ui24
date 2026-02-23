import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Segmented, Button, Tooltip, Statistic, Progress, Descriptions } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  FormOutlined,
  TableOutlined,
  ClockCircleOutlined,
  VerticalAlignTopOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  FundViewOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useTraceStore, clearTraceStore, type TraceSpan, type SpanLevel } from '../../telemetry';
import { useNetworkStore } from '../store/network';
import { devtoolsNavigate } from '../store/devtools-navigation';

const { Text } = Typography;

type SpanFilter = 'all' | 'http' | 'condition' | 'form' | 'table';
type ViewMode = 'waterfall' | 'list' | 'stats';

const LEVEL_CONFIG: Record<SpanLevel, { color: string; label: string }> = {
  trace: { color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', label: 'TRACE' },
  debug: { color: '#1677ff', label: 'DEBUG' },
  info:  { color: '#52c41a', label: 'INFO' },
  warn:  { color: '#faad14', label: 'WARN' },
  error: { color: '#f5222d', label: 'ERROR' },
};

const CATEGORY_CONFIG: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  label: string;
  filter: SpanFilter;
}> = {
  'http':      { color: '#1677ff', bgColor: 'var(--ant-color-primary-bg, #e6f4ff)', borderColor: 'var(--ant-color-primary-border, #91caff)', icon: <ApiOutlined />,           label: 'HTTP',      filter: 'http' },
  'condition': { color: '#722ed1', bgColor: 'var(--ant-color-purple-1, #f9f0ff)', borderColor: '#d3adf7', icon: <BranchesOutlined />,      label: 'Condition', filter: 'condition' },
  'form':      { color: '#13c2c2', bgColor: 'var(--ant-color-cyan-1, #e6fffb)', borderColor: '#87e8de', icon: <FormOutlined />,          label: 'Form',      filter: 'form' },
  'table':     { color: '#52c41a', bgColor: 'var(--ant-color-success-bg, #f6ffed)', borderColor: 'var(--ant-color-success-border, #b7eb8f)', icon: <TableOutlined />,         label: 'Table',     filter: 'table' },
  'other':     { color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', bgColor: 'var(--ant-color-bg-layout, #fafafa)', borderColor: 'var(--ant-color-border, #d9d9d9)', icon: <ThunderboltOutlined />,   label: 'Other',     filter: 'all' },
};

function categorize(span: TraceSpan): string {
  // Use structured attributes first (reliable), then fall back to name matching
  if (span.attributes['http.method'] || span.attributes['http.url']) return 'http';

  const spanType = String(span.attributes['span.type'] || '');
  if (spanType.startsWith('http')) return 'http';
  if (spanType.startsWith('condition')) return 'condition';
  if (spanType.startsWith('form') || spanType === 'async') return 'form';
  if (spanType.startsWith('table')) return 'table';
  if (spanType.startsWith('page') || spanType.startsWith('navigation') || spanType.startsWith('section')) return 'other';

  // Name-based fallbacks for HTTP (HTTP verbs at start of name)
  const name = span.name;
  if (name.startsWith('GET ') || name.startsWith('POST ') || name.startsWith('PUT ') ||
      name.startsWith('DELETE ') || name.startsWith('PATCH ') || name.startsWith('http.')) {
    return 'http';
  }
  if (name.startsWith('condition.')) return 'condition';
  if (name.startsWith('form.')) return 'form';
  if (name.startsWith('table.')) return 'table';
  return 'other';
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function getSpanLabel(span: TraceSpan): string {
  if (span.attributes['http.url']) {
    const method = span.attributes['http.method'] || '';
    const url = String(span.attributes['http.url']);
    try {
      const parsed = new URL(url);
      return `${method} ${parsed.pathname}`;
    } catch {
      return `${method} ${url}`;
    }
  }
  return span.name;
}

const WaterfallBar: React.FC<{
  span: TraceSpan;
  minTime: number;
  maxTime: number;
}> = ({ span, minTime, maxTime }) => {
  const totalRange = maxTime - minTime || 1;
  const left = ((span.startTime - minTime) / totalRange) * 100;
  const width = (span.duration / totalRange) * 100;
  const cat = categorize(span);
  const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;

  return (
    <div style={{ position: 'relative', height: 18, background: 'var(--ant-color-bg-layout, #f5f5f5)', borderRadius: 3 }}>
      <div style={{
        position: 'absolute',
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`,
        height: '100%',
        background: cfg.color,
        borderRadius: 4,
        opacity: 0.7,
      }} />
    </div>
  );
};

export const TraceViewerPanel: React.FC<{ highlightSpanId?: string }> = ({ highlightSpanId }) => {
  const spans = useTraceStore();
  const networkEntries = useNetworkStore();
  const [viewMode, setViewMode] = useState<ViewMode>('waterfall');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SpanFilter>('all');
  const [levelFilter, setLevelFilter] = useState<SpanLevel | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build a lookup: spanId → networkId for HTTP correlation
  const spanToNetworkId = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of networkEntries) {
      if (e.spanId) map.set(e.spanId, e.id);
    }
    return map;
  }, [networkEntries]);

  // Auto-open highlighted span if provided
  React.useEffect(() => {
    if (highlightSpanId) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.add(highlightSpanId);
        return next;
      });
    }
  }, [highlightSpanId]);

  const sortedSpans = useMemo(() => [...spans].reverse(), [spans]);

  const filtered = useMemo(() => {
    let result = sortedSpans;
    if (filter !== 'all') {
      result = result.filter(s => categorize(s) === filter);
    }
    if (levelFilter !== 'all') {
      result = result.filter(s => s.level === levelFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        getSpanLabel(s).toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedSpans, filter, levelFilter, search]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    const levelCounts: Record<SpanLevel, number> = { trace: 0, debug: 0, info: 0, warn: 0, error: 0 };
    const urlDurations: Map<string, number[]> = new Map();
    let totalDuration = 0;
    let httpCount = 0;
    let errorCount = 0;

    for (const s of spans) {
      const cat = categorize(s);
      counts[cat] = (counts[cat] || 0) + 1;
      totalDuration += s.duration;
      if (cat === 'http') {
        httpCount++;
        const url = String(s.attributes['http.url'] || s.name);
        if (!urlDurations.has(url)) urlDurations.set(url, []);
        urlDurations.get(url)!.push(s.duration);
      }
      if (s.level) levelCounts[s.level]++;
      if (s.level === 'error') errorCount++;
    }

    // Calculate p95/p99 for each URL
    const urlStats = Array.from(urlDurations.entries()).map(([url, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      return { url, count: durations.length, avg, p50, p95, p99, max };
    }).sort((a, b) => b.p95 - a.p95);

    return {
      total: spans.length,
      counts,
      levelCounts,
      avgDuration: spans.length > 0 ? totalDuration / spans.length : 0,
      httpCount,
      errorCount,
      urlStats,
    };
  }, [spans]);

  const timeRange = useMemo(() => {
    if (spans.length === 0) return { min: 0, max: 0 };
    let min = Infinity, max = -Infinity;
    for (const s of spans) {
      if (s.startTime < min) min = s.startTime;
      if (s.endTime > max) max = s.endTime;
    }
    return { min, max };
  }, [spans]);

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
      {/* Header: View Selector + Actions */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          size="small"
          value={viewMode}
          onChange={val => setViewMode(val as ViewMode)}
          options={[
            { label: <span><FundViewOutlined /> Waterfall</span>, value: 'waterfall' },
            { label: <span><UnorderedListOutlined /> List</span>, value: 'list' },
            { label: <span><BarChartOutlined /> Stats</span>, value: 'stats' },
          ]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {viewMode !== 'stats' && (
            <>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
                placeholder="Filter..."
                size="small"
                allowClear
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 180 }}
              />
              {viewMode === 'list' && expanded.size > 0 && (
                <Tooltip title="Collapse all">
                  <Button size="small" type="text" icon={<VerticalAlignTopOutlined />} onClick={collapseAll} />
                </Tooltip>
              )}
            </>
          )}
          <Button size="small" icon={<DeleteOutlined />} onClick={clearTraceStore}>Clear</Button>
        </div>
      </div>

      {/* Filters */}
      {viewMode !== 'stats' && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>
              {stats.total} {viewMode === 'waterfall' ? 'spans' : 'total'}
            </Text>
            <Segmented
              size="small"
              value={filter}
              onChange={val => setFilter(val as SpanFilter)}
              options={[
                { label: `All (${stats.total})`, value: 'all' },
                { label: `HTTP (${stats.counts.http || 0})`, value: 'http' },
                { label: `Cond (${stats.counts.condition || 0})`, value: 'condition' },
                { label: `Form (${stats.counts.form || 0})`, value: 'form' },
                { label: `Table (${stats.counts.table || 0})`, value: 'table' },
              ]}
            />
            <Segmented
              size="small"
              value={levelFilter}
              onChange={val => setLevelFilter(val as SpanLevel | 'all')}
              options={[
                { label: `All`, value: 'all' },
                { label: <span style={{ color: LEVEL_CONFIG.error.color }}>ERR {stats.levelCounts.error}</span>, value: 'error' },
                { label: <span style={{ color: LEVEL_CONFIG.warn.color }}>WARN {stats.levelCounts.warn}</span>, value: 'warn' },
                { label: <span style={{ color: LEVEL_CONFIG.info.color }}>INFO {stats.levelCounts.info}</span>, value: 'info' },
                { label: <span style={{ color: LEVEL_CONFIG.debug.color }}>DBG {stats.levelCounts.debug}</span>, value: 'debug' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {filtered.length === 0 && viewMode !== 'stats' ? (
          <Empty
            description={spans.length === 0 ? 'No traces captured yet' : 'No matching spans'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 32 }}
          />
        ) : (
          <>
            {viewMode === 'waterfall' && (
              <WaterfallView
                spans={filtered}
                timeRange={timeRange}
                spanToNetworkId={spanToNetworkId}
                highlightSpanId={highlightSpanId}
              />
            )}
            {viewMode === 'list' && <ListView spans={filtered} expanded={expanded} toggle={toggle} timeRange={timeRange} />}
            {viewMode === 'stats' && <StatsView stats={stats} spans={spans} />}
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// WATERFALL VIEW (hierarchical timeline)
// ═══════════════════════════════════════════════════════════════════

interface SpanTreeNode {
  span: TraceSpan;
  children: SpanTreeNode[];
  depth: number;
}

function buildSpanTree(spans: readonly TraceSpan[]): SpanTreeNode[] {
  const spanMap = new Map<string, SpanTreeNode>();
  const roots: SpanTreeNode[] = [];

  // Create nodes
  for (const span of spans) {
    spanMap.set(span.spanId, { span, children: [], depth: 0 });
  }

  // Build tree — spans whose parent is not in the current view become roots
  for (const node of Array.from(spanMap.values())) {
    const { span } = node;
    if (span.parentSpanId) {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent is outside the current buffer/filter — treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Sort roots and children by start time (ascending) for natural reading order
  roots.sort((a, b) => a.span.startTime - b.span.startTime);

  // Assign depths and sort children
  function assignDepth(node: SpanTreeNode, depth: number) {
    node.depth = depth;
    node.children.sort((a, b) => a.span.startTime - b.span.startTime);
    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  }
  for (const root of roots) {
    assignDepth(root, 0);
  }

  // Flatten to array preserving depth-first order
  const result: SpanTreeNode[] = [];
  function traverse(node: SpanTreeNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }
  for (const root of roots) {
    traverse(root);
  }

  return result;
}

const WaterfallView: React.FC<{
  spans: readonly TraceSpan[];
  timeRange: { min: number; max: number };
  spanToNetworkId?: Map<string, string>;
  highlightSpanId?: string;
}> = ({ spans, timeRange, spanToNetworkId, highlightSpanId }) => {
  const totalRange = timeRange.max - timeRange.min || 1;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null);
  
  const tree = useMemo(() => buildSpanTree(spans), [spans]);

  // Build visibility map (which nodes to show based on collapsed state)
  const visibleNodes = useMemo(() => {
    const visible: SpanTreeNode[] = [];
    
    function traverse(node: SpanTreeNode) {
      visible.push(node);
      // If this node is collapsed, don't traverse children
      if (!collapsed.has(node.span.spanId)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    
    // Start from root nodes
    const roots = tree.filter(n => n.depth === 0);
    for (const root of roots) {
      traverse(root);
    }
    
    return visible;
  }, [tree, collapsed]);

  const toggleCollapse = (spanId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    const parentIds = new Set(tree.filter(n => n.children.length > 0).map(n => n.span.spanId));
    setCollapsed(parentIds);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Expand/Collapse All */}
      {tree.some(n => n.children.length > 0) && (
        <div style={{ padding: '4px 8px', background: 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 4, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 10 }}>Tree Controls:</Text>
          <Button type="link" size="small" onClick={expandAll} style={{ fontSize: 10, height: 20, padding: '0 6px' }}>Expand All</Button>
          <Button type="link" size="small" onClick={collapseAll} style={{ fontSize: 10, height: 20, padding: '0 6px' }}>Collapse All</Button>
          <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>
            Showing {visibleNodes.length} of {tree.length} spans
          </Text>
        </div>
      )}

      {visibleNodes.map((node) => {
        const { span, depth, children } = node;
        const cat = categorize(span);
        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
        const httpStatus = span.attributes['http.status_code'] as number | undefined;
        const isError = span.level === 'error' || (httpStatus != null && httpStatus >= 400);
        const label = getSpanLabel(span);
        const hasChildren = children.length > 0;
        const isCollapsed = collapsed.has(span.spanId);
        const isHovered = hoveredSpanId === span.spanId;

        const left = ((span.startTime - timeRange.min) / totalRange) * 100;
        const width = (span.duration / totalRange) * 100;

        return (
          <div
            key={span.spanId}
            onMouseEnter={() => setHoveredSpanId(span.spanId)}
            onMouseLeave={() => setHoveredSpanId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 6px',
              paddingLeft: `${6 + depth * 20}px`,
              borderRadius: 3,
              background: span.spanId === highlightSpanId ? 'var(--ant-color-warning-bg, #fffbe6)' : isError ? 'var(--ant-color-error-bg, #fff2f0)' : isHovered ? 'var(--ant-color-primary-bg, #f0f5ff)' : depth % 2 === 0 ? 'var(--ant-color-bg-container, #fff)' : 'var(--ant-color-bg-layout, #fafafa)',
              borderTop: `1px solid ${span.spanId === highlightSpanId ? 'var(--ant-color-warning-border, #ffe58f)' : isError ? 'var(--ant-color-error-border, #ffccc7)' : isHovered ? 'var(--ant-color-primary-border, #adc6ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
              borderRight: `1px solid ${span.spanId === highlightSpanId ? 'var(--ant-color-warning-border, #ffe58f)' : isError ? 'var(--ant-color-error-border, #ffccc7)' : isHovered ? 'var(--ant-color-primary-border, #adc6ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
              borderBottom: `1px solid ${span.spanId === highlightSpanId ? 'var(--ant-color-warning-border, #ffe58f)' : isError ? 'var(--ant-color-error-border, #ffccc7)' : isHovered ? 'var(--ant-color-primary-border, #adc6ff)' : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
              borderLeft: `3px solid ${cfg.color}`,
              position: 'relative',
              transition: 'all 0.15s',
              cursor: hasChildren ? 'pointer' : 'default',
            }}
            onClick={() => hasChildren && toggleCollapse(span.spanId)}
          >
            {/* Tree structure lines */}
            {depth > 0 && (
              <>
                {/* Vertical line from parent */}
                <div style={{
                  position: 'absolute',
                  left: `${6 + (depth - 1) * 20 + 8}px`,
                  top: -1,
                  width: 1,
                  height: 7,
                  background: '#d9d9d9',
                }} />
                {/* Horizontal connector */}
                <div style={{
                  position: 'absolute',
                  left: `${6 + (depth - 1) * 20 + 8}px`,
                  top: 6,
                  width: 12,
                  height: 1,
                  background: '#d9d9d9',
                }} />
              </>
            )}

            {/* Expand/collapse indicator */}
            {hasChildren ? (
              <div style={{
                fontSize: 9,
                width: 14,
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: cfg.color,
                fontWeight: 'bold',
                userSelect: 'none',
              }}>
                {isCollapsed ? '▶' : '▼'}
              </div>
            ) : (
              <div style={{ width: 14, flexShrink: 0 }} />
            )}

            <Tag style={{
              margin: 0, fontSize: 8, lineHeight: '12px', padding: '0 3px',
              border: `1px solid ${cfg.borderColor}`, background: cfg.bgColor,
              color: cfg.color, fontWeight: 600, minWidth: 38, textAlign: 'center',
              flexShrink: 0,
            }}>
              {cfg.label}
            </Tag>
            
            <Tag style={{
              margin: 0, fontSize: 7, lineHeight: '10px', padding: '0 2px',
              border: `1px solid ${LEVEL_CONFIG[span.level].color}33`,
              background: `${LEVEL_CONFIG[span.level].color}11`,
              color: LEVEL_CONFIG[span.level].color,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {LEVEL_CONFIG[span.level].label}
            </Tag>

            <Tooltip title={label}>
              <Text style={{
                fontSize: 10, width: 180, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: cat === 'http' ? 'monospace' : undefined,
                color: isError ? '#ff4d4f' : undefined,
                flexShrink: 0,
              }}>
                {label}
              </Text>
            </Tooltip>

            {hasChildren && (
              <Tag style={{
                margin: 0, fontSize: 7, lineHeight: '10px', padding: '0 3px',
                background: `${cfg.color}11`, border: `1px solid ${cfg.color}33`,
                color: cfg.color, flexShrink: 0,
              }}>
                {children.length}
              </Tag>
            )}

            {httpStatus != null && (
              <Tag color={httpStatus >= 400 ? 'red' : httpStatus >= 300 ? 'orange' : 'green'}
                style={{ margin: 0, fontSize: 8, lineHeight: '12px', flexShrink: 0 }}>
                {httpStatus}
              </Tag>
            )}

            <div style={{ flex: 1, minWidth: 80, position: 'relative', height: 13, background: 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 2, border: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
              <Tooltip title={`${formatTime(span.startTime)} - ${formatDuration(span.duration)}`}>
                <div style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${Math.max(width, 0.4)}%`,
                  height: '100%',
                  background: isError ? '#ff4d4f' : cfg.color,
                  borderRadius: 2,
                  opacity: isHovered ? 1 : 0.7,
                  transition: 'all 0.15s',
                  border: `1px solid ${isError ? '#cf1322' : cfg.color}`,
                  boxShadow: isHovered ? `0 0 4px ${cfg.color}66` : 'none',
                }}
                />
              </Tooltip>
            </div>

            <Text type="secondary" style={{
              fontSize: 9, fontFamily: 'monospace', width: 42, textAlign: 'right',
              color: span.duration > 1000 ? '#ff4d4f' : span.duration > 300 ? '#fa8c16' : 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
              fontWeight: span.duration > 500 ? 600 : 400,
              flexShrink: 0,
            }}>
              {formatDuration(span.duration)}
            </Text>

            {/* Network correlation link */}
            {spanToNetworkId?.has(span.spanId) && (
              <Tooltip title="View in Network">
                <Button
                  size="small"
                  type="text"
                  icon={<ApiOutlined />}
                  style={{ padding: 0, fontSize: 11, height: 16, width: 16, flexShrink: 0, color: '#1677ff' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    devtoolsNavigate('debug', 'network', { networkId: spanToNetworkId.get(span.spanId) });
                  }}
                />
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// LIST VIEW (existing detail view)
// ═══════════════════════════════════════════════════════════════════

const ListView: React.FC<{
  spans: readonly TraceSpan[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  timeRange: { min: number; max: number };
}> = ({ spans, expanded, toggle, timeRange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {spans.map(span => {
        const cat = categorize(span);
        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
        const isOpen = expanded.has(span.spanId);
        const label = getSpanLabel(span);
        const httpStatus = span.attributes['http.status_code'] as number | undefined;
        const isError = span.status.code === 2 || (httpStatus != null && httpStatus >= 400);

        return (
          <div
            key={span.spanId}
            style={{
              borderRadius: 6,
              border: `1px solid ${isOpen ? cfg.borderColor : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => toggle(span.spanId)}
              style={{
                padding: '5px 10px',
                cursor: 'pointer',
                background: isOpen ? cfg.bgColor : 'var(--ant-color-bg-container, #fff)',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag style={{
                  margin: 0, fontSize: 10, lineHeight: '16px',
                  border: `1px solid ${cfg.borderColor}`, background: cfg.bgColor,
                  color: cfg.color, fontWeight: 600, flexShrink: 0, minWidth: 58, textAlign: 'center',
                }}>
                  {cfg.label}
                </Tag>
                <Tag style={{
                  margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px',
                  border: `1px solid ${LEVEL_CONFIG[span.level].color}33`,
                  background: `${LEVEL_CONFIG[span.level].color}11`,
                  color: LEVEL_CONFIG[span.level].color,
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {LEVEL_CONFIG[span.level].label}
                </Tag>
                <Text style={{
                  fontSize: 12, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: cat === 'http' ? 'monospace' : undefined,
                  color: isError ? '#ff4d4f' : undefined,
                }}>
                  {label}
                </Text>
                {httpStatus != null && (
                  <Tag color={httpStatus >= 400 ? 'red' : httpStatus >= 300 ? 'orange' : 'green'}
                    style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
                    {httpStatus}
                  </Tag>
                )}
                <Text type="secondary" style={{
                  fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
                  color: span.duration > 1000 ? '#ff4d4f' : span.duration > 300 ? '#fa8c16' : 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
                }}>
                  {formatDuration(span.duration)}
                </Text>
                <Tooltip title={formatTime(span.startTime)}>
                  <ClockCircleOutlined style={{ fontSize: 10, color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))', flexShrink: 0 }} />
                </Tooltip>
              </div>

              <div style={{ marginTop: 4, paddingLeft: 66 }}>
                <WaterfallBar span={span} minTime={timeRange.min} maxTime={timeRange.max} />
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${cfg.borderColor}` }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10 }}>Trace ID</Text>
                    <div><Text code style={{ fontSize: 10 }}>{span.traceId.slice(0, 16)}...</Text></div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10 }}>Span ID</Text>
                    <div><Text code style={{ fontSize: 10 }}>{span.spanId}</Text></div>
                  </div>
                  {span.parentSpanId && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 10 }}>Parent ID</Text>
                      <div><Text code style={{ fontSize: 10 }}>{span.parentSpanId}</Text></div>
                    </div>
                  )}
                  <div>
                    <Text type="secondary" style={{ fontSize: 10 }}>Start</Text>
                    <div><Text code style={{ fontSize: 10 }}>{formatTime(span.startTime)}</Text></div>
                  </div>
                </div>

                {Object.keys(span.attributes).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Descriptions
                      size="small"
                      column={2}
                      bordered
                      labelStyle={{ fontSize: 11, padding: '4px 8px', background: 'var(--ant-color-bg-layout, #fafafa)', width: 180 }}
                      contentStyle={{ fontSize: 11, padding: '4px 8px', fontFamily: 'monospace', wordBreak: 'break-all' }}
                    >
                      {Object.entries(span.attributes).map(([key, value]) => (
                        <Descriptions.Item key={key} label={key}>
                          {typeof value === 'string' && value.length > 100 ? (
                            <Tooltip title={value}>
                              <span>{value.substring(0, 100)}...</span>
                            </Tooltip>
                          ) : (
                            String(value)
                          )}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  </div>
                )}

                {span.events.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>Events</Text>
                    <JsonViewer data={span.events} maxHeight={200} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STATS VIEW (aggregated metrics)
// ═══════════════════════════════════════════════════════════════════

const StatsView: React.FC<{ stats: any; spans: readonly TraceSpan[] }> = ({ stats, spans }) => {
  if (spans.length === 0) {
    return <Empty description="No traces to analyze" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 32 }} />;
  }

  const errorRate = stats.total > 0 ? (stats.errorCount / stats.total) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview Metrics */}
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Overview</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ padding: 12, background: 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>Total Spans</Text>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{stats.total}</div>
          </div>
          <div style={{ padding: 12, background: 'var(--ant-color-primary-bg, #e6f4ff)', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>HTTP Requests</Text>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff', marginTop: 4 }}>{stats.httpCount}</div>
          </div>
          <div style={{ padding: 12, background: stats.errorCount > 0 ? 'var(--ant-color-error-bg, #fff2f0)' : 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>Error Rate</Text>
            <div style={{ fontSize: 20, fontWeight: 600, color: stats.errorCount > 0 ? 'var(--ant-color-error, #f5222d)' : 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', marginTop: 4 }}>
              {errorRate.toFixed(1)}%
            </div>
          </div>
          <div style={{ padding: 12, background: 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>Avg Duration</Text>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{formatDuration(stats.avgDuration)}</div>
          </div>
        </div>
      </div>

      {/* Slowest Endpoints */}
      {stats.urlStats && stats.urlStats.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Slowest Endpoints (by p95)</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.urlStats.slice(0, 10).map((urlStat: any, i: number) => {
              const url = new URL(urlStat.url, 'http://localhost').pathname;
              const p95Pct = (urlStat.p95 / stats.urlStats[0].p95) * 100;

              return (
                <div key={i} style={{
                  padding: '6px 10px',
                  background: 'var(--ant-color-bg-container, #fff)',
                  border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                  borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 11, flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {url}
                    </Text>
                    <Tag style={{ margin: 0, fontSize: 9 }}>
                      {urlStat.count} calls
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                    <span>Avg: <Text code style={{ fontSize: 9 }}>{formatDuration(urlStat.avg)}</Text></span>
                    <span>p50: <Text code style={{ fontSize: 9 }}>{formatDuration(urlStat.p50)}</Text></span>
                    <span>p95: <Text code style={{ fontSize: 9, color: '#fa8c16' }}>{formatDuration(urlStat.p95)}</Text></span>
                    <span>p99: <Text code style={{ fontSize: 9, color: '#ff4d4f' }}>{formatDuration(urlStat.p99)}</Text></span>
                    <span>max: <Text code style={{ fontSize: 9, color: '#f5222d' }}>{formatDuration(urlStat.max)}</Text></span>
                  </div>
                  <Progress
                    percent={p95Pct}
                    size="small"
                    showInfo={false}
                    strokeColor={p95Pct > 80 ? '#ff4d4f' : p95Pct > 50 ? '#fa8c16' : '#52c41a'}
                    style={{ marginTop: 4 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Level Distribution */}
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Span Levels</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {(Object.entries(stats.levelCounts) as [SpanLevel, number][]).map(([level, count]) => (
            <div key={level} style={{
              padding: 8,
              background: `${LEVEL_CONFIG[level].color}11`,
              border: `1px solid ${LEVEL_CONFIG[level].color}33`,
              borderRadius: 4,
              textAlign: 'center',
            }}>
              <Text type="secondary" style={{ fontSize: 10 }}>{LEVEL_CONFIG[level].label}</Text>
              <div style={{ fontSize: 18, fontWeight: 600, color: LEVEL_CONFIG[level].color, marginTop: 2 }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Distribution */}
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>By Category</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(stats.counts).map(([cat, count]) => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
            return (
              <div key={cat} style={{
                padding: '8px 12px',
                background: cfg.bgColor,
                border: `1px solid ${cfg.borderColor}`,
                borderRadius: 4,
                minWidth: 100,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {cfg.icon}
                  <Text style={{ fontSize: 11, fontWeight: 600 }}>{cfg.label}</Text>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: cfg.color }}>{String(count)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
