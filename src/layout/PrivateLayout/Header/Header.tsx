import React, { useEffect } from 'react';
import { Icon } from '../../../core/common';
import type { MenuProps } from 'antd';
import { Menu as AntMenu, Layout, theme } from 'antd';
import {  } from 'antd';
import { Link } from '../../../core/common';
import "./Header.css";
import { HeaderActions } from './HeaderActions';
import { useUi24Config } from '../../../core/context';
import { OpenInModal } from '../../../modal/Modal';
import { JsonEditor } from '../../../core/common';

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


const formatMenuItems = (menuItems: any) => {
    const items: MenuItem[] = [];
    Array.isArray(menuItems) && menuItems.forEach((item: any) => {
        if (item.children) {
            items.push(createMenuItem(item.label, item.key, <Icon iconName={item.icon} />, formatMenuItems(item.children)));
        } else {
            items.push(createMenuItem(item.url ? <Link title={item.label} url={item.url} /> : item.label, item.key, <Icon iconName={item.icon} />));
        }
    });
    return items;
}

export const Header = () => {
    const { selectConfig, updateConfig } = useUi24Config()
    const appLogo = selectConfig( config => config.appLogo)
    const menuRecords = selectConfig( config => config.menuItems || [])
    const menuItems = formatMenuItems( menuRecords )

    const { useToken } = theme;
    const { token } = useToken();
    
    
    return <AntHeader style={{ display: 'flex', background: token.colorBgContainer, alignItems: 'center' }}>
      <div className="appHeader">
        <div className="appLogo">
          { appLogo !== "" && <Link url="/"><div className="logo"><img src={appLogo} alt="App Logo" title="Logo" /></div></Link> }
        </div>
        <div className="appMenu">
            <AntMenu
              style={{ width: "100%" }}
              theme="light"
              mode="horizontal"
              items={ menuItems.length > 0 ? menuItems : [] }
            />
            { process.env.REACT_APP_DEV_MODE && <OpenInModal modalType='custom' >
              <Icon iconName='edit' />
              <JsonEditor initObject={ menuRecords } onChange = { (newJson) => {
                updateConfig({ menuItems: newJson })
              }} />
            </OpenInModal> }
        </div>
        
        <div className="appActions">
          <HeaderActions />
        </div>
      </div>
  </AntHeader>
}