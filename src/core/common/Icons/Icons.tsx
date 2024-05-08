import { AppstoreOutlined, MailOutlined, SettingOutlined, PoweroffOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import React from 'react';


const IconConfig = {
    "appStore": <AppstoreOutlined />,
    "mail": <MailOutlined />,
    "settings": <SettingOutlined />,
    "logout" : <PoweroffOutlined />,
    "edit" : <EditOutlined />,
    "view" : <EyeOutlined />,
    "delete": <DeleteOutlined />,
    "plus": <PlusCircleOutlined />,
    "search": <SearchOutlined />
}

export const Icon = ( {iconName } : { iconName: string } ) : React.ReactNode => {
    return IconConfig[iconName];
}