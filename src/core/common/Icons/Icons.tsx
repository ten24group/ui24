import * as AntdIcons from '@ant-design/icons';
import React from 'react';

const SKIP_EXPORTS = new Set([
    'default', 'createFromIconfontCN', 'IconProvider',
    'getTwoToneColor', 'setTwoToneColor',
]);

/**
 * Create lookup variations for an icon export name.
 * e.g. "DeleteOutlined" → ["DeleteOutlined", "Delete", "delete", "delete-outlined", "deleteOutlined"]
 */
const createIconVariations = (name: string): string[] => {
    const variations: string[] = [ name ];
    const baseName = name.replace(/(Outlined|Filled|TwoTone)$/, '');

    if (baseName !== name) variations.push(baseName);

    const lowercase = baseName.toLowerCase();
    if (!variations.includes(lowercase)) variations.push(lowercase);

    const kebabCase = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    if (!variations.includes(kebabCase)) variations.push(kebabCase);

    const camelCase = name.charAt(0).toLowerCase() + name.slice(1);
    if (!variations.includes(camelCase)) variations.push(camelCase);

    return variations;
};

/**
 * Build icon config with **Outlined-first** priority.
 *
 * Problem: Object.keys iterates alphabetically, so "DeleteFilled" is
 * registered before "DeleteOutlined". With a naive first-write-wins
 * check, the short name "delete" maps to the Filled variant.
 *
 * Fix: Process Outlined icons first, then Filled, then TwoTone.
 * For short/base names (e.g. "delete", "edit"), the Outlined variant
 * always wins. Explicit full names (e.g. "DeleteFilled") still work.
 */
const buildIconConfig = () => {
    const config: Record<string, React.ComponentType<any>> = {};

    const allNames = Object.keys(AntdIcons).filter(n => !SKIP_EXPORTS.has(n));

    // Partition by suffix: Outlined first, then Filled, then TwoTone, then others
    const outlined: string[] = [];
    const filled: string[] = [];
    const twoTone: string[] = [];
    const other: string[] = [];

    for (const name of allNames) {
        if (name.endsWith('Outlined')) outlined.push(name);
        else if (name.endsWith('Filled')) filled.push(name);
        else if (name.endsWith('TwoTone')) twoTone.push(name);
        else other.push(name);
    }

    // Register in priority order — Outlined wins for shared short names
    const ordered = [...outlined, ...filled, ...twoTone, ...other];

    for (const iconName of ordered) {
        const IconComponent = (AntdIcons as any)[ iconName ];
        if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') continue;

        const variations = createIconVariations(iconName);
        for (const variation of variations) {
            if (!config[ variation ]) {
                config[ variation ] = IconComponent;
            }
        }
    }

    // Common aliases — always Outlined
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
