import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useDevToolsStore, BridgeEntry } from './store/snapshot';
import { useTraceStore, type TraceSpan } from '../telemetry';
import { getConditionNames } from '../utils/ConditionRegistry';
import { getCustomEvaluatorNames } from '../utils/CustomEvaluatorRegistry';
import { useDebounce } from '../hooks/useSelectiveDebounce';
import { filterBar, colors, mono10, mono12 } from './utils/devtoolsStyles';

const { Text } = Typography;

interface SearchResult {
  category: string;
  label: string;
  detail?: string;
  tabKey: string;
}

function searchBridge(store: ReadonlyMap<string, BridgeEntry>, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();
  for (const entry of Array.from(store.values())) {
    if (entry.label.toLowerCase().includes(q) || entry.type.toLowerCase().includes(q)) {
      results.push({ category: 'State', label: entry.label, detail: entry.type, tabKey: 'live' });
    }
    const data = entry.data as Record<string, unknown> | null;
    if (data) {
      const config = data.config as Record<string, unknown> | undefined;
      const props = (config?.propertiesConfig || data.propertiesConfig) as Array<Record<string, unknown>> | undefined;
      if (props) {
        for (const p of props) {
          const name = (p.name || p.dataIndex || '') as string;
          if (name.toLowerCase().includes(q) || ((p.label || '') as string).toLowerCase().includes(q)) {
            results.push({ category: 'Fields', label: name, detail: `${p.type || 'text'} in ${entry.label}`, tabKey: 'fields' });
          }
        }
      }
    }
  }
  return results;
}

function searchTraces(spans: readonly TraceSpan[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();
  for (const span of spans.slice(-50)) {
    if (span.name.toLowerCase().includes(q)) {
      results.push({ category: 'Traces', label: span.name, detail: `${span.duration.toFixed(1)}ms`, tabKey: 'traces' });
    }
  }
  return results;
}

function searchConditions(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();
  for (const name of getConditionNames()) {
    if (name.toLowerCase().includes(q)) {
      results.push({ category: 'Conditions', label: name, detail: 'registered condition', tabKey: 'registry' });
    }
  }
  for (const name of getCustomEvaluatorNames()) {
    if (name.toLowerCase().includes(q)) {
      results.push({ category: 'Conditions', label: name, detail: 'custom evaluator', tabKey: 'registry' });
    }
  }
  return results;
}

const CATEGORY_COLORS: Record<string, string> = {
  State: colors.primary,
  Fields: colors.success,
  Activity: colors.purple,
  Traces: colors.orange,
  Conditions: colors.teal,
};

interface SearchEverywhereProps {
  onNavigate: (tabKey: string) => void;
}

export const SearchEverywhere: React.FC<SearchEverywhereProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const store = useDevToolsStore();
  const traces = useTraceStore();
  const debouncedQuery = useDebounce(query, 150);

  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const all: SearchResult[] = [
      ...searchBridge(store, debouncedQuery),
      ...searchTraces(traces, debouncedQuery),
      ...searchConditions(debouncedQuery),
    ];
    const seen = new Set<string>();
    const grouped: Record<string, SearchResult[]> = {};
    for (const r of all) {
      const key = `${r.category}:${r.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!grouped[r.category]) grouped[r.category] = [];
      if (grouped[r.category].length < 5) {
        grouped[r.category].push(r);
      }
    }
    return Object.entries(grouped).flatMap(([_, items]) => items);
  }, [debouncedQuery, store, traces]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const select = useCallback((result: SearchResult) => {
    onNavigate(result.tabKey);
    setQuery('');
    setOpen(false);
  }, [onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, results, activeIndex, select]);

  const showDropdown = open && debouncedQuery.length >= 2;

  return (
    <div style={{ position: 'relative', ...filterBar, background: colors.bgLight }}>
      <Input
        prefix={<SearchOutlined style={{ color: colors.textLight }} />}
        placeholder="Search fields, API calls, conditions, config..."
        size="small"
        allowClear
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        style={mono12}
      />

      {showDropdown && (
        <div style={{
          position: 'absolute',
          left: 8, right: 8, top: '100%',
          zIndex: 10,
          background: 'var(--ant-color-bg-container, #fff)',
          border: `1px solid ${colors.borderDark}`,
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 320,
          overflow: 'auto',
        }}>
          {results.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Text type="secondary" style={mono12}>No results for "{debouncedQuery}"</Text>
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.category}-${r.label}-${i}`}
                onMouseDown={() => select(r)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: i < results.length - 1 ? `1px solid ${colors.border}` : 'none',
                  background: i === activeIndex ? '#f0f5ff' : 'transparent',
                }}
              >
                <Tag
                  color={CATEGORY_COLORS[r.category] || colors.textMuted}
                  style={{ ...mono10, margin: 0, lineHeight: '14px', minWidth: 50, textAlign: 'center' }}
                >
                  {r.category}
                </Tag>
                <Text style={{ ...mono12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.label}
                </Text>
                {r.detail && (
                  <Text type="secondary" style={{ ...mono10, flexShrink: 0 }}>{r.detail}</Text>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
