import React from 'react';
import { DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';
import { useAuth } from '../../../core/context';
import { Icon, Link } from "../../../core/common";

export const LogoutButton = () => {
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    logout()
  }

  return <Link onClick={handleLogout} title="Logout" ><Icon iconName="logout" /></Link>
}

interface HeaderActionsProps {
  secondaryMenuItems?: any[];
}

export const HeaderActions = ({ secondaryMenuItems = [] }: HeaderActionsProps) => {
  const dropdownItems: MenuProps['items'] = [
    // Add secondary menu items first
    ...secondaryMenuItems.map((item, index) => ({
      key: `secondary-${index}`,
      label: item.url ? <Link title={item.label} url={item.url} /> : item.label,
      icon: item.icon ? <Icon iconName={item.icon} /> : undefined,
    })),
    // Add divider if there are secondary items
    ...(secondaryMenuItems.length > 0 ? [{ type: 'divider' as const }] : []),
    // Add logout button
    {
      key: 'logout',
      label: <LogoutButton/>,
    },
  ];
  
  return <Dropdown menu={{ items: dropdownItems }} trigger={['click']}> 
      <a onClick={(e) => e.preventDefault()}>Admin <DownOutlined /></a>
    </Dropdown>
}