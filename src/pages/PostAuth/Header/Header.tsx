import React from 'react';
import { Icon } from '../../../icons/icon';
import type { MenuProps } from 'antd';
import { Menu as AntMenu } from 'antd';
import { Breadcrumb, Layout, theme } from 'antd';
import { Link } from '../../../forms/PostAuthForm';
import "./Header.css";
import { FW24Config } from '../../../core';
import { HeaderActions } from './HeaderActions';

const { Header : AntHeader } = Layout;

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

getItem('Account', 'sub2', <Icon iconName="appStore" />, [
    getItem(<Link title='Account List' url = "/accountList" />, '5'),
    getItem(<Link title='Add New Account' url = "/accountCreate" />, '6'),
]),

{ type: 'divider' },

getItem('Submenu', 'sub4', <Icon iconName="settings" />, [
    getItem('Option 9', '9'),
    getItem('Option 10', '10'),
    getItem('Option 11', '11'),
    getItem('Option 12', '12'),
    getItem('Submenu', 'sub3', null, [getItem('Option 7', '7'), getItem('Option 8', '8')]),
])
];

export const Header = () => {
    
    const onClick: MenuProps['onClick'] = (e) => {
        console.log('click ', e);
    };

    console.log(items, " items ")

    return <><AntHeader style={{ display: 'flex', background: 'white', alignItems: 'center' }}>
      <div className="appHeader">
        <div className="appLogo">
          { FW24Config?.appLogo !== "" && <div className="logo"><img src={FW24Config.appLogo} alt="App Logo" title="Logo" /></div> }
        </div>
        <div className="appMenu">
            <AntMenu
              onClick={onClick}
              style={{ width: "100%" }}
              theme="light"
              mode="horizontal"
              items={items}
          />
        </div>
        <div className="appActions">
          <HeaderActions />
        </div>
      </div>
      
  </AntHeader>
  
  </>
}