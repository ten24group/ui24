import React, { useMemo } from 'react';
import { Alert, Button, Flex, Popover, Space, Typography, theme } from 'antd';
import { InfoCircleTwoTone, QuestionCircleOutlined } from '@ant-design/icons';
import { useFormat } from '../hooks/useFormat';

export type TemporalFieldKind = 'date' | 'datetime' | 'time';

export interface DateTimeZoneChromeProps {
  value: unknown;
  kind: TemporalFieldKind;
  /** IANA zone used to interpret naive date/time strings from the API */
  sourceTimezone?: string;
  /** Table cells: tighter spacing */
  compact?: boolean;
  className?: string;
}

/** Popover grows with content; caps width so long lines wrap instead of clipping. */
const POPOVER_MAX_WIDTH = { compact: 400, default: 440 } as const;

/**
 * Read-only: stored raw value + popover with Original (source IANA), UTC if source is not a UTC zone,
 * and Local (browser IANA). Times use 12-hour AM/PM where applicable; no ISO string in the panel.
 */
export const DateTimeZoneChrome: React.FC<DateTimeZoneChromeProps> = ({
  value,
  kind,
  sourceTimezone,
  compact,
  className,
}) => {
  const { token } = theme.useToken();
  const { buildTemporalDisplay } = useFormat();

  const isEmpty = value === null || value === undefined || value === ''
    || (typeof value === 'string' && value.trim() === '');

  const labels = useMemo(() => {
    if (isEmpty) return null;
    return buildTemporalDisplay(value, kind, sourceTimezone);
  }, [ isEmpty, buildTemporalDisplay, value, kind, sourceTimezone ]);

  if (isEmpty || !labels) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  const popoverMax = compact ? POPOVER_MAX_WIDTH.compact : POPOVER_MAX_WIDTH.default;
  const popoverBody = {
    paddingBlock: token.paddingSM,
    paddingInline: token.paddingSM,
    maxWidth: popoverMax,
    width: 'max-content' as const,
    boxSizing: 'border-box' as const,
  };

  const valueTextStyle = {
    color: token.colorText,
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
  } as const;

  const popoverContent = labels.parseOk ? (
    <Flex vertical gap={token.marginSM} style={{ maxWidth: popoverMax }}>
      <TimeZoneBlock
        title={`Original (${labels.originalZone})`}
        token={token}
      >
        <Typography.Text strong style={valueTextStyle}>
          {labels.originalFormatted}
        </Typography.Text>
      </TimeZoneBlock>
      {labels.showUtcRow ? (
        <TimeZoneBlock title="UTC" token={token}>
          <Typography.Text strong style={valueTextStyle}>
            {labels.utcFormatted}
          </Typography.Text>
        </TimeZoneBlock>
      ) : null}
      {labels.showLocalRow ? (
        <TimeZoneBlock title={`Local (${labels.localZone})`} token={token}>
          <Typography.Text strong style={valueTextStyle}>
            {labels.localFormatted}
          </Typography.Text>
        </TimeZoneBlock>
      ) : null}
    </Flex>
  ) : (
    <Alert
      type="info"
      showIcon
      message="Could not parse as a date or time"
      description={
        <Typography.Text
          style={{
            fontSize: token.fontSize,
            color: token.colorText,
            wordBreak: 'break-all',
          }}
        >
          {labels.rawPrimary}
        </Typography.Text>
      }
      style={{ margin: 0, maxWidth: popoverMax }}
    />
  );

  return (
    <span aria-label={labels.ariaLabel}>
      <Space
        size={compact ? 'small' : 'middle'}
        align="center"
        className={className}
        style={{ maxWidth: '100%' }}
      >
        <Typography.Text
          ellipsis={compact ? { tooltip: labels.rawPrimary } : false}
          style={{
            margin: 0,
            maxWidth: compact ? token.sizeXXL * 4 : undefined,
            color: token.colorText,
            fontSize: token.fontSize,
          }}
        >
          {labels.rawPrimary}
        </Typography.Text>
        <Popover
          trigger="hover"
          mouseEnterDelay={0.2}
          placement={compact ? 'top' : 'topLeft'}
          styles={{ body: popoverBody }}
          content={popoverContent}
        >
          <Button
            type="text"
            size="small"
            icon={labels.parseOk ? <InfoCircleTwoTone /> : <QuestionCircleOutlined />}
            aria-label={labels.parseOk ? 'Date and time details' : 'About this value'}
          />
        </Popover>
      </Space>
    </span>
  );
};

type TimeZoneBlockProps = {
  title: string;
  token: ReturnType<typeof theme.useToken>[ 'token' ];
  children: React.ReactNode;
};

function TimeZoneBlock({ title, token, children }: TimeZoneBlockProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <Typography.Text
        type="secondary"
        style={{
          display: 'block',
          marginBottom: token.marginXXS,
          fontSize: token.fontSizeSM,
          lineHeight: token.lineHeightSM,
          color: token.colorTextSecondary,
          overflowWrap: 'anywhere',
        }}
      >
        {title}
      </Typography.Text>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
