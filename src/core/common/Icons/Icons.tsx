import { AppstoreOutlined, MailOutlined, SettingOutlined, PoweroffOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, CopyOutlined, EyeOutlined, SearchOutlined, ExportOutlined, ImportOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import React from 'react';


const IconConfig = {
    "appStore": <AppstoreOutlined />,
    "mail": <MailOutlined />,
    "settings": <SettingOutlined />,
    "logout": <PoweroffOutlined />,
    "edit": <EditOutlined />,
    "view": <EyeOutlined />,
    "delete": <DeleteOutlined />,
    "copy": <CopyOutlined />,
    "plus": <PlusCircleOutlined />,
    "search": <SearchOutlined />,
    "export": <ExportOutlined />,
    "import": <ImportOutlined />,
    "down": <DownOutlined />,
    "up": <UpOutlined />
}

export const Icon = ({ iconName }: { iconName: string }): React.ReactNode => {
    return IconConfig[ iconName ];
}