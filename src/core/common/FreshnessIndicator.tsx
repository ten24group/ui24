import React, { useState, useEffect, useCallback } from 'react';
import { Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

/** Compute a human-friendly relative time string from seconds ago. */
function formatTimeAgo(secondsAgo: number): string {
  if (secondsAgo < 5) return 'just now';
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Adaptive interval: faster when fresh, slower when old. */
function getRefreshInterval(ageSeconds: number): number {
  if (ageSeconds < 60) return 10_000;   // < 1 min: update every 10s
  if (ageSeconds < 300) return 30_000;  // 1-5 min: update every 30s
  return 60_000;                         // > 5 min: update every 60s
}

interface FreshnessIndicatorProps {
  /** Timestamp of last data update (ISO string or Date) */
  timestamp: string | Date | number | null | undefined;
  /** Threshold in seconds after which data is considered stale (default: 300 = 5min) */
  staleThreshold?: number;
  /** Whether to show the clock icon */
  showIcon?: boolean;
  /** Optional callback to refresh data — shows a clickable refresh icon when stale */
  onRefresh?: () => void;
}

/**
 * Displays a relative timestamp ("Updated 3m ago") that auto-updates.
 * Uses adaptive intervals: 10s when fresh, 30s mid-range, 60s when old.
 * Shows a clickable refresh icon when data is stale and onRefresh is provided.
 */
export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  timestamp,
  staleThreshold = 300,
  showIcon = true,
  onRefresh,
}) => {
  const [relativeTime, setRelativeTime] = useState<string>('');
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!timestamp) return;

    let timerId: ReturnType<typeof setTimeout>;

    const update = () => {
      const tsMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
      const ageSeconds = (Date.now() - tsMs) / 1000;
      setRelativeTime(formatTimeAgo(ageSeconds));
      setIsStale(ageSeconds > staleThreshold);
      // Schedule next update with adaptive interval
      timerId = setTimeout(update, getRefreshInterval(ageSeconds));
    };

    update();
    return () => clearTimeout(timerId);
  }, [timestamp, staleThreshold]);

  const handleRefreshClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRefresh?.();
    },
    [onRefresh]
  );

  if (!timestamp) return null;

  const tooltipTitle = isStale
    ? (onRefresh ? 'Data may be stale — click to refresh' : 'Data may be stale. Click refresh to reload.')
    : `Last updated ${relativeTime}`;

  return (
    <Tooltip title={tooltipTitle}>
      <Text
        type="secondary"
        onClick={isStale && onRefresh ? handleRefreshClick : undefined}
        style={{
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: isStale ? '#faad14' : undefined,
          cursor: isStale && onRefresh ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        }}
      >
        {showIcon && <ClockCircleOutlined style={{ fontSize: 11 }} />}
        {relativeTime}
        {isStale && onRefresh && (
          <ReloadOutlined style={{ fontSize: 11, marginLeft: 2 }} />
        )}
      </Text>
    </Tooltip>
  );
};
