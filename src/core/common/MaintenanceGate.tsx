import React from 'react';
import { Result } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useUi24Config } from '../context/UI24Context';
import { useAuth } from '../context/AuthContext';

interface MaintenanceGateProps {
  children: React.ReactNode;
}

/**
 * Blocks rendering of children when maintenance mode is enabled,
 * unless the current user has a role listed in `allowedRoles`.
 * Reads user groups directly from AuthContext.
 */
export const MaintenanceGate: React.FC<MaintenanceGateProps> = ({ children }) => {
  const { config } = useUi24Config();
  const { user } = useAuth();
  const maintenance = config.maintenance;

  if (!maintenance?.enabled) {
    return <>{children}</>;
  }

  // Allow bypass for privileged roles (reads from Cognito JWT groups)
  if (maintenance.allowedRoles) {
    const userGroups = user?.['cognito:groups'] || user?.groups || [];
    const hasBypass = userGroups.some(role => maintenance.allowedRoles!.includes(role));
    if (hasBypass) return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Result
        icon={<ToolOutlined />}
        title="Under Maintenance"
        subTitle={maintenance.message || "We're performing scheduled maintenance. Please check back shortly."}
      />
    </div>
  );
};
