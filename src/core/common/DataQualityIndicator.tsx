import React, { useMemo } from 'react';
import { Progress, Tooltip, Tag, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface IDataQualityConfig {
  enabled: boolean;
  /** Infer required/optional fields from schema attributes (default: true) */
  autoDetect?: boolean;
  /** Explicit list of required fields for completeness calculation */
  requiredFields?: string[];
  /** Explicit list of optional fields that count towards completeness */
  optionalFields?: string[];
  /** Show completeness indicator in list/table view */
  showInList?: boolean;
  /** Show completeness indicator in detail view */
  showInDetail?: boolean;
  /** Show names of missing fields */
  showMissing?: boolean;
  /** Warn when completeness falls below this percentage (0-100) */
  alertBelow?: number;
}

interface DataQualityResult {
  percentage: number;
  missingRequired: string[];
  missingOptional: string[];
  totalFields: number;
  filledFields: number;
}

function isFieldFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function computeQuality(
  record: Record<string, unknown>,
  requiredFields: readonly string[],
  optionalFields: readonly string[]
): DataQualityResult {
  const totalFields = requiredFields.length + optionalFields.length;
  if (totalFields === 0) return { percentage: 100, missingRequired: [], missingOptional: [], totalFields: 0, filledFields: 0 };

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  let filled = 0;

  for (const field of requiredFields) {
    if (isFieldFilled(record[ field ])) { filled++; }
    else { missingRequired.push(field); }
  }

  for (const field of optionalFields) {
    if (isFieldFilled(record[ field ])) { filled++; }
    else { missingOptional.push(field); }
  }

  return {
    percentage: Math.round((filled / totalFields) * 100),
    missingRequired,
    missingOptional,
    totalFields,
    filledFields: filled,
  };
}

function getStatusColor(percentage: number, alertBelow?: number): string {
  if (alertBelow !== undefined && percentage < alertBelow) return '#ff4d4f';
  if (percentage >= 90) return '#52c41a';
  if (percentage >= 60) return '#faad14';
  return '#ff4d4f';
}

function getStatusIcon(percentage: number): React.ReactNode {
  if (percentage >= 90) return <CheckCircleOutlined />;
  if (percentage >= 60) return <WarningOutlined />;
  return <ExclamationCircleOutlined />;
}

interface DataQualityIndicatorProps {
  record: Record<string, unknown>;
  config: IDataQualityConfig;
  /** Property configs from entity schema — used when autoDetect is enabled. */
  propertiesConfig?: ReadonlyArray<{ name?: string; dataIndex?: string; column?: string; id?: string; required?: boolean }>;
  /** 'full' for detail pages, 'compact' for table cells */
  mode?: 'full' | 'compact';
}

export const DataQualityIndicator: React.FC<DataQualityIndicatorProps> = ({
  record,
  config,
  propertiesConfig,
  mode = 'full',
}) => {
  const { requiredFields, optionalFields } = useMemo(() => {
    if (config.requiredFields || config.optionalFields) {
      return {
        requiredFields: config.requiredFields ?? [],
        optionalFields: config.optionalFields ?? [],
      };
    }

    if (config.autoDetect !== false && propertiesConfig) {
      const getFieldKey = (p: { name?: string; dataIndex?: string; column?: string; id?: string }) =>
        p.dataIndex ?? p.column ?? p.id ?? p.name;
      const withKey = propertiesConfig
        .map(p => ({ ...p, _key: getFieldKey(p) }))
        .filter((p): p is typeof p & { _key: string } => !!p._key);
      return {
        requiredFields: withKey.filter(p => p.required).map(p => p._key),
        optionalFields: withKey.filter(p => !p.required).map(p => p._key),
      };
    }

    return { requiredFields: [] as string[], optionalFields: [] as string[] };
  }, [ config.requiredFields, config.optionalFields, config.autoDetect, propertiesConfig ]);

  const quality = useMemo(
    () => computeQuality(record, requiredFields, optionalFields),
    [ record, requiredFields, optionalFields ]
  );

  if (quality.totalFields === 0) return null;

  const color = getStatusColor(quality.percentage, config.alertBelow);
  const allMissing = [ ...quality.missingRequired, ...quality.missingOptional ];

  if (mode === 'compact') {
    return (
      <Tooltip title={
        allMissing.length > 0 && config.showMissing
          ? `Missing: ${allMissing.join(', ')}`
          : `${quality.percentage}% complete`
      }>
        <Progress
          type="circle"
          percent={quality.percentage}
          size={24}
          strokeColor={color}
          format={() => null}
        />
      </Tooltip>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Tooltip title={`${quality.filledFields} of ${quality.totalFields} fields filled`}>
        <Progress
          type="circle"
          percent={quality.percentage}
          size={40}
          strokeColor={color}
          format={(pct) => <span style={{ fontSize: 11 }}>{pct}%</span>}
        />
      </Tooltip>
      <div>
        <Text strong style={{ fontSize: 13 }}>
          {getStatusIcon(quality.percentage)}{' '}
          {quality.percentage}% complete
        </Text>
        {config.showMissing && allMissing.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Missing:{' '}
              {allMissing.map(field => (
                <Tag key={field} color={quality.missingRequired.includes(field) ? 'red' : 'default'} style={{ fontSize: 11 }}>
                  {field}
                </Tag>
              ))}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};
