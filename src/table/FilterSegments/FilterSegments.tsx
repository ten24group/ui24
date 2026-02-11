/**
 * @fileoverview Filter Segments Component
 * 
 * Provides quick filter tabs above tables for common filter sets (e.g., Active/Inactive/All).
 * Uses Ant Design's Segmented component for clean UI.
 * 
 * Features:
 * - Dynamic placeholder resolution (`:actor.actorId`, `:startOfToday`, etc.)
 * - Visibility evaluation for role-based/context-based segment display
 * - Multiple segment groups with independent filter state
 * - Reactive segment selection based on appliedFilters (derived state, not local)
 * 
 * State Management:
 * - Segment selection is DERIVED from appliedFilters (not local state)
 * - Active segment per group is computed by matching appliedFilters against segment filters
 * - When no filters match, falls back to empty-filter segments (e.g., "All")
 * - Segment changes update appliedFilters in parent, which triggers UI sync across all components
 * - Filter changes from other sources (URL, column filters, applied filters removal) automatically update segment UI
 */

import React, { useMemo, useEffect } from 'react';
import { Segmented, Badge, ConfigProvider, theme } from 'antd';
import { IFilterSegment, IFilterSegmentGroup } from '../type';
import { resolveFilterPlaceholders, PlaceholderContext } from '../../core/utils/placeholderResolver';
import { useEvaluatedItems } from '../../core/hooks/useEvaluatedItems';
import './FilterSegments.css';

interface FilterSegmentsProps {
  segments: Array<IFilterSegment | IFilterSegmentGroup>;
  isSearchMode: boolean;
  onSegmentChange: (segmentId: string, filtersToAdd: Record<string, any>, filtersToRemove: Record<string, any>) => void;
  placeholderContext: PlaceholderContext;
  className?: string;
  appliedFilters: Record<string, any>;
}

// Type guard to check if a segment is a group
function isSegmentGroup(segment: IFilterSegment | IFilterSegmentGroup): segment is IFilterSegmentGroup {
  return 'segments' in segment && Array.isArray(segment.segments);
}

// Helper to normalize filter values for comparison
// Handles the case where one is { eq: "value" } and the other is "value"
const getRawValue = (val: any) => {
  if (val && typeof val === 'object' && val !== null && 'eq' in val && Object.keys(val).length === 1) {
    return val.eq;
  }
  return val;
};

// Helper to check if filters match (subset check)
const filtersMatch = (segmentFilters: Record<string, any>, currentFilters: Record<string, any>): boolean => {
  const keys = Object.keys(segmentFilters);
  if (keys.length === 0) return false; // Empty filters handled separately (usually default)

  return keys.every(key => {
    const segVal = getRawValue(segmentFilters[ key ]);
    const curVal = getRawValue(currentFilters[ key ]);
    return JSON.stringify(segVal) === JSON.stringify(curVal);
  });
};

export const FilterSegments: React.FC<FilterSegmentsProps> = ({
  segments,
  isSearchMode,
  onSegmentChange,
  placeholderContext,
  className = '',
  appliedFilters,
}) => {
  // Don't render if no segments provided
  if (!segments || segments.length === 0) {
    return null;
  }

  // Detect if segments are grouped or flat
  const isGrouped = segments.length > 0 && isSegmentGroup(segments[ 0 ]);

  // Normalize to grouped format for consistent handling
  const segmentGroups: Array<IFilterSegmentGroup> = useMemo(() => {
    if (isGrouped) {
      // Already grouped
      return segments as Array<IFilterSegmentGroup>;
    } else {
      // Flat segments - wrap in a single group
      return [ {
        id: 'default-group',
        label: '', // No label for backwards compatibility
        segments: segments as Array<IFilterSegment>
      } ];
    }
  }, [ segments, isGrouped ]);

  // Flatten all segments for visibility evaluation
  const allSegments = useMemo(() => {
    return segmentGroups.flatMap(group => group.segments);
  }, [ segmentGroups ]);

  // Evaluate visibility for all segments using condition system
  const { visibilityResults: segmentVisResults } = useEvaluatedItems(allSegments);

  // Create visibility map
  const visibilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    allSegments.forEach((segment, index) => {
      map.set(segment.id, segmentVisResults[index]);
    });
    return map;
  }, [ allSegments, segmentVisResults ]);

  // Filter visible groups and their segments
  const visibleGroups = useMemo(() => {
    return segmentGroups.map(group => ({
      ...group,
      segments: group.segments.filter(seg => visibilityMap.get(seg.id) !== false)
    })).filter(group => group.segments.length > 0);
  }, [ segmentGroups, visibilityMap ]);

  // Resolve placeholders in all segments
  const resolvedGroups = useMemo(() => {
    return visibleGroups.map(group => ({
      ...group,
      segments: group.segments.map(segment => ({
        ...segment,
        resolvedFilters: resolveFilterPlaceholders(segment.filters, placeholderContext),
      }))
    }));
  }, [ visibleGroups, placeholderContext ]);

  // Derive active segment per group from appliedFilters
  // This creates a reactive UI - segments automatically highlight when filters match
  const activeSegmentsByGroup = useMemo(() => {
    const active: Record<string, string> = {};

    resolvedGroups.forEach(group => {
      // 1. Collect all filter keys controlled by this segment group
      // These are all keys that any segment in this group can set
      const controlledKeys = new Set<string>();
      group.segments.forEach(s => {
        Object.keys(s.resolvedFilters).forEach(k => controlledKeys.add(k));
      });

      // 2. Find segment whose filters exactly match current appliedFilters
      // Only considers segments with non-empty filters
      let match = group.segments.find(segment => {
        if (Object.keys(segment.resolvedFilters).length > 0) {
          return filtersMatch(segment.resolvedFilters, appliedFilters);
        }
        return false;
      });

      // 3. If no exact match, check if we should select an empty-filter segment
      // This handles the case where user removes all filters controlled by this group
      if (!match) {
        const hasControlledFilter = Array.from(controlledKeys).some(key =>
          appliedFilters[ key ] !== undefined
        );

        if (!hasControlledFilter) {
          // No controlled filters exist in appliedFilters, so select the "All" segment
          // Priority when no filters are applied:
          // 1. Empty-filter segment with default: true (e.g., "All" marked as default)
          // 2. First empty-filter segment (e.g., "All")
          // This ensures segments like "Root Spans" (with filters) don't get selected when filters are removed
          const emptySegments = group.segments.filter(s => Object.keys(s.resolvedFilters).length === 0);
          match = emptySegments.find(s => s.default) || emptySegments[ 0 ];
        }
      }

      // 4. Set active segment ID (or leave undefined if no match)
      // If custom filters exist that don't match any segment, no segment will be highlighted
      if (match) {
        active[ group.id ] = match.id;
      }
    });

    return active;
  }, [ resolvedGroups, appliedFilters ]);

  // Handle segment selection within a group
  // Calculates filters to add/remove and delegates to parent (Table.tsx)
  const handleSegmentChange = (groupId: string, segmentId: string) => {
    const group = resolvedGroups.find(g => g.id === groupId);
    if (!group) return;

    // Determine current active segment to remove its filters
    const currentActiveId = activeSegmentsByGroup[ groupId ];
    const currentSegment = group.segments.find(s => s.id === currentActiveId);

    // Determine new segment to add its filters
    const newSegment = group.segments.find(s => s.id === segmentId);

    if (newSegment) {
      const filtersToRemove = currentSegment ? currentSegment.resolvedFilters : {};
      const filtersToAdd = newSegment.resolvedFilters;

      // Parent (Table.tsx) handles the actual filter merging:
      // 1. Removes filters from previous segment
      // 2. Adds filters from new segment
      // 3. Restores default filters for removed keys (if any)
      // 4. Immediately calls fetchRecords with new filters to avoid stale closures

      onSegmentChange(segmentId, filtersToAdd, filtersToRemove);
    }
  };

  // Don't render if no visible groups
  if (visibleGroups.length === 0) {
    return null;
  }

  const { token } = theme.useToken();

  return (
    <div className={`filter-segments ${className}`}>
      <ConfigProvider
        theme={{
          components: {
            Segmented: {
              itemSelectedColor: token.colorPrimary,
            },
          },
        }}
      >
        <div
          className="filter-segments-container"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            alignItems: 'center',
            padding: '12px 0',
            marginBottom: '16px'
          }}
        >
          {resolvedGroups.map((group) => {
            // Build segment options for this group
            const options = group.segments.map(segment => {
              // If segment has a badge, render custom label with badge
              if (segment.badge !== undefined && segment.badge !== null) {
                return {
                  label: (
                    <span className="filter-segment-label">
                      <span>{segment.label}</span>
                      <Badge
                        count={segment.badge}
                        status={segment.badgeStatus}
                        showZero={false}
                        overflowCount={99}
                      />
                    </span>
                  ),
                  value: segment.id,
                };
              }

              // Simple label without badge
              return {
                label: segment.label,
                value: segment.id,
              };
            });

            const activeSegmentId = activeSegmentsByGroup[ group.id ];

            return (
              <div
                key={group.id}
                className="filter-segment-group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {group.label && (
                  <span
                    className="filter-segment-group-label"
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: token.colorTextSecondary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                  </span>
                )}
                <Segmented
                  options={options}
                  value={activeSegmentId}
                  onChange={(value) => handleSegmentChange(group.id, String(value))}
                  size="middle"
                />
              </div>
            );
          })}
        </div>
      </ConfigProvider>
    </div>
  );
};

