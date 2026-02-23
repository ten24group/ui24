/**
 * ListFormField — renders an AntForm.List for fields with `type: 'list'` (#111).
 *
 * Supports:
 * - Primitive lists (strings, numbers) — renders a simple Input per item
 * - Object lists (`items.properties` defined) — renders a row of sub-fields per item
 * - Add / Remove buttons with configurable min/max constraints
 * - Labels per item (e.g., "Item 1", "Item 2")
 */

import React from 'react';
import { Form as AntForm, Button, Input, InputNumber, Space, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { IFormField } from '../../types/field-config';

interface ListFormFieldProps {
  item: IFormField;
  /** Resolved label (already condition-resolved) */
  resolvedLabel?: string;
  /** Condition-driven disabled state */
  conditionDisabled?: boolean;
}

/**
 * Renders a single primitive input for a list item.
 */
const PrimitiveItemInput: React.FC<{
  fieldType?: string;
  disabled?: boolean;
  placeholder?: string;
}> = ({ fieldType, disabled, placeholder }) => {
  if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage') {
    return <InputNumber style={{ width: '100%' }} disabled={disabled} placeholder={placeholder} />;
  }
  return <Input disabled={disabled} placeholder={placeholder} />;
};

export const ListFormField: React.FC<ListFormFieldProps> = ({
  item,
  resolvedLabel,
  conditionDisabled,
}) => {
  const fieldName = item.name || item.column || '';
  const subFields = item.items?.properties;
  const isPrimitive = !subFields || subFields.length === 0;

  const label = typeof resolvedLabel === 'string' ? resolvedLabel : (typeof item.label === 'string' ? item.label : fieldName);

  return (
    <AntForm.Item label={label} style={{ marginBottom: 8 }}>
      <AntForm.List name={fieldName}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, idx) => (
              <Space
                key={field.key}
                align="baseline"
                style={{ display: 'flex', marginBottom: 4 }}
              >
                {isPrimitive ? (
                  // Primitive list — single input per item
                  <AntForm.Item
                    {...field}
                    noStyle
                  >
                    <PrimitiveItemInput
                      fieldType={item.fieldType}
                      disabled={conditionDisabled}
                      placeholder={typeof item.placeholder === 'string' ? item.placeholder : `Item ${idx + 1}`}
                    />
                  </AntForm.Item>
                ) : (
                  // Object list — render each sub-field side by side
                  <Space wrap>
                    {(subFields ?? []).map((subField) => (
                      <AntForm.Item
                        key={subField.name || subField.column}
                        name={[ field.name, subField.name || subField.column || '' ]}
                        label={typeof subField.label === 'string' ? subField.label : subField.name}
                        style={{ marginBottom: 0 }}
                      >
                        <PrimitiveItemInput
                          fieldType={subField.fieldType}
                          disabled={conditionDisabled}
                          placeholder={typeof subField.placeholder === 'string' ? subField.placeholder : undefined}
                        />
                      </AntForm.Item>
                    ))}
                  </Space>
                )}

                {/* Remove button */}
                {!conditionDisabled && (
                  <MinusCircleOutlined
                    style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => remove(field.name)}
                    title="Remove item"
                  />
                )}
              </Space>
            ))}

            {/* Add button */}
            {!conditionDisabled && (
              <AntForm.Item style={{ marginBottom: 0, marginTop: 4 }}>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  size="small"
                >
                  <Typography.Text type="secondary">Add {isPrimitive ? 'item' : 'entry'}</Typography.Text>
                </Button>
              </AntForm.Item>
            )}
          </>
        )}
      </AntForm.List>
    </AntForm.Item>
  );
};
