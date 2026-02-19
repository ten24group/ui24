import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Empty, Input, Tooltip, Segmented, Statistic, Descriptions } from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  RightOutlined,
  DownOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { useDevToolsStore, BridgeEntry, BridgeEntryType } from '../devtoolsBridge';
import { useNewEvaluationContext } from '../../context/NewEvaluationContext';
import { conditionEvaluator } from '../../utils/ConditionEvaluator';
import type { NewEvaluationContext } from '../../types/evaluation';

const { Text } = Typography;

interface ExtractedField {
  name: string;
  fieldType?: string;
  label?: string;
  visibility?: unknown;
  enablement?: unknown;
  required?: unknown;
  source: string;
  fullConfig: Record<string, unknown>;
}

function extractFields(pageData: Record<string, unknown>): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const config = (pageData?.config ?? pageData) as Record<string, unknown>;

  const extractFromArray = (arr: unknown[], source: string) => {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const f = item as Record<string, unknown>;
      const name = String(f.name || f.column || f.dataIndex || f.key || '');
      if (!name) continue;
      fields.push({
        name,
        fieldType: f.fieldType as string | undefined,
        label: (f.label || f.title) as string | undefined,
        visibility: f.visibility,
        enablement: f.enablement ?? f.editable,
        required: f.required,
        source,
        fullConfig: f,
      });
    }
  };

  if (Array.isArray(config.propertiesConfig)) {
    extractFromArray(config.propertiesConfig, 'form');
  }
  if (Array.isArray(config.columns)) {
    extractFromArray(config.columns, 'table');
  }

  for (const key of ['formPageConfig', 'listPageConfig', 'detailsPageConfig', 'detailPageConfig']) {
    const sub = config[key] as Record<string, unknown> | undefined;
    if (sub?.propertiesConfig && Array.isArray(sub.propertiesConfig)) {
      extractFromArray(sub.propertiesConfig, key.includes('form') ? 'form' : key.includes('list') ? 'table' : 'detail');
    }
    if (sub?.columns && Array.isArray(sub.columns)) {
      extractFromArray(sub.columns, 'table');
    }
    if (sub?.columnsConfig) {
      const cc = sub.columnsConfig as Record<string, unknown>;
      if (Array.isArray(cc.columns)) {
        extractFromArray(cc.columns, 'table');
      }
    }
  }

  return fields;
}

function evaluateCondition(condition: unknown, ctx: NewEvaluationContext): boolean | null {
  if (condition == null) return null;
  if (typeof condition === 'boolean') return condition;
  try {
    return conditionEvaluator.evaluateSync(condition as any, ctx);
  } catch {
    return null;
  }
}

const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  form: { color: 'blue', label: 'Form' },
  detail: { color: 'purple', label: 'Detail' },
  table: { color: 'green', label: 'Table' },
};

type SourceFilter = 'all' | 'form' | 'detail' | 'table';

export const FieldInspectorPanel: React.FC = () => {
  const store = useDevToolsStore();
  const evalCtx = useNewEvaluationContext();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pageEntries = useMemo(() => {
    return Array.from(store.values()).filter((e: BridgeEntry) => e.type === ('page' as BridgeEntryType));
  }, [store]);

  const allFields = useMemo(() => {
    const result: Array<ExtractedField & { pageLabel: string }> = [];
    for (const entry of pageEntries) {
      const data = entry.data as Record<string, unknown> | null;
      if (!data) continue;
      const fields = extractFields(data);
      for (const f of fields) {
        result.push({ ...f, pageLabel: entry.label });
      }
    }
    return result;
  }, [pageEntries]);

  const filtered = useMemo(() => {
    let result = allFields;
    if (sourceFilter !== 'all') {
      result = result.filter(f => f.source === sourceFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.label || '').toLowerCase().includes(q) ||
        (f.fieldType || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allFields, search, sourceFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = allFields.length;
    let hidden = 0, disabled = 0, required = 0;
    for (const f of allFields) {
      if (evaluateCondition(f.visibility, evalCtx) === false) hidden++;
      if (evaluateCondition(f.enablement, evalCtx) === false) disabled++;
      if (f.required === true) required++;
    }
    return { total, hidden, disabled, required };
  }, [allFields, evalCtx]);

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of allFields) c[f.source] = (c[f.source] || 0) + 1;
    return c;
  }, [allFields]);

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  if (pageEntries.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="No page context active" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Text type="secondary" style={{ fontSize: 12 }}>Navigate to a page to inspect its field configuration.</Text>
      </div>
    );
  }

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
          title="Hidden"
          value={stats.hidden}
          valueStyle={{ fontSize: 18, color: stats.hidden > 0 ? '#ff4d4f' : undefined }}
          prefix={stats.hidden > 0 ? <EyeInvisibleOutlined style={{ fontSize: 13 }} /> : undefined}
        />
        <Statistic
          title="Disabled"
          value={stats.disabled}
          valueStyle={{ fontSize: 18, color: stats.disabled > 0 ? '#faad14' : undefined }}
          prefix={stats.disabled > 0 ? <LockOutlined style={{ fontSize: 13 }} /> : undefined}
        />
        <Statistic
          title="Required"
          value={stats.required}
          valueStyle={{ fontSize: 18, color: stats.required > 0 ? '#1677ff' : undefined }}
        />
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Search by name, label, or type..."
          size="small"
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Segmented
            size="small"
            value={sourceFilter}
            onChange={val => setSourceFilter(val as SourceFilter)}
            options={[
              { label: `All (${allFields.length})`, value: 'all' },
              { label: `Form (${sourceCounts['form'] || 0})`, value: 'form' },
              { label: `Detail (${sourceCounts['detail'] || 0})`, value: 'detail' },
              { label: `Table (${sourceCounts['table'] || 0})`, value: 'table' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
            {filtered.length} shown
          </Text>
        </div>
      </div>

      {/* Field list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px 12px' }}>
        {/* Sticky header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '20px 1fr 80px 36px 36px 36px',
          gap: 4,
          padding: '6px 8px 4px',
          fontSize: 10,
          fontWeight: 600,
          color: '#8c8c8c',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '2px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 1,
        }}>
          <span />
          <span>Field</span>
          <span>Type</span>
          <Tooltip title="Visibility"><span style={{ textAlign: 'center' }}><EyeOutlined style={{ fontSize: 11 }} /></span></Tooltip>
          <Tooltip title="Enabled"><span style={{ textAlign: 'center' }}><UnlockOutlined style={{ fontSize: 11 }} /></span></Tooltip>
          <Tooltip title="Required"><span style={{ textAlign: 'center' }}>Req</span></Tooltip>
        </div>

        {filtered.length === 0 ? (
          <Empty description="No fields match" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map((f, idx) => {
              const key = `${f.pageLabel}-${f.name}-${idx}`;
              const isOpen = expanded.has(key);
              const visResult = evaluateCondition(f.visibility, evalCtx);
              const enResult = evaluateCondition(f.enablement, evalCtx);
              const reqResult = typeof f.required === 'boolean' ? f.required : null;
              const isHidden = visResult === false;
              const isDisabled = enResult === false;
              const srcCfg = SOURCE_CONFIG[f.source] || { color: 'default', label: f.source };

              return (
                <div key={key} style={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  opacity: isHidden ? 0.5 : 1,
                  border: isOpen ? '1px solid #d9d9d9' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  <div
                    onClick={() => toggle(key)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 80px 36px 36px 36px',
                      gap: 4,
                      padding: '5px 8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isOpen ? '#fafafa' : undefined,
                      alignItems: 'center',
                      borderBottom: isOpen ? '1px solid #f0f0f0' : undefined,
                    }}
                  >
                    <span>
                      {isOpen
                        ? <DownOutlined style={{ fontSize: 9, color: '#8c8c8c' }} />
                        : <RightOutlined style={{ fontSize: 9, color: '#8c8c8c' }} />
                      }
                    </span>

                    {/* Field name + label */}
                    <div style={{ overflow: 'hidden', lineHeight: 1.3 }}>
                      <Text style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: isHidden ? 'line-through' : undefined,
                        color: isHidden ? '#8c8c8c' : undefined,
                      }}>
                        {f.name}
                      </Text>
                      {f.label && f.label !== f.name && (
                        <Text type="secondary" style={{ fontSize: 10 }}>{f.label}</Text>
                      )}
                    </div>

                    {/* Type + Source */}
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {f.fieldType && (
                        <Tag style={{ margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
                          {f.fieldType}
                        </Tag>
                      )}
                      <Tag color={srcCfg.color} style={{ margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
                        {srcCfg.label}
                      </Tag>
                    </div>

                    {/* Visibility */}
                    <div style={{ textAlign: 'center' }}>
                      {f.visibility != null ? (
                        <Tooltip title={<pre style={{ margin: 0, fontSize: 10, maxWidth: 300 }}>{JSON.stringify(f.visibility, null, 2)}</pre>}>
                          {visResult === false
                            ? <EyeInvisibleOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />
                            : <EyeOutlined style={{ color: '#52c41a', fontSize: 13 }} />
                          }
                        </Tooltip>
                      ) : (
                        <span style={{ color: '#d9d9d9', fontSize: 12 }}>—</span>
                      )}
                    </div>

                    {/* Enabled */}
                    <div style={{ textAlign: 'center' }}>
                      {f.enablement != null ? (
                        <Tooltip title={<pre style={{ margin: 0, fontSize: 10, maxWidth: 300 }}>{JSON.stringify(f.enablement, null, 2)}</pre>}>
                          {enResult === false
                            ? <LockOutlined style={{ color: '#faad14', fontSize: 13 }} />
                            : <UnlockOutlined style={{ color: '#52c41a', fontSize: 13 }} />
                          }
                        </Tooltip>
                      ) : (
                        <span style={{ color: '#d9d9d9', fontSize: 12 }}>—</span>
                      )}
                    </div>

                    {/* Required */}
                    <div style={{ textAlign: 'center' }}>
                      {reqResult === true
                        ? <CheckCircleOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />
                        : reqResult === false
                          ? <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 13 }} />
                          : <span style={{ color: '#d9d9d9', fontSize: 12 }}>—</span>
                      }
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding: '10px 12px 12px' }}>
                      <Descriptions size="small" column={2} bordered style={{ marginBottom: 10 }}>
                        <Descriptions.Item label="Field Name">
                          <Text copyable style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.name}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Page">{f.pageLabel}</Descriptions.Item>
                        <Descriptions.Item label="Source">
                          <Tag color={srcCfg.color} style={{ margin: 0 }}>{srcCfg.label}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Field Type">
                          {f.fieldType ? <Tag style={{ margin: 0 }}>{f.fieldType}</Tag> : <Text type="secondary">default</Text>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Visible">
                          {visResult == null ? <Text type="secondary">always</Text> :
                            visResult ? <Tag color="green">true</Tag> : <Tag color="red">false</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Enabled">
                          {enResult == null ? <Text type="secondary">always</Text> :
                            enResult ? <Tag color="green">true</Tag> : <Tag color="red">false</Tag>}
                        </Descriptions.Item>
                      </Descriptions>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Full Config</Text>
                      <JsonViewer data={f.fullConfig} maxHeight={300} />
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
