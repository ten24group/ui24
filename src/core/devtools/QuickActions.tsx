import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Button, Tooltip, message, Divider } from 'antd';
import {
  CopyOutlined,
  NodeIndexOutlined,
  ClearOutlined,
  ReloadOutlined,
  BugOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  DashboardOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';
import { useThemeMode, toggleThemeMode } from '../stores/theme';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from './store/snapshot';
import { useDebugState, setConditionDebug, setConditionProfiling } from './store/debug-state';
// Use the bridge instead of direct context subscription — this avoids the
// "Cannot update QuickActions while rendering Details/Form" React warning.
// The bridge is a useSyncExternalStore store (no synchronous dispatch during render).
import { useEvalContextBridge } from './store/eval-context-bridge';
import { useTraceStore } from '../telemetry';
import { queryClient } from '../query/QueryProvider';
import { conditionEvaluator } from '../utils/ConditionEvaluator';
import { getTraceStoreSnapshot } from '../telemetry';
import { IS_DEV } from '../constants';
import { row, colors } from './utils/devtoolsStyles';

// Reactive query count — subscribes to TanStack Query cache events.
// Uses useEffect (not useSyncExternalStore) because the cache fires events
// synchronously during renders (when queries are created), which would trigger
// the "setState during render" React warning with useSyncExternalStore.
function useQueryCount(): number {
  const [count, setCount] = useState(() => queryClient.getQueryCache().getAll().length);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      setCount(queryClient.getQueryCache().getAll().length);
    });
    return unsubscribe;
  }, []);

  return count;
}

export const QuickActions: React.FC = () => {
  const store = useDevToolsStore();
  const evalCtx = useEvalContextBridge();
  const themeMode = useThemeMode();
  const traces = useTraceStore();
  const { conditionDebug, conditionProfiling } = useDebugState();

  const currentPageConfig = useMemo(() => {
    const pages = Array.from(store.values()).filter((e: BridgeEntry) => e.type === ('page' as BridgeEntryType));
    if (pages.length === 0) return null;
    const latest = pages.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
    return (latest.data as Record<string, unknown>)?.config ?? latest.data;
  }, [store]);

  const queryCount = useQueryCount();

  const copyPageConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentPageConfig, null, 2));
      message.success('Page config copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  }, [currentPageConfig]);

  const copyEvalContext = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(evalCtx, null, 2));
      message.success('Eval context copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  }, [evalCtx]);

  const copyLiveState = useCallback(async () => {
    try {
      const data = Object.fromEntries(
        Array.from(store.entries()).map(([k, v]) => [k, { type: v.type, label: v.label, data: v.data }])
      );
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      message.success('Live state copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  }, [store]);

  const clearCache = useCallback(() => {
    queryClient.clear();
    message.success('Query cache cleared');
  }, []);

  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries();
    message.success(`Invalidated ${queryCount} queries`);
  }, [queryCount]);

  const toggleDebug = useCallback(() => {
    setConditionDebug(!conditionDebug);
    message.info(`Condition debug ${!conditionDebug ? 'enabled' : 'disabled'}`);
  }, [conditionDebug]);

  const toggleProfiling = useCallback(() => {
    setConditionProfiling(!conditionProfiling);
    message.info(`Condition profiling ${!conditionProfiling ? 'enabled' : 'disabled'}`);
  }, [conditionProfiling]);

  const exportSession = useCallback(async () => {
    try {
      const snapshot = {
        timestamp: new Date().toISOString(),
        environment: IS_DEV ? 'development' : 'production',
        userAgent: navigator.userAgent,
        url: window.location.href,
        bridgeStore: Object.fromEntries(
          Array.from(store.entries()).map(([k, v]) => [k, { type: v.type, label: v.label, data: v.data, modalDepth: v.modalDepth }])
        ),
        evalContext: evalCtx,
        traces: traces.slice(-100).map(span => ({
          name: span.name,
          startTime: span.startTime,
          endTime: span.endTime,
          duration: span.duration,
          attributes: span.attributes,
          level: span.level,
        })),
        conditionStats: Object.fromEntries(conditionEvaluator.getEvaluationStats()),
        queryCache: queryClient.getQueryCache().getAll().map(q => ({
          key: q.queryKey,
          status: q.state.status,
          dataUpdatedAt: q.state.dataUpdatedAt,
          fetchStatus: q.state.fetchStatus,
        })),
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ui24-debug-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('Debug session exported');
    } catch {
      message.error('Failed to export session');
    }
  }, [store, traces, evalCtx]);

  return (
    <div style={{
      ...row(2),
      padding: '4px 8px',
      borderBottom: `1px solid ${colors.border}`,
      background: colors.bgLight,
    }}>
      {/* Copy actions */}
      <Tooltip title="Copy page config" placement="bottom">
        <Button size="small" type="text" icon={<CopyOutlined />} onClick={copyPageConfig} disabled={!currentPageConfig} style={{ fontSize: 13 }} />
      </Tooltip>
      <Tooltip title="Copy eval context" placement="bottom">
        <Button size="small" type="text" icon={<NodeIndexOutlined />} onClick={copyEvalContext} style={{ fontSize: 13 }} />
      </Tooltip>
      <Tooltip title="Copy live state snapshot" placement="bottom">
        <Button size="small" type="text" icon={<DatabaseOutlined />} onClick={copyLiveState} style={{ fontSize: 13 }} />
      </Tooltip>

      <Divider type="vertical" style={{ margin: '0 2px', height: 18 }} />

      {/* Cache actions */}
      <Tooltip title={`Clear query cache (${queryCount} queries)`} placement="bottom">
        <Button size="small" type="text" icon={<ClearOutlined />} onClick={clearCache} style={{ fontSize: 13 }} />
      </Tooltip>
      <Tooltip title="Force refetch all queries" placement="bottom">
        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={forceRefetch} style={{ fontSize: 13 }} />
      </Tooltip>

      <Divider type="vertical" style={{ margin: '0 2px', height: 18 }} />

      {/* Debug toggles — state synced via bridge */}
      <Tooltip title={`Condition debug: ${conditionDebug ? 'ON' : 'OFF'}`} placement="bottom">
        <Button
          size="small"
          type={conditionDebug ? 'primary' : 'text'}
          icon={<BugOutlined />}
          onClick={toggleDebug}
          danger={conditionDebug}
          style={{ fontSize: 13 }}
        />
      </Tooltip>
      <Tooltip title={`Condition profiling: ${conditionProfiling ? 'ON' : 'OFF'}`} placement="bottom">
        <Button
          size="small"
          type={conditionProfiling ? 'primary' : 'text'}
          icon={<DashboardOutlined />}
          onClick={toggleProfiling}
          danger={conditionProfiling}
          style={{ fontSize: 13 }}
        />
      </Tooltip>

      <Divider type="vertical" style={{ margin: '0 2px', height: 18 }} />

      {/* Session export */}
      <Tooltip title="Export debug session" placement="bottom">
        <Button size="small" type="text" icon={<DownloadOutlined />} onClick={exportSession} style={{ fontSize: 13 }} />
      </Tooltip>

      <Divider type="vertical" style={{ margin: '0 2px', height: 18 }} />

      {/* Dark mode toggle */}
      <Tooltip title={themeMode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'} placement="bottom">
        <Button
          size="small"
          type={themeMode === 'dark' ? 'primary' : 'text'}
          icon={themeMode === 'dark' ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggleThemeMode}
          style={{ fontSize: 13 }}
        />
      </Tooltip>

      {/* Keyboard hint */}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: colors.textLight }}>
        Ctrl+Shift+D
      </span>
    </div>
  );
};
