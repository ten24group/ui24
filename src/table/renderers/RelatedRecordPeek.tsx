/**
 * RelatedRecordPeek — hover popover that previews a related record's key fields.
 *
 * Uses:
 * - `useEntityConfig` to resolve the view-page config (for API URL + fields)
 * - `useEntityDetail` to fetch on demand (React Query caches it — second hover is instant)
 * - Ant Design `Popover` for the preview UI
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Popover, Descriptions, Spin, Typography } from 'antd';
import type { IEntityConfigReference } from '../../core/hooks/useEntityConfig';
import { useEntityConfig } from '../../core/hooks/useEntityConfig';
import { useEntityDetail } from '../../core/query';
import { Link } from '../../core/common';

const { Text } = Typography;

export interface RelatedRecordPeekProps {
  /** Wraps children with hover popover */
  children: React.ReactNode;
  /** Entity config reference (entity name + page type) */
  entityConfigRef: IEntityConfigReference;
  /** Resolved identifiers for this record (e.g., { teamId: 'abc-123' }) */
  identifiers: Record<string, string>;
  /** Direct link to full record page */
  detailUrl?: string;
  /** Fields to show (default: auto from entity config) */
  fields?: string[];
  /** Hover delay in ms. @default 300 */
  delay?: number;
  /** Popover placement. @default 'right' */
  placement?: 'right' | 'top' | 'auto';
  /** Max width in px. @default 400 */
  maxWidth?: number;
}

export const RelatedRecordPeek: React.FC<RelatedRecordPeekProps> = ({
  children,
  entityConfigRef,
  identifiers,
  detailUrl,
  fields: fieldOverrides,
  delay = 300,
  placement = 'right',
  maxWidth = 400,
}) => {
  const [hovered, setHovered] = useState(false);
  const { resolveConfigRef } = useEntityConfig();

  // Resolve view-page config for the related entity (cached by React — no re-resolution)
  const viewConfig = useMemo(() => {
    return resolveConfigRef({
      entityName: entityConfigRef.entityName,
      pageType: 'view',
    });
  }, [entityConfigRef.entityName, resolveConfigRef]);

  // Build API config from the resolved entity config
  const apiConfig = useMemo(() => {
    if (!viewConfig?.detailsPageConfig?.detailApiConfig) return null;
    return viewConfig.detailsPageConfig.detailApiConfig;
  }, [viewConfig]);

  // Pick which fields to show: explicit override > first N listable fields from config
  const displayFields = useMemo(() => {
    if (fieldOverrides?.length) return fieldOverrides;

    // Auto-pick from properties config (up to 6 fields)
    const props = viewConfig?.detailsPageConfig?.propertiesConfig;
    if (!Array.isArray(props)) return [];

    return props
      .filter((p: any) => {
        if (typeof p === 'string') return true;
        return p.isVisible !== false && p.hidden !== true;
      })
      .slice(0, 6)
      .map((p: any) => (typeof p === 'string' ? p : p.dataIndex || p.column || p.name));
  }, [fieldOverrides, viewConfig]);

  // Fetch related record (only when hovered + we have a valid URL)
  const { data, isLoading, error } = useEntityDetail({
    entityName: entityConfigRef.entityName,
    apiConfig: apiConfig ?? { apiUrl: '', apiMethod: 'GET' },
    routeParams: identifiers,
    enabled: hovered,
    staleTime: 60_000,
  });

  const handleOpenChange = useCallback((open: boolean) => {
    setHovered(open);
  }, []);

  // Build popover content
  const popoverContent = useMemo(() => {
    if (isLoading) {
      return (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      );
    }

    if (error || !data) {
      return (
        <div style={{ padding: '8px 0' }}>
          <Text type="secondary">Unable to load preview</Text>
        </div>
      );
    }

    // Extract the record from response (handle { data: record } or flat record)
    const record = data?.data ?? data;

    return (
      <div style={{ maxWidth }}>
        <Descriptions
          column={1}
          size="small"
          bordered={false}
          colon
          labelStyle={{ fontWeight: 500, color: 'rgba(0,0,0,0.65)', whiteSpace: 'nowrap' }}
          contentStyle={{ wordBreak: 'break-word' }}
        >
          {displayFields.map((field) => {
            const value = record?.[field];
            if (value === undefined || value === null) return null;

            // Format the label: camelCase → Title Case
            const label = field
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (s) => s.toUpperCase())
              .trim();

            return (
              <Descriptions.Item key={field} label={label}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Descriptions.Item>
            );
          })}
        </Descriptions>

        {detailUrl && (
          <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <Link url={detailUrl}>
              <Text style={{ fontSize: 12, color: '#1677ff' }}>View full record →</Text>
            </Link>
          </div>
        )}
      </div>
    );
  }, [data, isLoading, error, displayFields, maxWidth, detailUrl]);

  // If no API config available, just render children as-is
  if (!apiConfig) {
    return <>{children}</>;
  }

  return (
    <Popover
      content={popoverContent}
      title={null}
      trigger={['hover', 'focus']}
      mouseEnterDelay={delay / 1000}
      placement={placement === 'auto' ? undefined : placement}
      onOpenChange={handleOpenChange}
      destroyTooltipOnHide
    >
      <span style={{ cursor: 'pointer' }}>{children}</span>
    </Popover>
  );
};
