/**
 * MaintenancePage — full-screen maintenance mode gate (#86).
 * Rendered by PrivateLayout when config.maintenance.enabled is true
 * and the current user is not in config.maintenance.allowedRoles.
 */

import React from 'react';
import { Result, Button } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

interface MaintenancePageProps {
  message?: string;
  onRefresh?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  message = "We're performing scheduled maintenance. We'll be back shortly.",
  onRefresh,
}) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f5f5',
  }}>
    <Result
      icon={<ToolOutlined style={{ color: '#faad14' }} />}
      title="Down for Maintenance"
      subTitle={message}
      extra={onRefresh && (
        <Button type="primary" onClick={onRefresh}>
          Try Again
        </Button>
      )}
    />
  </div>
);
