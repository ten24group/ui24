import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Space, Typography, theme, ConfigProvider } from 'antd';
import { DownOutlined, UpOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import * as AntIcons from '@ant-design/icons';
import type { CardProps } from 'antd';
import { useModalDepth } from '../../../modal/Modal';

const { Text } = Typography;
const { useToken } = theme;

interface CollapsibleSectionCardProps {
  id: string;
  title?: string;
  icon?: string | React.ReactNode;
  summary?: string;
  collapsed?: boolean;
  allowCollapse?: boolean;
  allowMaximize?: boolean;
  isHighlighted?: boolean;
  children: React.ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  size?: 'small' | 'default';
  styles?: CardProps[ 'styles' ];
}

export const CollapsibleSectionCard: React.FC<CollapsibleSectionCardProps> = ({
  id,
  title,
  icon,
  summary,
  collapsed: controlledCollapsed,
  allowCollapse = true,
  allowMaximize = true,
  isHighlighted = false,
  children,
  onCollapsedChange,
  size = 'small',
  styles,
}) => {
  const { token } = useToken();
  const modalDepth = useModalDepth();
  const [ localCollapsed, setLocalCollapsed ] = useState(controlledCollapsed ?? false);
  const [ maximized, setMaximized ] = useState(false);

  // Track if card has ever been expanded to preserve state after first expansion
  const [ hasBeenExpanded, setHasBeenExpanded ] = useState(!(controlledCollapsed ?? false));

  // Calculate z-index based on modal depth
  // Base modal z-index: 1000
  // Each modal layer adds 100
  // Maximized section should be above current modal
  const baseModalZIndex = 50;
  const backdropZIndex = baseModalZIndex + (modalDepth * 100) + 50;
  const cardZIndex = backdropZIndex + 1;

  // Sync with controlled collapsed prop and track expansion
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setLocalCollapsed(controlledCollapsed);
      // Mark as expanded if not collapsed
      if (!controlledCollapsed) {
        setHasBeenExpanded(true);
      }
    }
  }, [ controlledCollapsed ]);

  // Handle ESC key to close maximized view and manage body scroll lock
  useEffect(() => {
    if (!maximized) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // Prevent closing parent modal
        setMaximized(false);
      }
    };

    // Lock body scroll when maximized
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Check if scrollbar is present
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleEscape, true); // Use capture phase

    return () => {
      document.removeEventListener('keydown', handleEscape, true);
      // Restore body scroll
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [ maximized ]);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : localCollapsed;

  const handleToggleCollapse = useCallback((e?: React.MouseEvent, cardHeaderClicked?: boolean) => {
    e?.stopPropagation();

    // ignore teh header click when maximized
    if (maximized && cardHeaderClicked) {
      return;
    }

    // when maximized and the collapse button is clicked, minimize the card
    if (maximized) {
      setMaximized(false);
      return;
    }

    const newCollapsed = !collapsed;
    setLocalCollapsed(newCollapsed);

    // Mark as expanded when user expands the card
    if (!newCollapsed) {
      setHasBeenExpanded(true);
    }

    onCollapsedChange?.(newCollapsed);
  }, [ collapsed, maximized, onCollapsedChange ]);

  const handleToggleMaximize = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMaximized(prev => !prev);
  }, []);

  const cardActions: React.ReactNode[] = [];

  // Maximize action
  if (allowMaximize && !collapsed) {
    cardActions.push(
      <Button
        key="maximize"
        type="link"
        size="small"
        icon={maximized ? <CompressOutlined /> : <ExpandOutlined />}
        onClick={handleToggleMaximize}
        title={maximized ? 'Minimize' : 'Maximize'}
      />
    );
  }

  // Collapse action
  if (allowCollapse) {
    cardActions.push(
      <Button
        key="collapse"
        type="link"
        size="small"
        icon={collapsed ? <DownOutlined /> : <UpOutlined />}
        onClick={handleToggleCollapse}
        title={collapsed ? 'Expand' : 'Collapse'}
      />
    );
  }

  // Render icon from string name or React node
  const iconNode = useMemo(() => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'string' && (AntIcons as any)[ icon ]) {
      const IconComp = (AntIcons as any)[ icon ];
      return <IconComp />;
    }
    return null;
  }, [ icon ]);

  const cardTitle = (
    <div
      onClick={allowCollapse ? (e) => handleToggleCollapse(e, true) : undefined}
      style={{
        cursor: allowCollapse ? 'pointer' : 'default',
        userSelect: 'none',
        width: '100%',
      }}
    >
      <Space>
        {iconNode}
        {title}
        {collapsed && summary && (
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
            — {summary}
          </Text>
        )}
      </Space>
    </div>
  );

  const cardExtra = cardActions.length > 0 ? <Space size="small">{cardActions}</Space> : undefined;

  // CSS-only maximize: use fixed positioning instead of Modal
  // This keeps children in the same React tree = no state loss!
  // z-index is calculated based on modal depth for proper stacking
  const cardWrapperStyle: React.CSSProperties = maximized
    ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: backdropZIndex,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      padding: 16,
      overflow: 'auto',
    }
    : {};

  // Card style - clean, minimal borders
  const cardStyle: React.CSSProperties = maximized
    ? {
      height: '100%',
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: cardZIndex,
      ...(isHighlighted && {
        borderColor: token.colorPrimary,
        boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
      })
    }
    : {
      marginTop: 12,
      ...(isHighlighted && {
        borderColor: token.colorPrimary,
        boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
      })
    };

  // Body style - minimal padding, use display:none to hide after first expansion
  const cardBodyStyle: CardProps[ 'styles' ][ 'body' ] = maximized
    ? {
      flex: 1,
      overflow: 'auto',
      padding: 12,
    }
    : collapsed
      ? {
        display: 'none',
      }
      : {
        padding: '4px 8px', // Minimal padding, let content manage its own spacing
      };

  // Merge with passed styles prop
  const mergedCardStyles: CardProps[ 'styles' ] = {
    ...styles,
    body: cardBodyStyle
  };

  // Handle backdrop click to close maximized view
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (maximized && e.target === e.currentTarget) {
      setMaximized(false);
    }
  }, [ maximized ]);

  return (
    <ConfigProvider
      theme={{
        token: {
          // Slower, smoother motion
          motionDurationSlow: '0.4s',
          motionDurationMid: '0.3s',
          motionDurationFast: '0.2s',
        },
      }}
    >
      <div
        style={cardWrapperStyle}
        onClick={maximized ? handleBackdropClick : undefined}
      >
        <Card
          id={`section-card-${id}`}
          title={cardTitle}
          extra={cardExtra}
          size={maximized ? 'default' : size}
          style={cardStyle}
          styles={mergedCardStyles}
        >
          {/* 
            Smart lazy loading strategy:
            - First load when collapsed: Don't render (save resources)
            - After first expansion: Always render (preserve state), use CSS display:none to hide
            - Maximized: Always render
          */}
          {(hasBeenExpanded || !collapsed || maximized) && children}
        </Card>
      </div>
    </ConfigProvider>
  );
};

