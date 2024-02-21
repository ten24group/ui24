import { AppstoreOutlined, MailOutlined, SettingOutlined, PoweroffOutlined } from '@ant-design/icons';
import React from 'react';


const IconConfig = {
    "appStore": <AppstoreOutlined />,
    "mail": <MailOutlined />,
    "settings": <SettingOutlined />,
    "logout" : <PoweroffOutlined />
}


export const Icon = ( {iconName } : { iconName: string } ) : React.ReactNode => {
    return IconConfig[iconName];
}