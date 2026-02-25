import React from 'react';
import { Input, Badge, Tag, Progress, Avatar, Timeline } from 'antd';
import { useFormat } from '../../hooks/useFormat';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { OpenInModal } from '../../../modal/Modal';
import * as Icons from '@ant-design/icons';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

/**
 * Safely look up an antd icon component by name.
 * @ant-design/icons doesn't export a string-indexed record, so we build one
 * from the module's own entries at the boundary.
 */
const iconRecord: Record<string, unknown> = Object.fromEntries(Object.entries(Icons));

function getIconComponent(name: string): React.ComponentType<{ style?: React.CSSProperties }> | undefined {
  const icon = iconRecord[ name ];
  return typeof icon === 'function' ? icon as React.ComponentType<{ style?: React.CSSProperties }> : undefined;
}

// Form renderers
const ColorForm: React.FC<BuiltInFormFieldProps> = () => <CustomColorPicker format="hex" showText />;

const BadgeForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, status }) => (
  <Input placeholder={placeholder} addonAfter={<Badge status={status || 'default'} />} />
);

const TagForm: React.FC<BuiltInFormFieldProps> = ({ placeholder }) => <Input placeholder={placeholder} />;

// Detail renderers
const ColorDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => (
  <CustomColorPicker value={typeof value === 'string' ? value : String(value ?? '')} disabled />
);

const BadgeDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => (
  <Badge status={config.status || 'default'} text={String(value)} color={config.color} />
);

const TagDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const tags = Array.isArray(value) ? value : [ value ];
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {tags.map((tag: unknown, i: number) => (
        <Tag key={i} color={config.color}>{String(tag)}</Tag>
      ))}
    </div>
  );
};

const ProgressDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const type = config.progressType || 'line';
  let progressStatus: 'success' | 'exception' | 'normal' | 'active' = 'normal';
  if (config.status === 'success') progressStatus = 'success';
  else if (config.status === 'error' || config.status === 'warning') progressStatus = 'exception';
  else if (config.status === 'processing') progressStatus = 'active';

  return (
    <Progress type={type} percent={Number(value) || 0} status={progressStatus} showInfo={true} />
  );
};

const AvatarDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const IconComp = typeof config.icon === 'string' ? getIconComponent(config.icon) : undefined;
  const strValue = String(value ?? '');
  return (
    <Avatar
      src={typeof value === 'string' ? value : undefined}
      size={config.size || 'default'}
      shape={config.shape || 'circle'}
      icon={IconComp ? <IconComp /> : undefined}
    >
      {config.text || strValue.charAt(0).toUpperCase()}
    </Avatar>
  );
};

const IconDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const IconComp = getIconComponent(String(value));
  if (IconComp) {
    return <IconComp style={{ fontSize: config.size || 24, color: config.color }} />;
  }
  return <span>{String(value)}</span>;
};

const TimelineDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const { formatDate } = useFormat();
  const tlConfig = config.timelineConfig || {};
  const itemMapping = tlConfig.itemMapping || {};
  const labelField = itemMapping.labelField || 'name';
  const timestampField = itemMapping.timestampField || 'ts';
  const descriptionField = itemMapping.descriptionField;
  const typeField = itemMapping.typeField;
  const iconField = itemMapping.iconField;
  const showTimestamp = tlConfig.showTimestamp !== false;

  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const checkpoints = obj.checkpoints;
    const events = obj.events;
    items = (Array.isArray(checkpoints) ? checkpoints : Array.isArray(events) ? events : []) as Array<Record<string, unknown>>;
  }

  if (tlConfig.maxItems && items.length > tlConfig.maxItems) {
    items = items.slice(0, tlConfig.maxItems);
  }
  if (tlConfig.reverse) {
    items = [ ...items ].reverse();
  }

  const getColorFromType = (type?: string): string => {
    switch (type) {
      case 'success': return '#52c41a';
      case 'warning': return '#faad14';
      case 'error': return '#ff4d4f';
      case 'critical': return '#cf1322';
      case 'warn': return '#faad14';
      case 'debug': return '#8c8c8c';
      case 'trace': return '#bfbfbf';
      case 'info':
      default: return '#1890ff';
    }
  };

  const timelineItems = items.map((item, idx) => {
    const label = String(item[ labelField ] ?? `Event ${idx + 1}`);
    const timestamp = item[ timestampField ];
    const description = descriptionField ? item[ descriptionField ] : undefined;
    const type = typeField ? String(item[ typeField ] ?? '') : undefined;
    const iconName = iconField ? String(item[ iconField ] ?? '') : undefined;

    const standardFields = new Set(
      [ labelField, timestampField, descriptionField, typeField, iconField ].filter(Boolean)
    );
    const additionalFields = Object.keys(item).filter(field => !standardFields.has(field));
    const hasAdditionalData = additionalFields.length > 0;

    let formattedTime = '';
    if (timestamp && showTimestamp) {
      try {
        const ts = typeof timestamp === 'number' ? timestamp : Date.parse(String(timestamp));
        if (!isNaN(ts)) {
          formattedTime = formatDate(ts, 'datetime');
        }
      } catch {
        // Ignore invalid timestamps
      }
    }

    let dotIcon: React.ReactNode = undefined;
    if (iconName) {
      const IconComp = getIconComponent(iconName);
      if (IconComp) dotIcon = <IconComp />;
    }

    return {
      key: idx,
      dot: dotIcon,
      color: getColorFromType(type),
      children: (
        <div className="timeline-item-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontWeight: 500 }}>{label}</span>
              {hasAdditionalData && (
                <OpenInModal
                  modalType="details"
                  modalPageConfig={{
                    propertiesConfig: additionalFields.map(field => ({
                      name: field,
                      label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
                      fieldType: 'json' as const,
                      column: field
                    })),
                    dataSource: item as Record<string, unknown>
                  }}
                  modalTitle={label || 'Event Details'}
                  modalWidth={800}
                >
                  <button
                    type="button"
                    style={{
                      padding: '0 4px', minWidth: 'auto', height: 'auto',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      color: '#1890ff', display: 'inline-flex', alignItems: 'center'
                    }}
                  >
                    {(() => {
                      const InfoIcon = getIconComponent('InfoCircleOutlined');
                      return InfoIcon ? <InfoIcon /> : <span>i</span>;
                    })()}
                  </button>
                </OpenInModal>
              )}
            </div>
            {formattedTime && (
              <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                {formattedTime}
              </span>
            )}
          </div>
          {description && (
            <div style={{ fontSize: '13px', color: '#595959', marginTop: '4px' }}>
              {String(description)}
            </div>
          )}
        </div>
      ),
    };
  });

  if (timelineItems.length === 0) {
    return <span style={{ color: '#8c8c8c' }}>No events</span>;
  }

  return (
    <div style={{ paddingTop: '8px' }}>
      <Timeline
        mode={tlConfig.mode || 'left'}
        items={timelineItems}
      />
    </div>
  );
};

// Table renderers
import { Button } from 'antd';
import { OrderedListOutlined } from '@ant-design/icons';
import { createModalConfig } from '../../../table/utils/modalConfigHelper';
import type { BuiltInTableFieldProps } from './types';

const ColorTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  const colorValue = typeof value === 'string' ? value : '';
  if (!colorValue) return <span>—</span>;
  return (
    <>
      <svg width="12" height="12" style={{ verticalAlign: 'middle' }}>
        <rect width="12" height="12" fill={colorValue} strokeWidth={1} stroke="rgb(0,0,0)" />
      </svg>
      <span style={{ marginLeft: 8 }}>{colorValue}</span>
    </>
  );
};

const BadgeTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return <Badge status="default" text={String(value)} />;
};

const TagTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  if (Array.isArray(value)) {
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {value.map((tag: unknown, i: number) => (
          <Tag key={i}>{String(tag)}</Tag>
        ))}
      </div>
    );
  }
  return <Tag>{String(value)}</Tag>;
};

const ProgressTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return <span>—</span>;
  return <Progress percent={num} size="small" style={{ width: 120 }} />;
};

const AvatarTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return <Avatar src={String(value)} size="small" />;
};

const IconTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  const IconComp = getIconComponent(String(value));
  return IconComp ? <IconComp style={{ fontSize: 18 }} /> : <span>{String(value)}</span>;
};

/** Detail renderer for list-type fields (#111) */
const ListDetail: React.FC<BuiltInDetailFieldProps> = ({ value }) => {
  if (!Array.isArray(value) || value.length === 0) return <span>—</span>;

  // Primitive array — render as a comma-separated inline list (≤5) or bullet list (>5)
  if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
    if (value.length <= 5) {
      return (
        <span>
          {value.map((item, i) => (
            <Tag key={i} style={{ marginBottom: 2 }}>{String(item)}</Tag>
          ))}
        </span>
      );
    }
    return (
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {value.map((item, i) => (
          <li key={i} style={{ fontSize: 13 }}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  // Object array — render as a compact table-like stack
  return (
    <div>
      {value.map((item, i) => (
        <div key={i} style={{ marginBottom: 4, padding: '4px 8px', background: 'var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02))', border: '1px solid var(--ant-color-border-secondary, #f0f0f0)', borderRadius: 4, fontSize: 12 }}>
          {typeof item === 'object' && item !== null
            ? Object.entries(item as Record<string, unknown>).map(([ k, v ]) => (
              <span key={k} style={{ marginRight: 8 }}>
                <b>{k}:</b> {String(v ?? '—')}
              </span>
            ))
            : String(item)
          }
        </div>
      ))}
    </div>
  );
};

/** Table renderer for list-type fields (non-multi-select) */
const ListTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!Array.isArray(value) || value.length === 0) return <span>—</span>;

  // Simple string/number array — show inline if short
  if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
    if (value.length === 1) return <span>{String(value[ 0 ])}</span>;
    if (value.length <= 3) return <span>{value.join(', ')}</span>;
  }

  // Complex or long array — show in modal
  const dataKey = column?.column || column?.name || 'value';
  const detailsConfig = createModalConfig(undefined, value, { dataIndex: dataKey }, 'list');
  const columnName = (typeof column?.label === 'string' ? column.label : undefined) || dataKey;

  return (
    <OpenInModal modalType="details" modalTitle={columnName} modalWidth={800} modalPageConfig={detailsConfig}>
      <Button size="small" icon={<OrderedListOutlined />} type="link">
        View ({value.length})
      </Button>
    </OpenInModal>
  );
};

export const displayRegistrations: Record<string, FieldTypeRegistration> = {
  color: {
    form: ColorForm, detail: ColorDetail, table: ColorTable,
    defaults: { table: { width: 110 } },
  },
  badge: {
    form: BadgeForm, detail: BadgeDetail, table: BadgeTable,
    defaults: { table: { width: 120 } },
  },
  tag: {
    form: TagForm, detail: TagDetail, table: TagTable,
    defaults: { table: { width: 120 } },
  },
  tags: {
    detail: TagDetail, table: TagTable,
    defaults: { table: { width: 180 } },
  },
  progress: {
    detail: ProgressDetail, table: ProgressTable,
    defaults: { table: { width: 140 } },
  },
  avatar: {
    detail: AvatarDetail, table: AvatarTable,
    defaults: { table: { width: 60 } },
  },
  icon: {
    detail: IconDetail, table: IconTable,
    defaults: { table: { width: 60 } },
  },
  timeline: { detail: TimelineDetail },
  list: { detail: ListDetail, table: ListTable },
};
