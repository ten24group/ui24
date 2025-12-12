import * as AntdIcons from '@ant-design/icons';
import React from 'react';

// Helper function to create multiple naming variations for an icon name
const createIconVariations = (name: string): string[] => {
    const variations: string[] = [ name ];

    // Remove "Outlined", "Filled", "TwoTone" suffix for base name
    const baseName = name.replace(/(Outlined|Filled|TwoTone)$/, '');

    if (baseName !== name) {
        variations.push(baseName);
    }

    // Lowercase version (e.g., "sync")
    const lowercase = baseName.toLowerCase();
    if (!variations.includes(lowercase)) {
        variations.push(lowercase);
    }

    // Kebab-case version (e.g., "sync-outlined")
    const kebabCase = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    if (!variations.includes(kebabCase)) {
        variations.push(kebabCase);
    }

    // CamelCase version (e.g., "syncOutlined")
    const camelCase = name.charAt(0).toLowerCase() + name.slice(1);
    if (!variations.includes(camelCase)) {
        variations.push(camelCase);
    }

    return variations;
};

// Build comprehensive icon configuration from all Ant Design icons
const buildIconConfig = () => {
    const config: Record<string, React.ComponentType<any>> = {};

    // Iterate through all exported icons from @ant-design/icons
    Object.keys(AntdIcons).forEach((iconName) => {
        const IconComponent = (AntdIcons as any)[ iconName ];

        // Only process actual icon components (they should be functions/classes)
        if (typeof IconComponent === 'function' || typeof IconComponent === 'object') {
            // Skip non-icon exports like 'default', 'createFromIconfontCN', etc.
            if (iconName === 'default' ||
                iconName === 'createFromIconfontCN' ||
                iconName === 'IconProvider' ||
                iconName === 'getTwoToneColor' ||
                iconName === 'setTwoToneColor') {
                return;
            }

            // Create all naming variations for this icon
            const variations = createIconVariations(iconName);
            variations.forEach((variation) => {
                if (!config[ variation ]) {
                    config[ variation ] = IconComponent;
                }
            });
        }
    });

    // Add common aliases (these override auto-generated variations if conflicts exist)
    config[ 'settings' ] = AntdIcons.SettingOutlined;
    config[ 'logout' ] = AntdIcons.PoweroffOutlined;
    config[ 'view' ] = AntdIcons.EyeOutlined;
    config[ 'plus' ] = AntdIcons.PlusCircleOutlined;
    config[ 'more' ] = AntdIcons.MoreOutlined;
    config[ 'refresh' ] = AntdIcons.ReloadOutlined;
    config[ 'play' ] = AntdIcons.PlayCircleOutlined;
    config[ 'pause' ] = AntdIcons.PauseCircleOutlined;
    config[ 'warning' ] = AntdIcons.WarningOutlined;
    config[ 'error' ] = AntdIcons.CloseCircleOutlined;
    config[ 'success' ] = AntdIcons.CheckCircleOutlined;
    config[ 'info' ] = AntdIcons.InfoCircleOutlined;
    config[ 'question' ] = AntdIcons.QuestionCircleOutlined;
    config[ 'loading' ] = AntdIcons.LoadingOutlined;
    config[ 'appStore' ] = AntdIcons.AppstoreOutlined;

    return config;
};

const IconConfig = buildIconConfig();

export const Icon = ({ iconName }: { iconName?: string }): React.ReactNode => {
    if (!iconName) return <AntdIcons.QuestionCircleOutlined />;

    const IconComponent = IconConfig[ iconName ];
    if (!IconComponent) {
        console.warn(`[Icon] Unknown icon name: "${iconName}". Using fallback icon.`);
        return <AntdIcons.QuestionCircleOutlined />;
    }

    return <IconComponent />;
}
