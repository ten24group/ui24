import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Divider, Popover, Radio, Switch, Tooltip, Typography } from 'antd';
import { ReloadOutlined, ClockCircleOutlined, DownOutlined, CheckCircleFilled, WarningFilled, ThunderboltFilled } from '@ant-design/icons';
import type { AutoRefreshInterval, UseAutoRefreshReturn } from '../hooks/useAutoRefresh';

const { Text } = Typography;

const COLOR = {
  fresh:   '#52c41a',
  aging:   '#8c8c8c',
  stale:   '#faad14',
  expired: '#ff4d4f',
  auto:    '#1677ff',
};

type FreshnessTier = 'fresh' | 'aging' | 'stale' | 'expired';

function getFreshnessTier(ageSeconds: number, staleThreshold: number): FreshnessTier {
  if (ageSeconds < 30) return 'fresh';
  if (ageSeconds < staleThreshold) return 'aging';
  if (ageSeconds < staleThreshold * 2) return 'stale';
  return 'expired';
}

function getTierColor(tier: FreshnessTier): string {
  return { fresh: COLOR.fresh, aging: COLOR.aging, stale: COLOR.stale, expired: COLOR.expired }[tier];
}

function formatTimeAgo(secondsAgo: number): string {
  if (secondsAgo < 5) return 'now';
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s`;
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatTimeAgoLong(secondsAgo: number): string {
  if (secondsAgo < 5) return 'just now';
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)} seconds ago`;
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getDisplayInterval(ageSeconds: number): number {
  if (ageSeconds < 60) return 10_000;
  if (ageSeconds < 300) return 30_000;
  return 60_000;
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${seconds}s`;
}

const INTERVAL_OPTIONS: Array<{ label: string; value: AutoRefreshInterval }> = [
  { label: '10s', value: 10 },
  { label: '20s', value: 20 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
];

interface RefreshControlProps {
  onRefresh: () => void;
  dataUpdatedAt?: string | Date | number | null;
  autoRefresh?: UseAutoRefreshReturn;
  staleThreshold?: number;
  size?: 'small' | 'middle' | 'large';
  maxLabelWidth?: number;
}

/**
 * Unified refresh control.
 *
 * Without auto-refresh: single icon button with short freshness label.
 * With auto-refresh: split-button — main click refreshes, caret opens settings popover.
 */
export const RefreshControl: React.FC<RefreshControlProps> = ({
  onRefresh,
  dataUpdatedAt,
  autoRefresh,
  staleThreshold = 300,
  size,
  maxLabelWidth = 72,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [relativeTimeLong, setRelativeTimeLong] = useState<string>('');
  const [tier, setTier] = useState<FreshnessTier>('aging');

  useEffect(() => {
    if (!dataUpdatedAt) return;

    let timerId: ReturnType<typeof setTimeout>;
    const update = () => {
      const tsMs = typeof dataUpdatedAt === 'number' ? dataUpdatedAt : new Date(dataUpdatedAt).getTime();
      const ageSeconds = (Date.now() - tsMs) / 1000;
      setRelativeTime(formatTimeAgo(ageSeconds));
      setRelativeTimeLong(formatTimeAgoLong(ageSeconds));
      setTier(getFreshnessTier(ageSeconds, staleThreshold));
      timerId = setTimeout(update, getDisplayInterval(ageSeconds));
    };
    update();
    return () => clearTimeout(timerId);
  }, [dataUpdatedAt, staleThreshold]);

  const handleRefreshClick = useCallback(() => onRefresh(), [onRefresh]);

  const handleIntervalChange = useCallback((value: AutoRefreshInterval) => {
    autoRefresh?.setInterval(value);
  }, [autoRefresh]);

  const handleToggle = useCallback((checked: boolean) => {
    if (checked !== autoRefresh?.isEnabled) {
      autoRefresh?.toggleEnabled();
    }
  }, [autoRefresh]);

  const isAutoEnabled = autoRefresh?.isEnabled ?? false;
  const isImminent = isAutoEnabled && (autoRefresh?.timeUntilRefresh ?? Infinity) <= 5;
  const tierColor = getTierColor(tier);
  const isStale = tier === 'stale' || tier === 'expired';

  // ── Tooltip (friendly, full text) ──────────────────────────────────
  const tooltipContent = useMemo(() => {
    const lines: React.ReactNode[] = [];

    if (relativeTimeLong) {
      const ico = tier === 'fresh'
        ? <CheckCircleFilled style={{ color: COLOR.fresh, fontSize: 11 }} />
        : tier === 'expired'
        ? <WarningFilled style={{ color: COLOR.expired, fontSize: 11 }} />
        : <ClockCircleOutlined style={{ color: tierColor, fontSize: 11 }} />;

      lines.push(
        <span key="f" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ico}
          <span>Updated {relativeTimeLong}</span>
        </span>
      );
    }

    if (isAutoEnabled && autoRefresh) {
      lines.push(
        <span key="a" style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLOR.auto }}>
          <ThunderboltFilled style={{ fontSize: 11 }} />
          <span>Refreshing in {formatCountdown(autoRefresh.timeUntilRefresh)}</span>
        </span>
      );
    }

    if (lines.length === 0) return 'Refresh';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, lineHeight: 1.5 }}>
        {lines}
      </div>
    );
  }, [relativeTimeLong, tier, tierColor, isAutoEnabled, autoRefresh]);

  // ── Label (short, truncated, colored) ──────────────────────────────
  const labelText = isAutoEnabled
    ? formatCountdown(autoRefresh!.timeUntilRefresh)
    : relativeTime || null;

  const labelColor = isAutoEnabled ? undefined : tierColor;

  const labelEl = labelText ? (
    <span style={{
      fontSize: 12,
      maxWidth: maxLabelWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'inline-block',
      verticalAlign: 'middle',
      color: labelColor,
    }}>
      {labelText}
    </span>
  ) : null;

  const buttonType = isAutoEnabled ? 'primary' as const : 'default' as const;
  const accentBorder: React.CSSProperties = !isAutoEnabled && isStale ? { borderColor: tierColor } : {};

  // ── Popover content ────────────────────────────────────────────────
  const popoverContent = autoRefresh ? (
    <div style={{ width: 224, padding: '6px 0' }}>

      {relativeTimeLong && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: tierColor, flexShrink: 0,
              transition: 'background 0.3s',
            }} />
            <Text style={{ fontSize: 13, color: tierColor, fontWeight: 500 }}>
              Updated {relativeTimeLong}
            </Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
        </>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 12px', marginBottom: 14,
      }}>
        <Text style={{ fontSize: 13, fontWeight: 600 }}>Auto-refresh</Text>
        <Switch size="small" checked={isAutoEnabled} onChange={handleToggle} />
      </div>

      <div style={{
        padding: '0 12px', paddingBottom: 6,
        opacity: isAutoEnabled ? 1 : 0.4,
        transition: 'opacity 0.2s',
        pointerEvents: isAutoEnabled ? 'auto' : 'none',
      }}>
        <Text type="secondary" style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
          marginBottom: 8, display: 'block',
        }}>
          Interval
        </Text>
        <Radio.Group
          value={autoRefresh.interval}
          onChange={(e) => handleIntervalChange(e.target.value)}
          size="small"
          optionType="button"
          buttonStyle="solid"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {INTERVAL_OPTIONS.map(opt => (
            <Radio.Button key={opt.value} value={opt.value} style={{ borderRadius: 4 }}>
              {opt.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>
    </div>
  ) : null;

  // ── Shared icon rendering ──────────────────────────────────────────
  const refreshIcon = isImminent
    ? <ThunderboltFilled style={{ color: COLOR.auto }} />
    : <ReloadOutlined />;

  // Freshness badge — sits after the label, not overlapping the icon
  const badge = dataUpdatedAt ? (
    <span style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tierColor,
      display: 'inline-block',
      flexShrink: 0,
      transition: 'background 0.3s',
      marginLeft: 2,
    }} />
  ) : null;

  // ── Simple button (no auto-refresh) ────────────────────────────────
  if (!autoRefresh) {
    return (
      <Tooltip title={tooltipContent} mouseEnterDelay={0.4}>
        <Button
          icon={refreshIcon}
          size={size}
          onClick={handleRefreshClick}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            ...accentBorder,
          }}
        >
          {labelEl}
          {badge}
        </Button>
      </Tooltip>
    );
  }

  // ── Split button (with auto-refresh dropdown) ──────────────────────
  return (
    <>
      <Button.Group>
        <Tooltip title={tooltipContent} mouseEnterDelay={0.4}>
          <Button
            icon={refreshIcon}
            type={buttonType}
            size={size}
            onClick={handleRefreshClick}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              transition: 'all 0.3s',
              animation: isImminent ? 'rc-pulse 1s ease-in-out infinite' : undefined,
              ...accentBorder,
            }}
          >
            {labelEl}
            {!isAutoEnabled && badge}
          </Button>
        </Tooltip>
        <Popover
          content={popoverContent}
          trigger="click"
          placement="bottomRight"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        >
          <Tooltip title={isAutoEnabled ? 'Auto-refresh settings' : 'Configure auto-refresh'} mouseEnterDelay={0.6}>
            <Button
              type={buttonType}
              size={size}
              icon={<DownOutlined style={{ fontSize: 10 }} />}
              style={{
                paddingInline: 8,
                ...accentBorder,
              }}
            />
          </Tooltip>
        </Popover>
      </Button.Group>
      <style>{`
        @keyframes rc-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
};
