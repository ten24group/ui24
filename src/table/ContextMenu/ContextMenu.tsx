import React, { useState, useCallback, useEffect } from 'react';
import { Menu } from 'antd';
import type { IPageAction, IRecord } from '../type';
import { substituteUrlParams } from '../../core/utils';
import { evaluateTemplateValue } from '../../core/utils/template';
import { executeCopyToClipboard } from '../../core/utils/copyUtils';
import { Icon } from '../../core/common/Icons/Icons';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextMenuConfig {
  items: Array<IPageAction & { divider?: boolean }>;
}

interface ContextMenuState {
  visible: boolean;
  record: IRecord | null;
  x: number;
  y: number;
}

interface ContextMenuProps {
  config: ContextMenuConfig;
  routeParams: Record<string, string>;
  /** Condition evaluator for visibility rules */
  conditionEvaluator?: {
    evaluateSync: (condition: unknown, ctx: Record<string, unknown>) => boolean;
  };
  /** Context for condition evaluation (user, permissions, etc.) */
  evaluationContext?: Record<string, unknown>;
  /** Navigation function for internal links */
  onNavigate?: (url: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Reusable right-click context menu for table rows.
 *
 * Usage in a table component:
 * ```tsx
 * const ctxMenu = useTableContextMenu();
 * // In AntTable onRow:
 * onRow={(record) => ({ onContextMenu: (e) => ctxMenu.show(e, record) })}
 * // Render:
 * <TableContextMenu {...ctxMenu.menuProps} config={contextMenuConfig} ... />
 * ```
 */
export const TableContextMenu: React.FC<ContextMenuProps & {
  visible: boolean;
  record: IRecord | null;
  x: number;
  y: number;
  onClose: () => void;
}> = ({
  config,
  routeParams,
  conditionEvaluator,
  evaluationContext,
  onNavigate,
  visible,
  record,
  x,
  y,
  onClose,
}) => {
  // Close on outside click and Escape key
  useEffect(() => {
    if (!visible) return;
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible || !config.items.length || !record) return null;

  const context: Record<string, unknown> = { ...routeParams, ...record };

  return (
    <div
      style={{ position: 'fixed', top: y, left: x, zIndex: 1050 }}
      onClick={onClose}
    >
      <Menu
        style={{ borderRadius: 6, boxShadow: '0 3px 12px rgba(0,0,0,.15)', minWidth: 160 }}
        items={config.items.map((item, idx) => {
          if (item.divider) return { type: 'divider' as const, key: `divider-${idx}` };

          // Evaluate visibility condition
          if (item.visibility && conditionEvaluator) {
            try {
              const rawRecord = record.__raw__ || record;
              const isVisible = conditionEvaluator.evaluateSync(
                item.visibility,
                { ...evaluationContext, record: rawRecord }
              );
              if (!isVisible) return null;
            } catch { /* fail-safe: show the item */ }
          }

          const label = item.template
            ? evaluateTemplateValue(item.template, context, item.label)
            : item.label;

          return {
            key: item.id || `ctx-${idx}`,
            icon: item.icon ? <Icon iconName={item.icon} /> : undefined,
            label,
            onClick: () => {
              onClose();
              if (item.url) {
                const url = substituteUrlParams(item.url, context);
                if ((item.target === '_self' || item.openInModal) && onNavigate) {
                  onNavigate(url);
                } else {
                  window.open(url, '_blank');
                }
              }
              if (item.copyConfig) {
                executeCopyToClipboard([record], item.copyConfig);
              }
            },
          };
        }).filter(Boolean)}
      />
    </div>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook that manages context menu state for a table.
 * Returns `show` to trigger from `onRow.onContextMenu` and
 * props to spread onto `<TableContextMenu>`.
 */
export function useTableContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    visible: false, record: null, x: 0, y: 0,
  });

  const show = useCallback((e: React.MouseEvent, record: IRecord) => {
    e.preventDefault();
    setState({ visible: true, record, x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return {
    show,
    close,
    menuProps: {
      visible: state.visible,
      record: state.record,
      x: state.x,
      y: state.y,
      onClose: close,
    },
  };
}
