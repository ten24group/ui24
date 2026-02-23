import React, { useMemo, useState } from 'react';
import { Typography, Tag, Empty, Button, Segmented, Progress, Tooltip } from 'antd';
import {
  DeleteOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  BranchesOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useTraceStore, clearTraceStore, type TraceSpan } from '../../telemetry';

const { Text } = Typography;

type PerfView = 'slowest' | 'api' | 'conditions';

// ── Helpers ────────────────────────────────────────────────────

function pct(vals: number[], p: number): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

function avg(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmt(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function categorize(span: TraceSpan): 'http' | 'condition' | 'other' {
  if (span.attributes['http.method'] || span.attributes['http.url']) return 'http';
  const spanType = String(span.attributes['span.type'] || '');
  if (spanType.startsWith('http')) return 'http';
  if (spanType.startsWith('condition') || span.name.startsWith('condition.')) return 'condition';
  return 'other';
}

function getHttpKey(span: TraceSpan): string {
  if (span.attributes['http.url']) {
    try {
      const url = new URL(String(span.attributes['http.url']), 'http://localhost');
      return `${span.attributes['http.method'] || 'GET'} ${url.pathname}`;
    } catch { /* ignore */ }
  }
  return span.name;
}

// ── Duration bar (relative to max) ────────────────────────────

const DurationBar: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = '#1677ff' }) => {
  const pct = max > 0 ? Math.max(1, (value / max) * 100) : 0;
  return (
    <div style={{ position: 'relative', background: 'var(--ant-color-bg-layout, #f0f0f0)', borderRadius: 3, height: 6, width: '100%' }}>
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: 3,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
};

// ── Slowest Spans view ─────────────────────────────────────────

interface SpanAgg {
  name: string;
  type: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  lastLevel: string;
}

const SlowestView: React.FC<{ spans: readonly TraceSpan[] }> = ({ spans }) => {
  const aggs = useMemo((): SpanAgg[] => {
    const map = new Map<string, { durations: number[]; type: string; lastLevel: string }>();
    for (const span of spans) {
      const key = `${span.name}::${categorize(span)}`;
      if (!map.has(key)) map.set(key, { durations: [], type: categorize(span), lastLevel: span.level || 'info' });
      const entry = map.get(key)!;
      entry.durations.push(span.duration);
      entry.lastLevel = span.level || entry.lastLevel;
    }
    return Array.from(map.entries())
      .map(([key, { durations, type, lastLevel }]) => ({
        name: key.split('::')[0],
        type,
        count: durations.length,
        avgMs: avg(durations),
        p95Ms: pct(durations, 0.95),
        maxMs: Math.max(...durations),
        lastLevel,
      }))
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, 15);
  }, [spans]);

  if (aggs.length === 0) {
    return <Empty description="No spans yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />;
  }

  const maxP95 = Math.max(...aggs.map(a => a.p95Ms), 1);
  const typeColors: Record<string, string> = { http: '#1677ff', condition: '#722ed1', other: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' };

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', padding: '2px 0 4px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', marginBottom: 2 }}>
        <span style={{ flex: 1 }}>Span name</span>
        <span style={{ width: 36, textAlign: 'right' }}>count</span>
        <span style={{ width: 52, textAlign: 'right' }}>avg</span>
        <span style={{ width: 52, textAlign: 'right' }}>p95</span>
        <span style={{ width: 52, textAlign: 'right' }}>max</span>
      </div>
      {aggs.map(a => (
        <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text
              style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={a.name}
            >
              {a.name}
            </Text>
            <Tag color={typeColors[a.type] || 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))'} style={{ fontSize: 9, margin: 0, padding: '0 3px', lineHeight: '14px', flexShrink: 0 }}>
              {a.type}
            </Tag>
            <Text style={{ fontSize: 10, fontFamily: 'monospace', width: 36, textAlign: 'right', flexShrink: 0, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}>
              ×{a.count}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'monospace', width: 52, textAlign: 'right', flexShrink: 0, color: 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))' }}>
              {fmt(a.avgMs)}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'monospace', width: 52, textAlign: 'right', flexShrink: 0, color: '#1677ff' }}>
              {fmt(a.p95Ms)}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'monospace', width: 52, textAlign: 'right', flexShrink: 0, color: a.maxMs > 1000 ? '#f5222d' : 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))' }}>
              {fmt(a.maxMs)}
            </Text>
          </div>
          <DurationBar value={a.p95Ms} max={maxP95} color={typeColors[a.type] || 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))'} />
        </div>
      ))}
    </div>
  );
};

// ── API Latency view ───────────────────────────────────────────

interface ApiAgg {
  endpoint: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  successRate: number;
  errorCount: number;
}

const ApiLatencyView: React.FC<{ spans: readonly TraceSpan[] }> = ({ spans }) => {
  const aggs = useMemo((): ApiAgg[] => {
    const httpSpans = spans.filter(s => categorize(s) === 'http');
    const map = new Map<string, { durations: number[]; errors: number }>();
    for (const span of httpSpans) {
      const key = getHttpKey(span);
      if (!map.has(key)) map.set(key, { durations: [], errors: 0 });
      const entry = map.get(key)!;
      entry.durations.push(span.duration);
      const status = span.attributes['http.status_code'] as number | undefined;
      if (span.level === 'error' || (status != null && status >= 400)) entry.errors++;
    }
    return Array.from(map.entries())
      .map(([endpoint, { durations, errors }]) => ({
        endpoint,
        count: durations.length,
        avgMs: avg(durations),
        p95Ms: pct(durations, 0.95),
        maxMs: Math.max(...durations),
        successRate: durations.length > 0 ? ((durations.length - errors) / durations.length) * 100 : 100,
        errorCount: errors,
      }))
      .sort((a, b) => b.p95Ms - a.p95Ms);
  }, [spans]);

  if (aggs.length === 0) {
    return <Empty description="No HTTP spans yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />;
  }

  const maxP95 = Math.max(...aggs.map(a => a.p95Ms), 1);

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', padding: '2px 0 4px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', marginBottom: 2 }}>
        <span style={{ flex: 1 }}>Endpoint</span>
        <span style={{ width: 36, textAlign: 'right' }}>calls</span>
        <span style={{ width: 52, textAlign: 'right' }}>avg</span>
        <span style={{ width: 52, textAlign: 'right' }}>p95</span>
        <span style={{ width: 60, textAlign: 'right' }}>success</span>
      </div>
      {aggs.map(a => (
        <div key={a.endpoint} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text
              style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={a.endpoint}
            >
              {a.endpoint}
            </Text>
            <Text style={{ fontSize: 10, width: 36, textAlign: 'right', flexShrink: 0, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', fontFamily: 'monospace' }}>
              ×{a.count}
            </Text>
            <Text style={{ fontSize: 10, width: 52, textAlign: 'right', flexShrink: 0, color: 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))', fontFamily: 'monospace' }}>
              {fmt(a.avgMs)}
            </Text>
            <Text style={{ fontSize: 10, width: 52, textAlign: 'right', flexShrink: 0, color: a.p95Ms > 1000 ? '#f5222d' : '#1677ff', fontFamily: 'monospace' }}>
              {fmt(a.p95Ms)}
            </Text>
            <div style={{ width: 60, flexShrink: 0 }}>
              <Tooltip title={`${a.errorCount} error${a.errorCount !== 1 ? 's' : ''}`}>
                <Progress
                  percent={Math.round(a.successRate)}
                  size="small"
                  status={a.successRate < 100 ? (a.successRate < 80 ? 'exception' : 'active') : 'success'}
                  format={p => <span style={{ fontSize: 9 }}>{p}%</span>}
                />
              </Tooltip>
            </div>
          </div>
          <DurationBar value={a.p95Ms} max={maxP95} color={a.successRate < 80 ? '#f5222d' : '#1677ff'} />
        </div>
      ))}
    </div>
  );
};

// ── Condition Eval Stats view ──────────────────────────────────

interface CondAgg {
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  totalMs: number;
}

const ConditionStatsView: React.FC<{ spans: readonly TraceSpan[] }> = ({ spans }) => {
  const aggs = useMemo((): CondAgg[] => {
    const condSpans = spans.filter(s => categorize(s) === 'condition');
    const map = new Map<string, number[]>();
    for (const span of condSpans) {
      const key = span.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(span.duration);
    }
    return Array.from(map.entries())
      .map(([name, durations]) => ({
        name,
        count: durations.length,
        avgMs: avg(durations),
        maxMs: Math.max(...durations),
        totalMs: durations.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [spans]);

  if (aggs.length === 0) {
    return (
      <Empty
        description={
          <span style={{ fontSize: 11 }}>
            No condition spans yet.
            Enable condition debug mode in the Conditions tab to capture evaluation traces.
          </span>
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 32 }}
      />
    );
  }

  const maxCount = Math.max(...aggs.map(a => a.count), 1);

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', padding: '2px 0 4px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', marginBottom: 2 }}>
        <span style={{ flex: 1 }}>Condition</span>
        <span style={{ width: 44, textAlign: 'right' }}>evals</span>
        <span style={{ width: 52, textAlign: 'right' }}>avg</span>
        <span style={{ width: 52, textAlign: 'right' }}>total</span>
      </div>
      {aggs.map(a => (
        <div key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text
              style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={a.name}
            >
              {a.name}
            </Text>
            <Text style={{ fontSize: 10, width: 44, textAlign: 'right', flexShrink: 0, color: a.count > 100 ? '#fa8c16' : 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))', fontFamily: 'monospace' }}>
              ×{a.count}
            </Text>
            <Text style={{ fontSize: 10, width: 52, textAlign: 'right', flexShrink: 0, color: '#722ed1', fontFamily: 'monospace' }}>
              {fmt(a.avgMs)}
            </Text>
            <Text style={{ fontSize: 10, width: 52, textAlign: 'right', flexShrink: 0, color: 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))', fontFamily: 'monospace' }}>
              {fmt(a.totalMs)}
            </Text>
          </div>
          <DurationBar value={a.count} max={maxCount} color="#722ed1" />
        </div>
      ))}
    </div>
  );
};

// ── Main Panel ─────────────────────────────────────────────────

export const PerformancePanel: React.FC = () => {
  const spans = useTraceStore();
  const [view, setView] = useState<PerfView>('slowest');

  const summary = useMemo(() => {
    let httpCount = 0, condCount = 0, otherCount = 0;
    let totalHttpMs = 0;
    for (const s of spans) {
      const cat = categorize(s);
      if (cat === 'http') { httpCount++; totalHttpMs += s.duration; }
      else if (cat === 'condition') condCount++;
      else otherCount++;
    }
    return {
      total: spans.length,
      httpCount,
      condCount,
      otherCount,
      avgHttpMs: httpCount > 0 ? totalHttpMs / httpCount : 0,
    };
  }, [spans]);

  if (spans.length === 0) {
    return (
      <Empty
        image={<BarChartOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />}
        description={<span style={{ fontSize: 12 }}>No trace data yet. Interact with the app to collect spans.</span>}
        style={{ padding: 40 }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          size="small"
          value={view}
          onChange={v => setView(v as PerfView)}
          options={[
            { label: <span><ThunderboltOutlined /> Slowest spans</span>, value: 'slowest' },
            { label: <span><ApiOutlined /> API latency</span>, value: 'api' },
            { label: <span><BranchesOutlined /> Conditions</span>, value: 'conditions' },
          ]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' }}>
            {summary.total} spans · {summary.httpCount} HTTP · {summary.condCount} cond
            {summary.httpCount > 0 && ` · avg API ${fmt(summary.avgHttpMs)}`}
          </span>
          <Button size="small" icon={<DeleteOutlined />} onClick={clearTraceStore}>Clear</Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'slowest' && <SlowestView spans={spans} />}
        {view === 'api' && <ApiLatencyView spans={spans} />}
        {view === 'conditions' && <ConditionStatsView spans={spans} />}
      </div>
    </div>
  );
};
