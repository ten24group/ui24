import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Table, Tag, Switch, Input, Button, Alert, Collapse, Divider, Space } from 'antd';
import {
  BugOutlined,
  PlayCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { getConditionNames, getCondition } from '../../utils/ConditionRegistry';
import { getCustomEvaluatorNames } from '../../utils/CustomEvaluatorRegistry';
import { conditionEvaluator } from '../../utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../../context/NewEvaluationContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const EXAMPLE_CONDITIONS: Record<string, { label: string; json: string }> = {
  groups: {
    label: 'Actor in group',
    json: '{\n  "actor": {\n    "groups": { "contains": "admin" }\n  }\n}',
  },
  device: {
    label: 'Mobile device',
    json: '{\n  "device": {\n    "isMobile": { "eq": true }\n  }\n}',
  },
  featureFlag: {
    label: 'Feature flag on',
    json: '{\n  "featureFlags": {\n    "myFeature": { "eq": true }\n  }\n}',
  },
  logical: {
    label: 'OR condition',
    json: '{\n  "or": [\n    { "actor": { "groups": { "contains": "admin" } } },\n    { "actor": { "groups": { "contains": "team-admin" } } }\n  ]\n}',
  },
};

const ConditionTester: React.FC = () => {
  const evalCtx = useNewEvaluationContext();
  const [conditionJson, setConditionJson] = useState(EXAMPLE_CONDITIONS.groups.json);
  const [result, setResult] = useState<{ success: boolean; value?: boolean; error?: string } | null>(null);
  const [showContext, setShowContext] = useState(false);

  const handleEvaluate = useCallback(() => {
    try {
      const condition = JSON.parse(conditionJson);
      const value = conditionEvaluator.evaluateSync(condition, evalCtx);
      setResult({ success: true, value });
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }, [conditionJson, evalCtx]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          InlineCondition format — keys map to context paths.
        </Text>
        <Button size="small" type="link" onClick={() => setShowContext(prev => !prev)} style={{ fontSize: 11, padding: 0 }}>
          {showContext ? 'Hide context' : 'Show context'}
        </Button>
      </div>

      {/* Example buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {Object.entries(EXAMPLE_CONDITIONS).map(([key, { label, json }]) => (
          <Button
            key={key}
            size="small"
            type={conditionJson === json ? 'primary' : 'default'}
            onClick={() => { setConditionJson(json); setResult(null); }}
            style={{ fontSize: 11 }}
          >
            {label}
          </Button>
        ))}
      </div>

      <TextArea
        value={conditionJson}
        onChange={e => { setConditionJson(e.target.value); setResult(null); }}
        rows={5}
        style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}
        placeholder='{ "actor": { "groups": { "contains": "admin" } } }'
      />
      <Button
        type="primary"
        size="small"
        icon={<PlayCircleOutlined />}
        onClick={handleEvaluate}
      >
        Evaluate
      </Button>
      {result && (
        <div style={{ marginTop: 8 }}>
          {result.success ? (
            <Alert
              type={result.value ? 'success' : 'warning'}
              message={<span>Result: <strong>{String(result.value)}</strong></span>}
              showIcon
              style={{ fontSize: 12 }}
            />
          ) : (
            <Alert type="error" message={result.error} showIcon style={{ fontSize: 12 }} />
          )}
        </div>
      )}

      {/* Show current evaluation context */}
      {showContext && (
        <div style={{ marginTop: 10 }}>
          <Divider style={{ margin: '8px 0' }} />
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Current Evaluation Context</Text>
          <JsonViewer data={evalCtx as unknown as Record<string, unknown>} maxHeight={300} />
        </div>
      )}
    </div>
  );
};

const PlaceholderResolver: React.FC = () => {
  const evalCtx = useNewEvaluationContext();
  const [template, setTemplate] = useState('{actor.email}');
  const [resolved, setResolved] = useState<string | null>(null);

  const handleResolve = useCallback(() => {
    try {
      setResolved(conditionEvaluator.resolveTemplate(template, evalCtx));
    } catch (err: unknown) {
      setResolved(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [template, evalCtx]);

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Enter a template string with {'{field.path}'} placeholders.
      </Text>
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input
          value={template}
          onChange={e => { setTemplate(e.target.value); setResolved(null); }}
          placeholder="{actor.email}"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Button icon={<SwapOutlined />} onClick={handleResolve}>Resolve</Button>
      </Space.Compact>
      {resolved !== null && (
        <Alert
          type="info"
          message={<Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{resolved}</Text>}
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
    </div>
  );
};

export const RegistryPanel: React.FC = () => {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const conditionNames = useMemo(() => getConditionNames(), []);
  const evaluatorNames = useMemo(() => getCustomEvaluatorNames(), []);

  const handleDebugToggle = useCallback((checked: boolean) => {
    setDebugEnabled(checked);
    conditionEvaluator.enableDebug(checked);
  }, []);

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (name: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{name}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color={t === 'condition' ? 'blue' : 'green'}>{t}</Tag> },
  ];

  const data = [
    ...conditionNames.map(name => ({ key: `cond-${name}`, name, type: 'condition' })),
    ...evaluatorNames.map(name => ({ key: `eval-${name}`, name, type: 'evaluator' })),
  ];

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>Conditions & Evaluators</Title>
        <Space>
          <BugOutlined style={{ color: debugEnabled ? '#1677ff' : '#8c8c8c' }} />
          <Text style={{ fontSize: 12 }}>Debug</Text>
          <Switch size="small" checked={debugEnabled} onChange={handleDebugToggle} />
        </Space>
      </div>

      {debugEnabled && (
        <Alert
          type="info"
          message="Debug mode active — condition evaluations are logged to the browser console."
          showIcon
          closable
          style={{ marginBottom: 12, fontSize: 12 }}
        />
      )}

      <Table
        dataSource={data}
        columns={columns}
        size="small"
        pagination={false}
        locale={{ emptyText: 'No registrations' }}
        expandable={{
          expandedRowRender: (record) => {
            if (record.type === 'condition') {
              const def = getCondition(record.name);
              return def
                ? <JsonViewer data={def as unknown as Record<string, unknown>} defaultExpanded />
                : <Text type="secondary">Definition not found</Text>;
            }
            return <Text type="secondary">Custom evaluator (function)</Text>;
          },
        }}
        style={{ marginBottom: 16 }}
      />

      <Divider style={{ margin: '12px 0' }} />

      <Collapse
        size="small"
        items={[
          {
            key: 'tester',
            label: <span><PlayCircleOutlined style={{ marginRight: 6 }} />Condition Tester</span>,
            children: <ConditionTester />,
          },
          {
            key: 'resolver',
            label: <span><SwapOutlined style={{ marginRight: 6 }} />Placeholder Resolver</span>,
            children: <PlaceholderResolver />,
          },
        ]}
      />
    </div>
  );
};
