import React from 'react';
import type { ViewType } from './types';

interface ViewContainerProps {
  /** Currently active view type */
  activeView: ViewType;
  /** Table view component (always available) */
  tableView: React.ReactNode;
  /** Card grid view component (available when card-grid is configured) */
  cardGridView?: React.ReactNode;
  /** Kanban board view component (available when kanban is configured) */
  kanbanView?: React.ReactNode;
  /** Calendar view component (available when calendar is configured) */
  calendarView?: React.ReactNode;
  /** Tree view component (available when tree is configured) */
  treeView?: React.ReactNode;
  /** Map view component (available when map is configured) */
  mapView?: React.ReactNode;
}

/**
 * ViewContainer (#119) — Mounts the active view component.
 * All views share the same data source — switching views does not refetch data.
 */
export const ViewContainer: React.FC<ViewContainerProps> = ({
  activeView,
  tableView,
  cardGridView,
  kanbanView,
  calendarView,
  treeView,
  mapView,
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
      if (!kanbanView) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>Kanban view is not configured. Add kanbanConfig to viewSwitcher.</div>;
      }
      return <>{kanbanView}</>;

    case 'calendar':
      if (!calendarView) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>Calendar view is not configured. Add calendarConfig to viewSwitcher.</div>;
      }
      return <>{calendarView}</>;

    case 'tree':
      if (!treeView) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>Tree view is not configured. Add treeConfig to viewSwitcher.</div>;
      }
      return <>{treeView}</>;

    case 'map':
      if (!mapView) {
        return <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>Map view is not configured. Add mapConfig to viewSwitcher.</div>;
      }
      return <>{mapView}</>;

    default:
      return <>{tableView}</>;
  }
};
