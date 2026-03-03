import React from 'react';
import { Empty, Button, Typography } from 'antd';
import { PlusOutlined, FilterOutlined, LeftOutlined, FileExclamationOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface EmptyStateConfig {
  /** Custom illustration URL (applies to both variants) */
  image?: string;
  noData?: {
    title?: string;
    description?: string;
    action?: {
      label: string;
      /** URL to navigate to (for backend-driven config that can't send onClick functions) */
      url?: string;
      onClick?: () => void;
    };
  };
  noResults?: {
    title?: string;
    showClearFilters?: boolean;
  };
}

interface EmptyStateProps {
  /** Variant: 'noData' (zero records) or 'noResults' (filters active, no matches) */
  variant?: 'noData' | 'noResults';
  /** Plural entity name for contextual messaging (e.g., "Teams") */
  entityName?: string;
  /** Custom configuration */
  config?: EmptyStateConfig;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
  /** Navigation callback for url-based actions (provided by parent that has router access) */
  onNavigate?: (url: string) => void;
}

/**
 * Contextual empty state component with two variants:
 * - `noData`: Table has zero records total
 * - `noResults`: Filters are active but no records match
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'noData',
  entityName,
  config,
  onClearFilters,
  onNavigate,
}) => {
  const customImage = config?.image ? <img src={config.image} alt="empty" style={{ maxHeight: 120 }} /> : undefined;

  if (variant === 'noResults') {
    const noResultsConfig = config?.noResults;
    return (
      <Empty
        image={customImage || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {noResultsConfig?.title || 'No results match your filters'}
            </Text>
            <Text type="secondary">Try adjusting your filters or search criteria</Text>
          </div>
        }
      >
        {(noResultsConfig?.showClearFilters !== false) && onClearFilters && (
          <Button
            icon={<FilterOutlined />}
            onClick={onClearFilters}
            size="small"
          >
            Clear filters
          </Button>
        )}
      </Empty>
    );
  }

  const noDataConfig = config?.noData;
  const displayName = entityName || 'records';

  // Detect if this is a "not found" error vs. "no data" state
  const isNotFoundError = noDataConfig?.title?.toLowerCase().includes('not found');
  const isGoBackAction = noDataConfig?.action?.label?.toLowerCase().includes('back');

  return (
    <Empty
      image={customImage || (isNotFoundError ? <FileExclamationOutlined style={{ fontSize: 64, color: 'var(--ant-color-text-tertiary)' }} /> : Empty.PRESENTED_IMAGE_SIMPLE)}
      description={
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {noDataConfig?.title || `No ${displayName} found`}
          </Text>
          {noDataConfig?.description && (
            <Text type="secondary">{noDataConfig.description}</Text>
          )}
        </div>
      }
    >
      {noDataConfig?.action && (
        <Button
          type={isGoBackAction ? "default" : "primary"}
          icon={isGoBackAction ? <LeftOutlined /> : <PlusOutlined />}
          onClick={
            noDataConfig.action.onClick || (noDataConfig.action.url && onNavigate
              ? () => onNavigate(noDataConfig.action!.url!)
              : undefined
            )
          }
          size="small"
        >
          {noDataConfig.action.label}
        </Button>
      )}
    </Empty>
  );
};
