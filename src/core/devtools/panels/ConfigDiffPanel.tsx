import React, { useMemo, useCallback } from 'react';
import { Typography, Button, Alert, Tag, Empty, Descriptions, message, Divider } from 'antd';
import {
  SaveOutlined,
  DeleteOutlined,
  DiffOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useDevToolsStore } from '../store/snapshot';
import { useConfigSnapshot, saveSnapshot, clearSnapshot, type ConfigSnapshot } from '../store/config-snapshot';
import { jsonDiff, formatValue, type DiffEntry } from '../utils/jsonDiff';
import { mono12, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

// ── Diff Entry Row ─────────────────────────────────────────────

const DIFF_COLORS = {
  added:   { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a', label: 'added' },
  removed: { bg: '#fff2f0', border: '#ffccc7', text: '#cf1322', label: 'removed' },
  changed: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806', label: 'changed' },
};

const DiffRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
  const cfg = DIFF_COLORS[entry.type];
  return (
    <div style={{
      padding: '5px 10px',
      borderLeft: `3px solid ${cfg.border}`,
      background: cfg.bg,
      borderRadius: '0 4px 4px 0',
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      fontSize: 11,
    }}>
      <Tag color={entry.type === 'added' ? 'success' : entry.type === 'removed' ? 'error' : 'warning'}
           style={{ fontSize: 9, margin: 0, flexShrink: 0, lineHeight: '14px', padding: '0 4px' }}>
        {cfg.label}
      </Tag>
      <Text style={{ ...mono12, flex: 1, color: colors.text, wordBreak: 'break-all' }}>
        {entry.path}
      </Text>
      {entry.type === 'changed' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <Text style={{ ...mono12, color: '#cf1322', textDecoration: 'line-through', fontSize: 10 }}>
            {formatValue(entry.oldValue)}
          </Text>
          <span style={{ color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', fontSize: 10 }}>→</span>
          <Text style={{ ...mono12, color: '#52c41a', fontSize: 10 }}>
            {formatValue(entry.newValue)}
          </Text>
        </div>
      )}
      {entry.type === 'added' && (
        <Text style={{ ...mono12, color: '#52c41a', fontSize: 10, flexShrink: 0 }}>
          {formatValue(entry.newValue)}
        </Text>
      )}
      {entry.type === 'removed' && (
        <Text style={{ ...mono12, color: '#cf1322', fontSize: 10, flexShrink: 0, textDecoration: 'line-through' }}>
          {formatValue(entry.oldValue)}
        </Text>
      )}
    </div>
  );
};

// ── Panel ──────────────────────────────────────────────────────

export const ConfigDiffPanel: React.FC = () => {
  const store = useDevToolsStore();
  const snapshot = useConfigSnapshot();

  // Get the current active page config from bridge store
  const currentPage = useMemo(() => {
    const pages = Array.from(store.values()).filter(e => e.type === 'page');
    if (pages.length === 0) return null;
    return pages.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
  }, [store]);

  const currentConfig = (currentPage?.data as Record<string, unknown> | null)?.config ?? currentPage?.data ?? null;

  // Compute diff
  const diffs = useMemo(() => {
    if (!snapshot || currentConfig === null) return [];
    return jsonDiff(snapshot.config, currentConfig);
  }, [snapshot, currentConfig]);

  const groupedDiffs = useMemo(() => {
    const groups = { added: [] as DiffEntry[], removed: [] as DiffEntry[], changed: [] as DiffEntry[] };
    for (const d of diffs) {
      groups[d.type].push(d);
    }
    return groups;
  }, [diffs]);

  const handleSave = useCallback(() => {
    if (!currentPage || currentConfig === null) {
      message.warning('No page config active — navigate to a page first');
      return;
    }
    saveSnapshot({
      label: currentPage.label,
      pageType: (currentPage.data as any)?.pageType || 'unknown',
      config: currentConfig,
      savedAt: new Date().toISOString(),
    });
    message.success('Config snapshot saved');
  }, [currentPage, currentConfig]);

  const handleClear = useCallback(() => {
    clearSnapshot();
    message.info('Snapshot cleared');
  }, []);

  // No active page
  if (!currentPage) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="info"
          showIcon
          message="No active page"
          description="Navigate to a page to capture a config snapshot."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Current page info */}
      <div style={{ padding: '8px 10px', background: 'var(--ant-color-bg-layout, #f5f5f5)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <DiffOutlined style={{ color: '#1677ff' }} />
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 12 }}>{currentPage.label}</Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Active page config</Text>
        </div>
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          onClick={handleSave}
        >
          Save as Baseline
        </Button>
      </div>

      {/* Snapshot info + clear */}
      {snapshot ? (
        <div style={{ padding: '8px 10px', background: 'var(--ant-color-primary-bg, #f0f5ff)', borderRadius: 6, border: '1px solid #adc6ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleOutlined style={{ color: '#1677ff' }} />
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: 12 }}>Baseline: {snapshot.label}</Text>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              Saved {new Date(snapshot.savedAt).toLocaleString()} · {snapshot.pageType}
            </Text>
          </div>
          <Button size="small" icon={<DeleteOutlined />} onClick={handleClear} danger>
            Clear
          </Button>
        </div>
      ) : (
        <Alert
          type="warning"
          showIcon
          message="No baseline snapshot saved"
          description="Click 'Save as Baseline' above to pin the current config. Changes since then will be highlighted here."
          style={{ fontSize: 11 }}
        />
      )}

      {snapshot && (
        <>
          <Divider style={{ margin: '4px 0' }} />

          {/* Diff summary */}
          {diffs.length === 0 ? (
            <Alert
              type="success"
              showIcon
              message="No changes"
              description="Current config matches the saved baseline."
            />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Text strong style={{ fontSize: 12 }}>
                  {diffs.length} change{diffs.length !== 1 ? 's' : ''}
                </Text>
                {groupedDiffs.added.length > 0 && (
                  <Tag color="success" style={{ fontSize: 10 }}>+{groupedDiffs.added.length} added</Tag>
                )}
                {groupedDiffs.removed.length > 0 && (
                  <Tag color="error" style={{ fontSize: 10 }}>-{groupedDiffs.removed.length} removed</Tag>
                )}
                {groupedDiffs.changed.length > 0 && (
                  <Tag color="warning" style={{ fontSize: 10 }}>~{groupedDiffs.changed.length} changed</Tag>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {groupedDiffs.added.map(d => <DiffRow key={`add-${d.path}`} entry={d} />)}
                {groupedDiffs.removed.map(d => <DiffRow key={`rem-${d.path}`} entry={d} />)}
                {groupedDiffs.changed.map(d => <DiffRow key={`chg-${d.path}`} entry={d} />)}
              </div>
            </>
          )}

          <Divider style={{ margin: '4px 0' }} />

          {/* Raw views */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Baseline config</Text>
              <JsonViewer data={snapshot.config} maxHeight={200} />
            </div>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Current config</Text>
              <JsonViewer data={currentConfig} maxHeight={200} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
