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
import { useDevToolsStore } from '../store/snapshot';
import { useEvalContextBridge } from '../store/eval-context-bridge';
import type { NewEvaluationContext } from '../../types/evaluation';
import {
  extractFieldsFromStore,
  evaluateCondition,
  FIELD_SOURCE_CONFIG,
  type ExtractedField,
} from '../utils/fieldExtractor';
import { panelRoot, filterBar, scrollArea, mono12, tagSmall, tagXs, statsGrid, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

type FieldFilter = 'all' | 'visible' | 'hidden' | 'conditional';

export const FieldInspectorPanel: React.FC = () => {
  const store = useDevToolsStore();
  const evalCtxRaw = useEvalContextBridge();
  // Provide a stable empty context fallback so condition evaluations return
  // a consistent "no context" result rather than throwing when bridge is empty.
  const evalCtx = (evalCtxRaw ?? {}) as NewEvaluationContext;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FieldFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Use shared field extractor
  const fields = useMemo(() => extractFieldsFromStore(store), [store]);

  // Evaluate conditions for all fields
  const evaluatedFields = useMemo(() => {
    return fields.map(f => {
      const visResult = evaluateCondition(f.visibility, evalCtx);
      const enaResult = evaluateCondition(f.enablement, evalCtx);
      return {
        ...f,
        isVisible: visResult,
        isEnabled: enaResult,
        hasCondition: f.visibility != null || f.enablement != null,
      };
    });
  }, [fields, evalCtx]);

  const filtered = useMemo(() => {
    let result = evaluatedFields;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.label?.toLowerCase().includes(q)) ||
        (f.fieldType?.toLowerCase().includes(q)) ||
        f.pageLabel.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filter === 'visible') result = result.filter(f => f.isVisible !== false);
    if (filter === 'hidden') result = result.filter(f => f.isVisible === false || f.hidden);
    if (filter === 'conditional') result = result.filter(f => f.hasCondition);

    return result;
  }, [evaluatedFields, search, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = evaluatedFields.length;
    const visible = evaluatedFields.filter(f => f.isVisible !== false).length;
    const hidden = evaluatedFields.filter(f => f.isVisible === false || f.hidden).length;
    const conditional = evaluatedFields.filter(f => f.hasCondition).length;
    const withRules = evaluatedFields.filter(f => f.validationRules && f.validationRules.length > 0).length;
    return { total, visible, hidden, conditional, withRules };
  }, [evaluatedFields]);

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return (
    <div style={panelRoot}>
      {/* Stats bar */}
      <div style={statsGrid}>
        <Statistic title="Total" value={stats.total} valueStyle={{ fontSize: 20 }} />
        <Statistic title="Visible" value={stats.visible} valueStyle={{ fontSize: 20, color: colors.success }} prefix={<EyeOutlined style={{ fontSize: 14 }} />} />
        <Statistic title="Hidden" value={stats.hidden} valueStyle={{ fontSize: 20, color: colors.textMuted }} prefix={<EyeInvisibleOutlined style={{ fontSize: 14 }} />} />
        <Statistic title="Conditional" value={stats.conditional} valueStyle={{ fontSize: 20, color: colors.purple }} />
        <Statistic title="With Rules" value={stats.withRules} valueStyle={{ fontSize: 20, color: colors.warning }} />
      </div>

      {/* Filters */}
      <div style={filterBar}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: colors.textLight }} />}
            placeholder="Filter fields..."
            size="small"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <Segmented
          size="small"
          value={filter}
          onChange={val => setFilter(val as FieldFilter)}
          options={[
            { label: `All (${stats.total})`, value: 'all' },
            { label: `Visible (${stats.visible})`, value: 'visible' },
            { label: `Hidden (${stats.hidden})`, value: 'hidden' },
            { label: `Conditional (${stats.conditional})`, value: 'conditional' },
          ]}
        />
      </div>

      {/* Field list */}
      <div style={scrollArea}>
        {filtered.length === 0 ? (
          <Empty
            description={search ? 'No matching fields' : 'No fields found in current page config'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 32 }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.map(field => {
              const isOpen = expanded.has(field.key);
              const srcCfg = FIELD_SOURCE_CONFIG[field.source];

              return (
                <div
                  key={field.key}
                  style={{
                    border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: isOpen ? '#fafafa' : '#fff',
                  }}
                >
                  {/* Field row */}
                  <div
                    onClick={() => toggle(field.key)}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: colors.textLight, fontSize: 10 }}>
                      {isOpen ? <DownOutlined /> : <RightOutlined />}
                    </span>

                    {/* Name + label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 12 }}>{field.name}</Text>
                      {field.label && field.label !== field.name && (
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>{field.label}</Text>
                      )}
                    </div>

                    {/* Tags */}
                    <Tag style={tagXs} color={srcCfg.color}>{srcCfg.label}</Tag>
                    {field.fieldType && <Tag style={tagXs}>{field.fieldType}</Tag>}

                    {/* Status indicators */}
                    {field.isVisible === false && (
                      <Tooltip title="Hidden by condition">
                        <EyeInvisibleOutlined style={{ fontSize: 12, color: colors.textMuted }} />
                      </Tooltip>
                    )}
                    {field.isVisible === true && field.hasCondition && (
                      <Tooltip title="Visible (conditional)">
                        <EyeOutlined style={{ fontSize: 12, color: colors.success }} />
                      </Tooltip>
                    )}
                    {field.isEnabled === false && (
                      <Tooltip title="Disabled by condition">
                        <LockOutlined style={{ fontSize: 12, color: colors.warning }} />
                      </Tooltip>
                    )}
                    {field.isEnabled === true && field.enablement != null && (
                      <Tooltip title="Enabled (conditional)">
                        <UnlockOutlined style={{ fontSize: 12, color: colors.success }} />
                      </Tooltip>
                    )}
                    {field.required && (
                      <Tag color="red" style={tagXs}>req</Tag>
                    )}

                    <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>{field.pageLabel}</Text>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
                      <Descriptions size="small" column={2} style={{ marginBottom: 8 }}>
                        <Descriptions.Item label="Name">{field.name}</Descriptions.Item>
                        <Descriptions.Item label="Type">{field.fieldType || 'text'}</Descriptions.Item>
                        {field.label && <Descriptions.Item label="Label">{field.label}</Descriptions.Item>}
                        <Descriptions.Item label="Source">{field.pageLabel} ({field.source})</Descriptions.Item>
                        <Descriptions.Item label="Required">{field.required ? 'Yes' : 'No'}</Descriptions.Item>
                        {field.hidden != null && <Descriptions.Item label="Hidden">{field.hidden ? 'Yes' : 'No'}</Descriptions.Item>}
                      </Descriptions>

                      {field.visibility && (
                        <div style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: 600 }}>Visibility condition:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color={field.isVisible === false ? 'red' : 'green'} style={tagSmall}>
                              {field.isVisible === false ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                              {' '}
                              {field.isVisible === false ? 'Hidden' : 'Visible'}
                            </Tag>
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <JsonViewer data={field.visibility as Record<string, unknown>} maxHeight={200} />
                          </div>
                        </div>
                      )}

                      {field.enablement != null && (
                        <div style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: 600 }}>Enablement condition:</Text>
                          <div style={{ marginTop: 4 }}>
                            <JsonViewer data={typeof field.enablement === 'object' ? field.enablement as Record<string, unknown> : { value: field.enablement }} maxHeight={200} />
                          </div>
                        </div>
                      )}

                      {field.validationRules && field.validationRules.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Validation rules:</Text>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {field.validationRules.map((rule, ri) => (
                              <div
                                key={ri}
                                style={{
                                  padding: '4px 8px',
                                  background: '#f9f0ff',
                                  border: '1px solid #d3adf7',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {Object.entries(rule)
                                  .filter(([, v]) => v !== undefined)
                                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                  .join('  ·  ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <Text style={{ fontSize: 11, fontWeight: 600 }}>Full config:</Text>
                        <div style={{ marginTop: 4 }}>
                          <JsonViewer data={field.fullConfig} maxHeight={300} />
                        </div>
                      </div>
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
