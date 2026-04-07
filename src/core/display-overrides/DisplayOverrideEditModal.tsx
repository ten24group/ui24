/**
 * Modal to add/edit/clear a display override using the same field types as the entity form (detail-only UX).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Space, Typography } from 'antd';
import { useUi24Config } from '../context';
import { fieldTypeRegistry } from '../registry/FieldTypeRegistry';
import type { BuiltInFormFieldProps } from '../registry/field-types/types';
import type { IDetailFieldConfig, IFormFieldResponse } from '../types/field-config';
import { resolveStringOrDefault } from '../types/evaluation';
import { CodeEditor } from '../common/CodeEditor/CodeEditor';
import { dayjsCustom } from '../dayjs';
import type { DisplayOverrideEntry } from '../types/display-override';

const FORM_FIELD = 'overrideValue';

function formatValueForFormField(item: IDetailFieldConfig, raw: unknown): unknown {
  if (raw === undefined || raw === null) return raw;
  const ft = (item.fieldType || 'text').toLowerCase();
  if (ft === 'datetime' || ft === 'date' || ft === 'time') {
    const v = raw as string | number;
    if (typeof v === 'string' && v.toString().startsWith('0')) {
      return dayjsCustom.tz(new Date(parseInt(v, 10)).toISOString(), item.timezone);
    }
    return dayjsCustom.tz(v, item.timezone);
  }
  if (ft === 'json') {
    return typeof raw !== 'string' ? JSON.stringify(raw, null, 2) : raw;
  }
  return raw;
}

export interface DisplayOverrideEditModalProps {
  open: boolean;
  onClose: () => void;
  /** Field config from entity UI (label, fieldType, options, etc.) */
  fieldConfig: IDetailFieldConfig;
  /** Raw value from the record at this field path (canonical / “original”) */
  canonicalRaw: unknown;
  /** Current override entry, if any */
  currentOverride: DisplayOverrideEntry | null;
  saving?: boolean;
  onSave: (entry: DisplayOverrideEntry) => void;
  onClear: () => void;
}

export const DisplayOverrideEditModal: React.FC<DisplayOverrideEditModalProps> = ({
  open,
  onClose,
  fieldConfig,
  canonicalRaw,
  currentOverride,
  saving = false,
  onSave,
  onClear,
}) => {
  const { selectConfig } = useUi24Config();
  const formatConfig = selectConfig(c => c.formatConfig);
  const [ form ] = Form.useForm();
  const [ jsonDraft, setJsonDraft ] = useState('');

  const isComplex = useMemo(() => {
    const ft = (fieldConfig.fieldType || '').toLowerCase();
    return fieldConfig.type === 'list' || fieldConfig.type === 'map' || ft === 'json';
  }, [ fieldConfig.fieldType, fieldConfig.type ]);

  const BuiltInRenderer = fieldTypeRegistry.get(fieldConfig.fieldType || 'text', 'form');

  const formFieldShape = fieldConfig as unknown as IFormFieldResponse;

  useEffect(() => {
    if (!open) return;
    if (isComplex) {
      const src = currentOverride?.value !== undefined ? currentOverride.value : canonicalRaw;
      try {
        setJsonDraft(
          src === undefined || src === null
            ? ''
            : (typeof src === 'string' ? src : JSON.stringify(src, null, 2))
        );
      } catch {
        setJsonDraft('');
      }
      return;
    }
    const initial =
      currentOverride?.value !== undefined
        ? formatValueForFormField(fieldConfig, currentOverride.value)
        : formatValueForFormField(fieldConfig, canonicalRaw);
    form.setFieldsValue({ [ FORM_FIELD ]: initial });
  }, [ open, isComplex, currentOverride, canonicalRaw, fieldConfig, form ]);

  const label = resolveStringOrDefault(fieldConfig.label, fieldConfig.name || fieldConfig.column || 'Field');

  const handleOk = async () => {
    if (isComplex) {
      let parsed: unknown;
      try {
        parsed = jsonDraft.trim() === '' ? null : JSON.parse(jsonDraft);
      } catch {
        return;
      }
      onSave({ value: parsed as unknown, kind: 'value' });
      return;
    }
    try {
      const values = await form.validateFields();
      const v = values[ FORM_FIELD ];
      onSave({ value: v, kind: 'value' });
    } catch {
      // validation failed
    }
  };

  const smartDefaults = fieldTypeRegistry.getDefaults(fieldConfig.fieldType || 'text', 'form');
  const builtInProps: BuiltInFormFieldProps = {
    ...(smartDefaults || {}),
    fieldType: fieldConfig.fieldType || 'text',
    name: FORM_FIELD,
    placeholder: resolveStringOrDefault(fieldConfig.placeholder),
    options: formFieldShape.options,
    formatConfig,
    label,
    min: fieldConfig.min,
    max: fieldConfig.max,
    step: fieldConfig.step,
    timezone: fieldConfig.timezone,
  };

  const hasOverride = currentOverride?.value !== undefined;

  return (
    <Modal
      title={`Override: ${label}`}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      confirmLoading={saving}
      okText="Save override"
      onOk={handleOk}
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button danger disabled={!hasOverride || saving} onClick={onClear}>
            Clear override
          </Button>
          <Space>
            <CancelBtn />
            <OkBtn />
          </Space>
        </Space>
      )}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          The detail view keeps showing the original value. This override is used where display overrides apply (e.g. public app).
        </Typography.Text>
        {isComplex ? (
          <CodeEditor
            language="json"
            value={jsonDraft}
            onChange={setJsonDraft}
            height={240}
            validateJson
          />
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              name={FORM_FIELD}
              label={label}
              valuePropName={[ 'boolean', 'toggle', 'switch' ].includes((fieldConfig.fieldType || '').toLowerCase()) ? 'checked' : 'value'}
              rules={
                Array.isArray(formFieldShape.validations) && formFieldShape.validations.includes('required')
                  ? [ { required: true, message: 'Required' } ]
                  : undefined
              }
            >
              {BuiltInRenderer ? (
                <BuiltInRenderer {...builtInProps} />
              ) : (
                <Input />
              )}
            </Form.Item>
          </Form>
        )}
      </Space>
    </Modal>
  );
};
