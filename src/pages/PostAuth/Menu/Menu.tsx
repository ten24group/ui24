import React from 'react';
import { AppstoreOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu as AntMenu } from 'antd';
import { Link } from '../../../forms/PostAuthForm';

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
    label: React.ReactNode,
    key: React.Key,
    icon?: React.ReactNode,
    children?: MenuItem[],
    type?: 'group',
  ): MenuItem {
    return {
      key,
      icon,
      children,
      label,
      type,
    } as MenuItem;
}
  
const items: MenuProps['items'] = [

getItem('Account', 'sub2', <AppstoreOutlined />, [
    getItem(<Link title='Account List' url = "/accountList" />, '5'),
    getItem(<Link title='Add New Account' url = "/accountCreate" />, '6'),
]),

{ type: 'divider' },

getItem('Navigation With Submenu', 'sub4', <SettingOutlined />, [
    getItem('Option 9', '9'),
    getItem('Option 10', '10'),
    getItem('Option 11', '11'),
    getItem('Option 12', '12'),
    getItem('Submenu', 'sub3', null, [getItem('Option 7', '7'), getItem('Option 8', '8')]),
])
];

export const Menu = () => {
    
    const onClick: MenuProps['onClick'] = (e) => {
        console.log('click ', e);
    };

    return <AntMenu
      onClick={onClick}
      style={{ width: "100%" }}
      theme="dark"
      mode="horizontal"
      items={items}
  />
}