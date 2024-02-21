import { AppstoreOutlined, MailOutlined, SettingOutlined, PoweroffOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import React from 'react';


const IconConfig = {
    "appStore": <AppstoreOutlined />,
    "mail": <MailOutlined />,
    "settings": <SettingOutlined />,
    "logout" : <PoweroffOutlined />,
    "edit" : <EditOutlined />,
    "delete": <DeleteOutlined />
}

export const Icon = ( {iconName } : { iconName: string } ) : React.ReactNode => {
    return IconConfig[iconName];
}