import React from 'react';
import type { ViewType } from './types';

interface ViewContainerProps {
  /** Currently active view type */
  activeView: ViewType;
  /** Table view component (always available) */
  tableView: React.ReactNode;
  /** Card grid view component (available when card-grid is configured) */
  cardGridView?: React.ReactNode;
}

/**
 * ViewContainer (#119) — Mounts the active view component.
 * Passes shared data and filter state to whichever view is active.
 * 
 * Currently supported views:
 * - table: Full antd Table (always available)
 * - card-grid: CardView component (available when cardConfig is provided)
 * - kanban, calendar, map: Placeholder slots for future implementations
 * 
 * @example
 * <ViewContainer
 *   activeView={viewState.activeView}
 *   tableView={<AntTable ... />}
 *   cardGridView={<CardView ... />}
 * />
 */
export const ViewContainer: React.FC<ViewContainerProps> = ({
  activeView,
  tableView,
  cardGridView,
}) => {
  switch (activeView) {
    case 'table':
      return <>{tableView}</>;

    case 'card-grid':
      if (!cardGridView) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>Card grid view is not configured for this entity.</div>;
      }
      return <>{cardGridView}</>;

    case 'kanban':
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
          Kanban view is not yet implemented. Register a custom kanban component via ExtensionRegistry.
        </div>
      );

    case 'calendar':
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
          Calendar view is not yet implemented. Register a custom calendar component via ExtensionRegistry.
        </div>
      );

    case 'map':
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
          Map view is not yet implemented. Register a custom map component via ExtensionRegistry.
        </div>
      );

    default:
      return <>{tableView}</>;
  }
};
