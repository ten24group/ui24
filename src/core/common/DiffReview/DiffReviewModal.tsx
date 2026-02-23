import React, { useMemo } from 'react';
import { Modal, Drawer, Descriptions, Tag, Button, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons';
import type { IForm } from '../../forms/formConfig';

const { Text } = Typography;

type DiffReviewConfig = Pick<
  NonNullable<IForm['reviewBeforeSave']>,
  'fields' | 'requireConfirmFor' | 'format'
>;

interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
  requiresConfirm: boolean;
}

export interface DiffReviewModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  originalValues: Record<string, unknown>;
  currentValues: Record<string, unknown>;
  config: DiffReviewConfig;
  /** Field labels map (fieldName -> display label) */
  fieldLabels?: Record<string, string>;
  loading?: boolean;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === null) return true;
  if (a === null && b === undefined) return true;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  open,
  onConfirm,
  onCancel,
  originalValues,
  currentValues,
  config,
  fieldLabels = {},
  loading = false,
}) => {
  const changes = useMemo<FieldChange[]>(() => {
    const requireConfirmSet = new Set(config.requireConfirmFor || []);
    const result: FieldChange[] = [];

    const fieldsToCheck = config.fields === 'changed-only' || !config.fields
      ? Object.keys(currentValues)
      : config.fields;

    for (const field of fieldsToCheck) {
      const before = originalValues[field];
      const after = currentValues[field];

      if (config.fields === 'changed-only' || !config.fields) {
        if (isEqual(before, after)) continue;
      }

      result.push({
        field,
        label: fieldLabels[field] || field,
        before,
        after,
        requiresConfirm: requireConfirmSet.has(field),
      });
    }

    return result;
  }, [originalValues, currentValues, config, fieldLabels]);

  const hasChanges = changes.length > 0;
  const hasCriticalChanges = changes.some(c => c.requiresConfirm);

  const content = (
    <>
      {!hasChanges ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 12 }} />
          <div>
            <Text type="secondary">No changes detected</Text>
          </div>
        </div>
      ) : (
        <Descriptions
          bordered
          column={1}
          size="small"
          labelStyle={{ width: '30%', fontWeight: 500 }}
        >
          {changes.map(change => (
            <Descriptions.Item
              key={change.field}
              label={
                <span>
                  {change.label}
                  {change.requiresConfirm && (
                    <Tag color="warning" style={{ marginLeft: 8 }}>
                      <WarningOutlined /> Requires confirmation
                    </Tag>
                  )}
                </span>
              }
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Before</Text>
                  <Text delete={!isEqual(change.before, change.after)} style={{ color: '#8c8c8c' }}>
                    {formatValue(change.before)}
                  </Text>
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>After</Text>
                  <Text strong={!isEqual(change.before, change.after)} style={
                    !isEqual(change.before, change.after)
                      ? { color: change.requiresConfirm ? '#ff4d4f' : '#1677ff' }
                      : undefined
                  }>
                    {formatValue(change.after)}
                  </Text>
                </div>
              </div>
            </Descriptions.Item>
          ))}
        </Descriptions>
      )}

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>Go Back</Button>
          <Button
            type="primary"
            onClick={onConfirm}
            loading={loading}
            icon={<CheckOutlined />}
            disabled={!hasChanges}
            danger={hasCriticalChanges}
          >
            {hasCriticalChanges ? 'Confirm Critical Changes' : 'Confirm Save'}
          </Button>
        </Space>
      </div>
    </>
  );

  const title = `Review Changes (${changes.length} ${changes.length === 1 ? 'field' : 'fields'})`;

  if (config.format === 'drawer') {
    return (
      <Drawer
        title={title}
        open={open}
        onClose={onCancel}
        width={600}
        footer={null}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
      destroyOnClose
    >
      {content}
    </Modal>
  );
};
