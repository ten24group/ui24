import { FieldTimeOutlined, SyncOutlined, ThunderboltFilled } from '@ant-design/icons';
import { Button, Divider, Popover, Radio, Space, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import { AutoRefreshInterval } from '../hooks/useAutoRefresh';

const { Text } = Typography;

interface AutoRefreshSelectorProps {
  isEnabled: boolean;
  interval: AutoRefreshInterval;
  timeUntilRefresh: number;
  onToggle: () => void;
  onIntervalChange: (interval: AutoRefreshInterval) => void;
  onManualRefresh?: () => void;
  size?: 'small' | 'middle' | 'large';
}

const INTERVAL_OPTIONS: Array<{ label: string; value: AutoRefreshInterval }> = [
  { label: '10 sec', value: 10 },
  { label: '20 sec', value: 20 },
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];

/**
 * Auto-refresh selector component
 * 
 * Elegant single-button interface with popover for settings.
 * Features:
 * - Ghost button when disabled (minimal visual clutter)
 * - Shows interval in label when disabled
 * - Visual indicator when refresh is imminent
 * - Smooth animations and transitions
 */
export const AutoRefreshSelector: React.FC<AutoRefreshSelectorProps> = ({
  isEnabled,
  interval,
  timeUntilRefresh,
  onToggle,
  onIntervalChange,
  onManualRefresh,
  size = 'middle'
}) => {
  const [ popoverOpen, setPopoverOpen ] = useState(false);

  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${seconds}s`;
  };

  const getIntervalLabel = (sec: number): string => {
    if (sec < 60) return `${sec}s`;
    const mins = sec / 60;
    return `${mins}m`;
  };

  const handleIntervalChange = (value: AutoRefreshInterval) => {
    onIntervalChange(value);
  };

  const handleToggle = () => {
    onToggle();
    if (!isEnabled) {
      // If enabling, close popover after a brief moment
      setTimeout(() => setPopoverOpen(false), 300);
    }
  };

  // Check if refresh is imminent (< 5 seconds)
  const isImminent = isEnabled && timeUntilRefresh <= 5;

  const popoverContent = (
    <div style={{ width: 200 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Auto Refresh</Text>
          <Button
            size="small"
            type={isEnabled ? 'primary' : 'default'}
            onClick={handleToggle}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <Text type="secondary" style={{ fontSize: '12px' }}>Refresh Interval</Text>
        <Radio.Group
          value={interval}
          onChange={(e) => handleIntervalChange(e.target.value)}
          style={{ width: '100%' }}
          disabled={!isEnabled}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {INTERVAL_OPTIONS.map(option => (
              <Radio key={option.value} value={option.value} style={{ width: '100%' }}>
                {option.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Space>
    </div>
  );

  // Tooltip text
  const tooltipText = isEnabled
    ? `Auto-refresh enabled • Next refresh in ${formatTime(timeUntilRefresh)}`
    : `Auto-refresh disabled • Click to configure`;

  // Button label
  const buttonLabel = isEnabled
    ? formatTime(timeUntilRefresh)
    : `${getIntervalLabel(interval)}`;

  return (
    <Tooltip title={tooltipText} mouseEnterDelay={0.5}>
      <Popover
        content={popoverContent}
        trigger="click"
        placement="bottomRight"
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
      >
        <Button
          icon={isImminent ? <ThunderboltFilled /> : (isEnabled ? <FieldTimeOutlined /> : <SyncOutlined />)}
          type={isEnabled ? 'primary' : 'default'}
          size={size}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.3s ease',
            animation: isImminent ? 'pulse 1s ease-in-out infinite' : undefined,
          }}
        >
          {buttonLabel}
        </Button>
      </Popover>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </Tooltip>
  );
};
