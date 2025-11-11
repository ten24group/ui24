/**
 * @fileoverview Filter Segments Component
 * 
 * Provides quick filter tabs above tables for common filter sets (e.g., Active/Inactive/All).
 * Uses Ant Design's Segmented component for clean UI.
 * 
 * Features:
 * - Dynamic placeholder resolution (`:actor.actorId`, `:startOfToday`, etc.)
 * - Visibility evaluation for role-based/context-based segment display
 * - Automatic re-application of filters when switching between search/database modes
 * - Ephemeral state (not persisted in URL) for better UX
 * - Multiple segment groups with independent filter state
 * 
 * State Management:
 * - Segment selection is local component state (one per group)
 * - Each group manages its own filter state independently
 * - Filter application uses parent's setFetchTrigger to avoid async state issues
 * - Mode switches trigger automatic filter re-application
 */

import React, { useMemo, useEffect } from 'react';
import { Segmented, Badge, ConfigProvider, theme } from 'antd';
import { IFilterSegment, IFilterSegmentGroup } from '../type';
import { resolveFilterPlaceholders, PlaceholderContext } from '../../core/utils/placeholderResolver';
import { useEvaluationBatch } from '../../core/hooks/useEvaluation';
import './FilterSegments.css';

interface FilterSegmentsProps {
  segments: Array<IFilterSegment | IFilterSegmentGroup>;
  isSearchMode: boolean;
  onSegmentChange: (segmentId: string, filters: Record<string, any>) => void;
  placeholderContext: PlaceholderContext;
  className?: string;
}

// Type guard to check if a segment is a group
function isSegmentGroup(segment: IFilterSegment | IFilterSegmentGroup): segment is IFilterSegmentGroup {
  return 'segments' in segment && Array.isArray(segment.segments);
}

export const FilterSegments: React.FC<FilterSegmentsProps> = ({
  segments,
  isSearchMode,
  onSegmentChange,
  placeholderContext,
  className = '',
}) => {
  
  // Detect if segments are grouped or flat
  const isGrouped = segments.length > 0 && isSegmentGroup(segments[0]);
  
  // Normalize to grouped format for consistent handling
  const segmentGroups: Array<IFilterSegmentGroup> = useMemo(() => {
    if (isGrouped) {
      // Already grouped
      return segments as Array<IFilterSegmentGroup>;
    } else {
      // Flat segments - wrap in a single group
      return [{
        id: 'default-group',
        label: '', // No label for backwards compatibility
        segments: segments as Array<IFilterSegment>
      }];
    }
  }, [segments, isGrouped]);
  
  // Flatten all segments for visibility evaluation
  const allSegments = useMemo(() => {
    return segmentGroups.flatMap(group => group.segments);
  }, [segmentGroups]);
  
  // Evaluate visibility for all segments
  const visibilityResults = useEvaluationBatch(
    allSegments.map(segment => segment.visibility)
  );
  
  // Create visibility map
  const visibilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    allSegments.forEach((segment, index) => {
      const result = visibilityResults[index];
      map.set(segment.id, result?.visible !== false);
    });
    return map;
  }, [allSegments, visibilityResults]);
  
  // Filter visible groups and their segments
  const visibleGroups = useMemo(() => {
    return segmentGroups.map(group => ({
      ...group,
      segments: group.segments.filter(seg => visibilityMap.get(seg.id) !== false)
    })).filter(group => group.segments.length > 0);
  }, [segmentGroups, visibilityMap]);
  
  // Resolve placeholders in all segments
  const resolvedGroups = useMemo(() => {
    return visibleGroups.map(group => ({
      ...group,
      segments: group.segments.map(segment => ({
        ...segment,
        resolvedFilters: resolveFilterPlaceholders(segment.filters, placeholderContext),
      }))
    }));
  }, [visibleGroups, placeholderContext]);
  
  // Track active segment per group (Record<groupId, segmentId>)
  const [activeSegmentsByGroup, setActiveSegmentsByGroup] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    resolvedGroups.forEach(group => {
      const defaultSegment = group.segments.find(s => s.default) || group.segments[0];
      if (defaultSegment) {
        initial[group.id] = defaultSegment.id;
      }
    });
    return initial;
  });
  
  // Merge filters from all active segments
  const mergedFilters = useMemo(() => {
    let merged: Record<string, any> = {};
    resolvedGroups.forEach(group => {
      const activeSegmentId = activeSegmentsByGroup[group.id];
      const activeSegment = group.segments.find(s => s.id === activeSegmentId);
      if (activeSegment) {
        merged = { ...merged, ...activeSegment.resolvedFilters };
      }
    });
    return merged;
  }, [resolvedGroups, activeSegmentsByGroup]);
  
  // Track previous mode to re-apply filters when switching modes
  const prevModeRef = React.useRef(isSearchMode);
  const initialLoadRef = React.useRef(true);
  
  // Apply initial merged filters on mount
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      onSegmentChange('initial', mergedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  // Re-apply merged filters when mode switches
  useEffect(() => {
    // Check if mode changed
    const modeChanged = prevModeRef.current !== isSearchMode;
    prevModeRef.current = isSearchMode;
    
    // Only re-apply when mode changes (not on initial load)
    if (modeChanged) {
      onSegmentChange('mode-switch', mergedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchMode]);
  
  // Handle segment selection within a group
  const handleSegmentChange = (groupId: string, segmentId: string) => {
    // Update active segment for this group
    setActiveSegmentsByGroup(prev => ({
      ...prev,
      [groupId]: segmentId
    }));
    
    // Find the selected segment and merge all filters
    const group = resolvedGroups.find(g => g.id === groupId);
    const segment = group?.segments.find(s => s.id === segmentId);
    
    if (segment) {
      // Merge filters from all groups (with this group's new selection)
      let merged: Record<string, any> = {};
      resolvedGroups.forEach(g => {
        const activeId = g.id === groupId ? segmentId : activeSegmentsByGroup[g.id];
        const activeSeg = g.segments.find(s => s.id === activeId);
        if (activeSeg) {
          merged = { ...merged, ...activeSeg.resolvedFilters };
        }
      });
      
      // Apply merged filters
      onSegmentChange(segmentId, merged);
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
              itemSelectedColor: token.colorWhite,
              itemSelectedBg: token.colorPrimary,
              itemActiveBg: token.colorPrimary,
              trackPadding: 6,
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
            
            const activeSegmentId = activeSegmentsByGroup[group.id];
            
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
                  size="large"
                />
              </div>
            );
          })}
        </div>
      </ConfigProvider>
    </div>
  );
};

