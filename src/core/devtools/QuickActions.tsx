import React, { useCallback, useMemo, useState } from 'react';
import { Button, Tooltip, message, Divider } from 'antd';
import {
  CopyOutlined,
  NodeIndexOutlined,
  ClearOutlined,
  ReloadOutlined,
  BugOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from './devtoolsBridge';
import { useNewEvaluationContext } from '../context/NewEvaluationContext';
import { queryClient } from '../query/QueryProvider';
import { conditionEvaluator } from '../utils/ConditionEvaluator';

export const QuickActions: React.FC = () => {
  const store = useDevToolsStore();
  const evalCtx = useNewEvaluationContext();
  const [debugOn, setDebugOn] = useState(false);

  const currentPageConfig = useMemo(() => {
    const pages = Array.from(store.values()).filter((e: BridgeEntry) => e.type === ('page' as BridgeEntryType));
    if (pages.length === 0) return null;
    const latest = pages.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
    return (latest.data as Record<string, unknown>)?.config ?? latest.data;
  }, [store]);

  const queryCount = useMemo(() => {
    return queryClient.getQueryCache().getAll().length;
  }, [store]); // Re-calculate when store changes as a proxy for activity

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
    const next = !debugOn;
    conditionEvaluator.enableDebug(next);
    setDebugOn(next);
    message.info(`Condition debug ${next ? 'enabled' : 'disabled'}`);
  }, [debugOn]);

  return (
    <div style={{
      padding: '4px 8px',
      borderBottom: '1px solid #f0f0f0',
      background: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
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

      {/* Debug toggle */}
      <Tooltip title={`Condition debug: ${debugOn ? 'ON — click to disable' : 'OFF — click to enable'}`} placement="bottom">
        <Button
          size="small"
          type={debugOn ? 'primary' : 'text'}
          icon={<BugOutlined />}
          onClick={toggleDebug}
          danger={debugOn}
          style={{ fontSize: 13 }}
        />
      </Tooltip>

      {/* Keyboard hint */}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#bfbfbf' }}>
        Ctrl+Shift+D
      </span>
    </div>
  );
};
