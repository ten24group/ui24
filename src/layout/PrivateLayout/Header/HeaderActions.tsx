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

const dropdownItems: MenuProps['items'] = [
    // {
    //   label: <a href="./">Profile</a>,
    //   key: '0',
    // },
    // {
    //   label: <a href="./">Settings</a>,
    //   key: '1',
    // },
    // {
    //   type: 'divider',
    // },
    {
      key: '0',
      label: <LogoutButton/>,
    },
];

export const HeaderActions = () => {
  
    return <Dropdown menu={{ items: dropdownItems }} trigger={['click']}> 
        <a onClick={(e) => e.preventDefault()}>Admin <DownOutlined /></a>
      </Dropdown>
}