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
  const dropdownItems: MenuProps[ 'items' ] = [
    ...secondaryMenuItems.map((item, index) => ({
      key: `secondary-${index}`,
      label: item.url ? <Link title={item.label} url={item.url} /> : item.label,
      icon: item.icon ? <Icon iconName={item.icon} /> : undefined,
      children: item.children?.map((child: any, childIdx: number) => ({
        key: `secondary-${index}-${childIdx}`,
        label: child.url ? <Link title={child.label} url={child.url} /> : child.label,
        icon: child.icon ? <Icon iconName={child.icon} /> : undefined,
      })),
    })),
    { type: 'divider' as const, key: 'divider-logout' },
    {
      key: 'logout',
      label: <LogoutButton />,
    },
  ];

  return <Dropdown menu={{ items: dropdownItems }} trigger={[ 'click' ]}>
    <a onClick={(e) => e.preventDefault()}>Admin <DownOutlined /></a>
  </Dropdown>
}