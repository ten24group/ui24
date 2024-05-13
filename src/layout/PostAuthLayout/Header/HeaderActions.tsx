import React from "react";
import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import { Icon } from "../../../core/common";
import { Link } from "../../../core/common";
import { Button } from 'antd';
import { useAuth } from "../../../core";
import { useNavigate } from "react-router-dom";


export const LogoutButton = () => {

  const auth = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    auth.logOut();
    navigate('/login');
  }

  return <Link onClick={handleLogout} url="/logout" title="Logout" ><Icon iconName="logout" /></Link>
  
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