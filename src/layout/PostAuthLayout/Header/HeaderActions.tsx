import React from "react";
import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import { Icon } from "../../../core/common";
import { Link } from "../../../core/common";
import { Button } from 'antd';

const dropdownItems: MenuProps['items'] = [
    {
      label: <a href="./">Profile</a>,
      key: '0',
    },
    {
      label: <a href="./">Settings</a>,
      key: '1',
    },
    {
      type: 'divider',
    },
    {
      label: <Link url="/logout" title="Logout" ><Icon iconName="logout" /></Link>,
      key: '3',
    },
];

export const HeaderActions = () => {
    return <Dropdown menu={{ items: dropdownItems }} trigger={['click']}> 
        <a onClick={(e) => e.preventDefault()}>Admin <DownOutlined /></a>
      </Dropdown>
}