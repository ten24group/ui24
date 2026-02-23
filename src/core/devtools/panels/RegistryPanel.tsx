import React, { useMemo, useCallback } from 'react';
import { Typography, Table, Tag, Switch, Alert, Divider, Space, Button, Empty } from 'antd';
import {
  BugOutlined,
  PlayCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { JsonViewer } from '../../common/JsonViewer/JsonViewer';
import { getConditionNames, getCondition } from '../../utils/ConditionRegistry';
import { getCustomEvaluatorNames } from '../../utils/CustomEvaluatorRegistry';
import { useDebugState, setConditionDebug } from '../store/debug-state';

const { Title, Text } = Typography;

export const RegistryPanel: React.FC<{ onOpenPlayground?: () => void }> = ({ onOpenPlayground }) => {
  const { conditionDebug } = useDebugState();
  const conditionNames = useMemo(() => getConditionNames(), []);
  const evaluatorNames = useMemo(() => getCustomEvaluatorNames(), []);

  const handleDebugToggle = useCallback((checked: boolean) => {
    setConditionDebug(checked);
  }, []);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{name}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t: string) => <Tag color={t === 'condition' ? 'blue' : 'green'}>{t}</Tag>,
    },
  ];

  const data = [
    ...conditionNames.map(name => ({ key: `cond-${name}`, name, type: 'condition' })),
    ...evaluatorNames.map(name => ({ key: `eval-${name}`, name, type: 'evaluator' })),
  ];

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>Conditions & Evaluators</Title>
        <Space>
          <BugOutlined style={{ color: conditionDebug ? '#1677ff' : '#8c8c8c' }} />
          <Text style={{ fontSize: 12 }}>Debug</Text>
          <Switch size="small" checked={conditionDebug} onChange={handleDebugToggle} />
        </Space>
      </div>

      {conditionDebug && (
        <Alert
          type="info"
          message="Debug mode active — condition evaluations are logged to the browser console."
          showIcon
          closable
          style={{ marginBottom: 12, fontSize: 12 }}
        />
      )}

      {/* Registry table */}
      {data.length === 0 ? (
        <Empty
          description={
            <div style={{ fontSize: 12 }}>
              <div>No registered conditions or evaluators.</div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Register named conditions with <Text code style={{ fontSize: 11 }}>registerCondition(name, def)</Text> or
                custom evaluators with <Text code style={{ fontSize: 11 }}>registerCustomEvaluator(name, fn)</Text>.
              </Text>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender: (record) => {
              if (record.type === 'condition') {
                const def = getCondition(record.name);
                return def
                  ? <JsonViewer data={def} defaultExpanded />
                  : <Text type="secondary">Definition not found</Text>;
              }
              return <Text type="secondary">Custom evaluator (function, not inspectable)</Text>;
            },
          }}
          style={{ marginBottom: 16 }}
        />
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* Playground CTA */}
      <div style={{
        padding: '10px 12px',
        background: 'var(--ant-color-primary-bg, #f0f5ff)',
        border: '1px solid var(--ant-color-primary-border, #adc6ff)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
            Condition Playground &amp; Placeholder Resolver
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Write and test conditions live against the current context, step through evaluation, and resolve template placeholders.
          </Text>
        </div>
        {onOpenPlayground && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={onOpenPlayground}
          >
            Open
          </Button>
        )}
      </div>

      {/* Context path reference */}
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--ant-color-bg-layout, #fafafa)', borderRadius: 6, border: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
          <SwapOutlined style={{ marginRight: 4 }} />
          Context path reference
        </Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            'actor.groups', 'actor.email', 'actor.actorId',
            'device.isMobile', 'device.isTablet', 'device.isDesktop', 'device.viewport',
            'pageType', 'entityName', 'route.params', 'modal.isModal', 'modal.depth',
            'record.*', 'formValues.*', 'isDirty', 'isValid',
            'selectedRecords', 'featureFlags.*',
          ].map(path => (
            <Text key={path} code style={{ fontSize: 10, margin: 0 }}>{path}</Text>
          ))}
        </div>
      </div>
    </div>
  );
};
