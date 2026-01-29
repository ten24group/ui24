import React from 'react';
import { Alert, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface WidgetErrorProps {
  message: string;
  inline?: boolean;
}

/**
 * Converts technical error messages to user-friendly text
 */
const getUserFriendlyMessage = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Unable to load data';
  }
  if (lower.includes('timeout')) {
    return 'Request timed out';
  }
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return 'Session expired';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'Access denied';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'Data not found';
  }
  if (lower.includes('500') || lower.includes('server')) {
    return 'Server error';
  }
  if (lower.includes('missing') || lower.includes('required')) {
    return 'Configuration error';
  }
  return 'Failed to load';
};

/**
 * Compact error display for dashboard widgets
 */
export const WidgetError: React.FC<WidgetErrorProps> = ({ message, inline = false }) => {
  const friendlyMessage = getUserFriendlyMessage(message);

  if (inline) {
    return (
      <Text type="secondary" style={{ fontSize: 13 }}>
        <ExclamationCircleOutlined style={{ marginRight: 4, color: '#faad14' }} />
        {friendlyMessage}
      </Text>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      icon={<ExclamationCircleOutlined />}
      message={friendlyMessage}
      style={{
        borderRadius: 6,
        border: '1px solid #ffd591',
        backgroundColor: '#fffbe6',
      }}
    />
  );
};
