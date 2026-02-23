import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Typography, Button, Alert, Tag, Divider, Space, Tooltip, Empty, Tabs, Input } from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CopyOutlined,
  ClearOutlined,
  SwapOutlined,
  QuestionCircleOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { conditionEvaluator, type ExplanationNode } from '../../utils/ConditionEvaluator';
import { useEvalContextBridge } from '../store/eval-context-bridge';
import { getConditionNames, getCondition } from '../../utils/ConditionRegistry';
import { mono12, colors } from '../utils/devtoolsStyles';

const { Text } = Typography;

// ── Types ──────────────────────────────────────────────────────

interface EvalResult {
  success: boolean;
  value?: boolean;
  error?: string;
  accessedPaths: AccessedPath[];
}

interface AccessedPath {
  path: string;
  value: unknown;
  matched: boolean;
}

// ── Condition path extraction ─────────────────────────────────

function extractConditionPaths(condition: unknown, prefix = ''): string[] {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(condition as Record<string, unknown>)) {
    if (key === 'and' || key === 'or' || key === 'not') {
      const nested = Array.isArray(value) ? value : [value];
      for (const n of nested) paths.push(...extractConditionPaths(n, prefix));
    } else {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const innerKeys = Object.keys(value as Record<string, unknown>);
        const isOperator = innerKeys.some(k =>
          ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'notIn', 'startsWith', 'endsWith', 'regex'].includes(k)
        );
        if (isOperator) {
          paths.push(fullPath);
        } else {
          paths.push(...extractConditionPaths(value, fullPath));
        }
      }
    }
  }
  return paths;
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── Evaluation ────────────────────────────────────────────────

function runEval(conditionJson: string, evalCtx: unknown): EvalResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(conditionJson);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      accessedPaths: [],
    };
  }

  try {
    const value = conditionEvaluator.evaluateSync(parsed, evalCtx as any);
    const paths = Array.from(new Set(extractConditionPaths(parsed)));
    const accessedPaths: AccessedPath[] = paths.map(path => {
      const contextValue = resolvePath(evalCtx, path);
      return {
        path,
        value: contextValue,
        matched: contextValue !== undefined && contextValue !== null,
      };
    });
    return { success: true, value, accessedPaths };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      accessedPaths: [],
    };
  }
}

// ── Examples (using real context paths) ──────────────────────

const EXAMPLES: Array<{ label: string; json: string }> = [
  {
    label: 'Admin group',
    json: JSON.stringify({ actor: { groups: { contains: 'admin' } } }, null, 2),
  },
  {
    label: 'Page type',
    // pageType is a top-level key in the evaluation context, not page.type
    json: JSON.stringify({ pageType: { eq: 'list' } }, null, 2),
  },
  {
    label: 'Entity name',
    json: JSON.stringify({ entityName: { eq: 'user' } }, null, 2),
  },
  {
    label: 'OR: admin or team-admin',
    json: JSON.stringify({
      or: [
        { actor: { groups: { contains: 'admin' } } },
        { actor: { groups: { contains: 'team-admin' } } },
      ],
    }, null, 2),
  },
  {
    label: 'AND: group + entity',
    json: JSON.stringify({
      and: [
        { actor: { groups: { contains: 'admin' } } },
        { entityName: { eq: 'user' } },
      ],
    }, null, 2),
  },
  {
    label: 'In a modal',
    json: JSON.stringify({ modal: { isModal: { eq: true } } }, null, 2),
  },
  {
    label: 'Form dirty',
    json: JSON.stringify({ isDirty: { eq: true } }, null, 2),
  },
  {
    label: 'Feature flag',
    json: JSON.stringify({ featureFlags: { myFeature: { eq: true } } }, null, 2),
  },
];

// ── Value display pill ─────────────────────────────────────────

function ValuePill({ value }: { value: unknown }) {
  if (value === undefined) return <Tag style={{ fontSize: 10 }}>undefined</Tag>;
  if (value === null) return <Tag style={{ fontSize: 10 }}>null</Tag>;
  if (Array.isArray(value)) {
    return (
      <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {value.slice(0, 3).map((v, i) => (
          <Tag key={i} color="purple" style={{ fontSize: 10, margin: 0 }}>{String(v)}</Tag>
        ))}
        {value.length > 3 && <Tag style={{ fontSize: 10, margin: 0 }}>+{value.length - 3} more</Tag>}
      </span>
    );
  }
  if (typeof value === 'boolean') return <Tag color={value ? 'green' : 'red'} style={{ fontSize: 10 }}>{String(value)}</Tag>;
  if (typeof value === 'object') return <Tag color="blue" style={{ fontSize: 10 }}>{'{ … }'}</Tag>;
  const s = String(value);
  return <Tag style={{ fontSize: 10, fontFamily: 'monospace' }}>{s.length > 24 ? s.slice(0, 24) + '…' : s}</Tag>;
}

// ── Explanation Tree ──────────────────────────────────────────

const NODE_COLORS: Record<ExplanationNode['type'], { pass: string; fail: string }> = {
  bool:         { pass: '#52c41a', fail: '#f5222d' },
  and:          { pass: '#52c41a', fail: '#f5222d' },
  or:           { pass: '#52c41a', fail: '#f5222d' },
  not:          { pass: '#13c2c2', fail: '#13c2c2' },
  ref:          { pass: '#1677ff', fail: '#1677ff' },
  inline:       { pass: '#52c41a', fail: '#f5222d' },
  rule:         { pass: '#52c41a', fail: '#f5222d' },
  custom_error: { pass: '#f5222d', fail: '#f5222d' },
};

const TYPE_LABELS: Record<ExplanationNode['type'], string> = {
  bool: 'BOOL', and: 'AND', or: 'OR', not: 'NOT',
  ref: 'REF', inline: 'INLINE', rule: 'RULE', custom_error: 'ERROR',
};

const ExplanationTree: React.FC<{ node: ExplanationNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const palette = NODE_COLORS[node.type];
  const color = node.result ? palette.pass : palette.fail;
  const typeLabel = TYPE_LABELS[node.type];
  const indent = depth * 14;

  return (
    <div style={{ marginLeft: indent, marginBottom: 2 }}>
      <div
        onClick={() => hasChildren && setExpanded(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          padding: '4px 8px',
          background: node.result ? '#f6ffed' : '#fff2f0',
          border: `1px solid ${node.result ? '#b7eb8f' : '#ffccc7'}`,
          borderRadius: 4,
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <span style={{ color, fontWeight: 700, fontSize: 10, flexShrink: 0, minWidth: 36, textAlign: 'center' }}>
          {typeLabel}
        </span>
        <span style={{ color, flexShrink: 0, fontSize: 13 }}>
          {node.result ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ant-color-text, rgba(0, 0, 0, 0.88))', wordBreak: 'break-word' }}>{node.description}</span>
          {node.type === 'rule' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <Tag style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
                actual: {JSON.stringify(node.actual)}
              </Tag>
              <Tag color={node.result ? 'success' : 'error'} style={{ fontSize: 10, margin: 0 }}>
                {node.result ? 'matches' : 'no match'}
              </Tag>
            </div>
          )}
        </div>
        {hasChildren && (
          <span style={{ color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))', fontSize: 10, flexShrink: 0 }}>
            {expanded ? '▾' : '▸'} {node.children!.length}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div style={{ borderLeft: `2px solid ${color}30`, marginLeft: 8, paddingLeft: 4, marginTop: 2 }}>
          {node.children!.map((child, i) => (
            <ExplanationTree key={i} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Condition tester tab ──────────────────────────────────────

const ConditionTab: React.FC = () => {
  const evalCtx = useEvalContextBridge();
  const [conditionJson, setConditionJson] = useState(EXAMPLES[0].json);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [explanation, setExplanation] = useState<ExplanationNode | null>(null);
  const [viewMode, setViewMode] = useState<'result' | 'explain'>('result');
  const [autoEval, setAutoEval] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registeredConditions = useMemo(() => getConditionNames(), []);

  const runExplain = useCallback((json: string, ctx: unknown) => {
    try {
      const parsed = JSON.parse(json);
      const tree = conditionEvaluator.explainSync(parsed, ctx as Parameters<typeof conditionEvaluator.explainSync>[1]);
      setExplanation(tree);
    } catch {
      setExplanation(null);
    }
  }, []);

  useEffect(() => {
    if (!autoEval) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (conditionJson.trim()) {
        setResult(runEval(conditionJson, evalCtx));
        runExplain(conditionJson, evalCtx);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [conditionJson, evalCtx, autoEval, runExplain]);

  const handleEvaluate = useCallback(() => {
    setResult(runEval(conditionJson, evalCtx));
    runExplain(conditionJson, evalCtx);
  }, [conditionJson, evalCtx, runExplain]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(conditionJson); } catch { /* ignore */ }
  }, [conditionJson]);

  const loadRegistered = useCallback((name: string) => {
    const def = getCondition(name);
    if (def) setConditionJson(JSON.stringify(def, null, 2));
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>Condition JSON</Text>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <Tooltip title={autoEval ? 'Auto-evaluation ON' : 'Auto-evaluation OFF'}>
              <Button
                size="small"
                type={autoEval ? 'primary' : 'default'}
                ghost={autoEval}
                icon={<SyncOutlined spin={autoEval} />}
                onClick={() => setAutoEval(p => !p)}
                style={{ fontSize: 11 }}
              >
                Auto
              </Button>
            </Tooltip>
            {!autoEval && (
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={handleEvaluate}>Run</Button>
            )}
            <Tooltip title="Copy JSON">
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} />
            </Tooltip>
            <Tooltip title="Clear">
              <Button size="small" icon={<ClearOutlined />} onClick={() => { setConditionJson(''); setResult(null); }} />
            </Tooltip>
          </div>
        </div>

        {/* Examples */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {EXAMPLES.map(({ label, json }) => (
            <Button
              key={label}
              size="small"
              type={conditionJson === json ? 'primary' : 'default'}
              onClick={() => setConditionJson(json)}
              style={{ fontSize: 11 }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Registered conditions */}
        {registeredConditions.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Load registered: </Text>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {registeredConditions.slice(0, 8).map(name => (
                <Button key={name} size="small" type="dashed" onClick={() => loadRegistered(name)} style={{ fontSize: 10 }}>
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={conditionJson}
          onChange={e => setConditionJson(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={'{\n  "actor": {\n    "groups": { "contains": "admin" }\n  }\n}'}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: '8px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.6,
            background: 'var(--ant-color-bg-layout, #fafafa)',
            color: 'var(--ant-color-text, rgba(0, 0, 0, 0.88))',
            boxSizing: 'border-box',
          }}
        />

        {/* Context toggle */}
        <Button
          type="link"
          size="small"
          onClick={() => setShowContext(p => !p)}
          style={{ padding: 0, fontSize: 11, marginTop: 6, alignSelf: 'flex-start' }}
        >
          {showContext ? 'Hide full context' : 'Show full context'}
        </Button>
        {showContext && <div style={{ marginTop: 6 }}><JsonViewer data={evalCtx} maxHeight={200} /></div>}
      </div>

      {/* Right: result pane */}
      <div style={{ width: 320, minWidth: 240, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #f0f0f0' }}>
        {!result ? (
          <Empty
            description={<Text type="secondary" style={{ fontSize: 11 }}>Start typing to see results</Text>}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 32 }}
          />
        ) : (
          <>
            {/* Result header + view mode toggle */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)', background: 'var(--ant-color-bg-layout, #fafafa)', flexShrink: 0 }}>
              {result.success ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.value
                    ? <CheckCircleOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                    : <CloseCircleOutlined style={{ fontSize: 18, color: '#faad14' }} />}
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15, color: result.value ? '#52c41a' : '#faad14' }}>
                      {result.value ? 'PASS' : 'FAIL'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                      Evaluates to <strong>{String(result.value)}</strong>
                    </Text>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <Tooltip title="Result & paths">
                      <Button
                        size="small"
                        type={viewMode === 'result' ? 'primary' : 'text'}
                        icon={<QuestionCircleOutlined />}
                        onClick={() => setViewMode('result')}
                      />
                    </Tooltip>
                    <Tooltip title="Explain step-by-step">
                      <Button
                        size="small"
                        type={viewMode === 'explain' ? 'primary' : 'text'}
                        icon={<NodeIndexOutlined />}
                        onClick={() => setViewMode('explain')}
                      />
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <Alert type="error" message={result.error} showIcon style={{ fontSize: 11 }} />
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
              {viewMode === 'explain' ? (
                /* Explanation tree */
                explanation ? (
                  <div>
                    <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Step-by-step explanation
                    </Text>
                    <ExplanationTree node={explanation} />
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>No explanation available</Text>
                )
              ) : (
                /* Accessed paths */
                <>
                  {result.accessedPaths.length > 0 && (
                    <div>
                      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Context paths accessed</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.accessedPaths.map(({ path, value, matched }) => (
                          <div
                            key={path}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              background: matched ? '#f6ffed' : '#fff7e6',
                              borderRadius: 4,
                              border: `1px solid ${matched ? '#b7eb8f' : '#ffe58f'}`,
                            }}
                          >
                            <Text style={{ ...mono12, flex: 1, color: colors.text }}>{path}</Text>
                            <ValuePill value={value} />
                            <span style={{ fontSize: 10, color: matched ? '#52c41a' : '#fa8c16' }}>
                              {matched ? '✓' : '–'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {result.accessedPaths.some(p => !p.matched) && (
                        <Alert
                          type="info"
                          showIcon={false}
                          message={
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              Paths showing <Tag color="warning" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>–</Tag> are undefined.
                              Use Context &gt; Overrides to set test values.
                            </Text>
                          }
                          style={{ marginTop: 6, fontSize: 10 }}
                        />
                      )}
                    </div>
                  )}
                  {result.success && result.accessedPaths.length === 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      No simple context paths extracted. Switch to Explain for a step-by-step breakdown.
                    </Text>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Placeholder resolver tab ──────────────────────────────────

const PlaceholderTab: React.FC = () => {
  const evalCtx = useEvalContextBridge();
  const [template, setTemplate] = useState('{actor.email}');
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = useCallback(() => {
    try {
      const result = conditionEvaluator.resolveTemplate(template, evalCtx as any);
      setResolved(result);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setResolved(null);
    }
  }, [template, evalCtx]);

  const TEMPLATE_EXAMPLES = [
    '{actor.email}',
    '{actor.actorId}',
    'Hello {actor.email}!',
    '{entityName} — {pageType}',
    '{record.name}',
  ];

  return (
    <div style={{ padding: '10px 12px' }}>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        Resolve template strings with <Text code style={{ fontSize: 11 }}>{'{field.path}'}</Text> placeholders against the current evaluation context.
      </Text>

      {/* Examples */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {TEMPLATE_EXAMPLES.map(ex => (
          <Button
            key={ex}
            size="small"
            type={template === ex ? 'primary' : 'default'}
            onClick={() => { setTemplate(ex); setResolved(null); }}
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          >
            {ex}
          </Button>
        ))}
      </div>

      <Space.Compact style={{ width: '100%', marginBottom: 10 }}>
        <Input
          value={template}
          onChange={e => { setTemplate(e.target.value); setResolved(null); setError(null); }}
          onPressEnter={handleResolve}
          placeholder="{actor.email}"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Button icon={<SwapOutlined />} onClick={handleResolve} type="primary">Resolve</Button>
      </Space.Compact>

      {resolved !== null && (
        <Alert
          type="success"
          message={<Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{resolved}</Text>}
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
      {error !== null && (
        <Alert type="error" message={error} showIcon style={{ fontSize: 12 }} />
      )}

      <Divider style={{ margin: '12px 0 8px' }} />

      <div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Current context (available paths)</Text>
        <JsonViewer data={evalCtx} maxHeight={300} />
      </div>
    </div>
  );
};

// ── Main Panel ─────────────────────────────────────────────────

export const ConditionPlaygroundPanel: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        size="small"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ padding: '0 12px', marginBottom: 0, background: 'var(--ant-color-bg-layout, #fafafa)', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}
        items={[
          {
            key: 'conditions',
            label: <span><PlayCircleOutlined /> Conditions</span>,
            children: (
              <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ConditionTab />
              </div>
            ),
          },
          {
            key: 'placeholders',
            label: <span><SwapOutlined /> Placeholders</span>,
            children: (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <PlaceholderTab />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
