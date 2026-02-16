import React from 'react';
import { Input, Badge, Tag, Progress, Avatar, Timeline } from 'antd';
import dayjs from 'dayjs';
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
  const icon = iconRecord[name];
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
  const tags = Array.isArray(value) ? value : [value];
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
  const tlConfig = config.timelineConfig || {};
  const itemMapping = tlConfig.itemMapping || {};
  const labelField = itemMapping.labelField || 'name';
  const timestampField = itemMapping.timestampField || 'ts';
  const descriptionField = itemMapping.descriptionField;
  const typeField = itemMapping.typeField;
  const iconField = itemMapping.iconField;
  const timestampFormat = tlConfig.timestampFormat || 'MMM D, h:mm:ss A';
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
    items = [...items].reverse();
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
    const label = String(item[labelField] ?? `Event ${idx + 1}`);
    const timestamp = item[timestampField];
    const description = descriptionField ? item[descriptionField] : undefined;
    const type = typeField ? String(item[typeField] ?? '') : undefined;
    const iconName = iconField ? String(item[iconField] ?? '') : undefined;

    const standardFields = new Set(
      [labelField, timestampField, descriptionField, typeField, iconField].filter(Boolean)
    );
    const additionalFields = Object.keys(item).filter(field => !standardFields.has(field));
    const hasAdditionalData = additionalFields.length > 0;

    let formattedTime = '';
    if (timestamp && showTimestamp) {
      try {
        const ts = typeof timestamp === 'number' ? timestamp : Date.parse(String(timestamp));
        if (!isNaN(ts)) {
          formattedTime = dayjs(ts).format(timestampFormat);
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
                    detailResponse: item
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

export const displayRegistrations: Record<string, FieldTypeRegistration> = {
  color: { form: ColorForm, detail: ColorDetail, table: ColorTable },
  badge: { form: BadgeForm, detail: BadgeDetail, table: BadgeTable },
  tag: { form: TagForm, detail: TagDetail, table: TagTable },
  tags: { detail: TagDetail, table: TagTable },
  progress: { detail: ProgressDetail, table: ProgressTable },
  avatar: { detail: AvatarDetail, table: AvatarTable },
  icon: { detail: IconDetail, table: IconTable },
  timeline: { detail: TimelineDetail },
};
