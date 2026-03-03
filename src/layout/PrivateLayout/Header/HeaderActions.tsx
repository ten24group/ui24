import React, { useMemo } from 'react';
import { DownOutlined, SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown, Space, Tooltip } from 'antd';
import { useAuth, useUi24Config } from '../../../core/context';
import { Icon, Link } from "../../../core/common";
import { useThemePreference, setThemePreference, type ThemePreference } from '../../../core/stores/theme';

export const LogoutButton = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    logout()
  }

  return <Link onClick={handleLogout} title="Logout" ><Icon iconName="logout" /></Link>
}

interface HeaderActionsProps {
  secondaryMenuItems?: any[];
}

export const HeaderActions = ({ secondaryMenuItems = [] }: HeaderActionsProps) => {
  const { selectConfig } = useUi24Config();
  const themeConfig = selectConfig(config => config.theme);
  const currentPreference = useThemePreference();

  const showThemeSwitcher = themeConfig?.showSwitcher !== false;

  const handleThemeChange = (preference: ThemePreference) => {
    setThemePreference(preference);
  };

  const themeButtons = useMemo(() => {
    if (!showThemeSwitcher) return null;

    const preferences: Array<{ key: ThemePreference; icon: React.ReactNode; tooltip: string }> = [
      { key: 'light', icon: <SunOutlined />, tooltip: 'Light Mode' },
      { key: 'dark', icon: <MoonOutlined />, tooltip: 'Dark Mode' },
      { key: 'system', icon: <DesktopOutlined />, tooltip: 'System Theme' },
    ];

    return (
      <Space.Compact>
        {preferences.map(({ key, icon, tooltip }) => {
          const isActive = currentPreference === key;
          return (
            <Tooltip key={key} title={tooltip}>
              <a
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleThemeChange(key);
                }}
                style={{
                  padding: '4px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: isActive ? 1 : 0.5,
                  color: isActive ? 'var(--ant-color-primary)' : 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                {icon}
              </a>
            </Tooltip>
          );
        })}
      </Space.Compact>
    );
  }, [ currentPreference, showThemeSwitcher ]);

  const dropdownItems: MenuProps[ 'items' ] = useMemo(() => [
    ...secondaryMenuItems.map((item, index) => ({
      key: `secondary-${index}`,
      label: item.url ? <Link title={item.label} url={item.url} /> : item.label,
      icon: item.icon ? <Icon iconName={item.icon} /> : undefined,
      children: item.children?.map((child: any, childIdx: number) => ({
        key: `secondary-${index}-${childIdx}`,
        label: child.url ? <Link title={child.label} url={child.url} /> : child.label,
        icon: child.icon ? <Icon iconName={child.icon} /> : undefined,
      })),
    })),
    ...(showThemeSwitcher ? [
      { type: 'divider' as const, key: 'divider-theme' },
      {
        key: 'theme-selector',
        label: themeButtons,
      },
    ] : []),
    { type: 'divider' as const, key: 'divider-logout' },
    {
      key: 'logout',
      label: <LogoutButton />,
    },
  ], [ secondaryMenuItems, showThemeSwitcher, themeButtons ]);

  return (
    <Dropdown menu={{ items: dropdownItems }} trigger={[ 'click' ]}>
      <a onClick={(e) => e.preventDefault()}>Admin <DownOutlined /></a>
    </Dropdown>
  );
}