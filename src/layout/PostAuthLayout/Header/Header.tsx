import React, { useEffect } from 'react';
import { Icon } from '../../../core/common';
import type { MenuProps } from 'antd';
import { Menu as AntMenu } from 'antd';
import { Breadcrumb, Layout, theme } from 'antd';
import { Link } from '../../../core/common';
import "./Header.css";
import { UI24Config } from '../../../core';
import { HeaderActions } from './HeaderActions';
import { getMethod } from '../../../core';
import { mockApiResponse } from '../../../core';

const { Header : AntHeader } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

function createMenuItem(
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
  
const sampleItems: MenuProps['items'] = [
  createMenuItem('Sample', 'sub2', <Icon iconName="appStore" />, [
    createMenuItem(<Link title='Sample List' url = "/sampleList" />, '5'),
    createMenuItem(<Link title='Sample Form' url = "/sampleCreate" />, '6'),
  ])
];


const formatMenuItems = (menuItems: any) => {
    const items: MenuItem[] = [];
    menuItems.forEach((item: any) => {
        if (item.children) {
            items.push(createMenuItem(item.label, item.key, <Icon iconName={item.icon} />, formatMenuItems(item.children)));
        } else {
            items.push(createMenuItem(item.url ? <Link title={item.label} url={item.url} /> : item.label, item.key, <Icon iconName={item.icon} />));
        }
    });
    return items;
}

export const Header = () => {

    const [ menuItems, setMenuItems ] = React.useState<MenuItem[]>( formatMenuItems( UI24Config.uiConfig.menu ?? [] ) );

    return <AntHeader style={{ display: 'flex', background: 'white', alignItems: 'center' }}>
      <div className="appHeader">
        <div className="appLogo">
          { UI24Config?.appLogo !== "" && <a href="/"><div className="logo"><img src={UI24Config.appLogo} alt="App Logo" title="Logo" /></div></a> }
        </div>
        <div className="appMenu">
            <AntMenu
              style={{ width: "100%" }}
              theme="light"
              mode="horizontal"
              items={ menuItems.length > 0 ? menuItems : ( UI24Config.uiConfig.menu === "" ? sampleItems : []) }
          />
        </div>
        <div className="appActions">
          <HeaderActions />
        </div>
      </div>
  </AntHeader>
}