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
 * 
 * State Management:
 * - Segment selection is local component state
 * - Filter application uses parent's setFetchTrigger to avoid async state issues
 * - Mode switches trigger automatic filter re-application
 */

import React, { useMemo, useEffect } from 'react';
import { Segmented, Badge, ConfigProvider, theme } from 'antd';
import { IFilterSegment } from '../type';
import { resolveFilterPlaceholders, PlaceholderContext } from '../../core/utils/placeholderResolver';
import { useEvaluationBatch } from '../../core/hooks/useEvaluation';
import './FilterSegments.css';

interface FilterSegmentsProps {
  segments: Array<IFilterSegment>;
  isSearchMode: boolean;
  onSegmentChange: (segmentId: string, filters: Record<string, any>) => void;
  placeholderContext: PlaceholderContext;
  className?: string;
}

export const FilterSegments: React.FC<FilterSegmentsProps> = ({
  segments,
  isSearchMode,
  onSegmentChange,
  placeholderContext,
  className = '',
}) => {
  
  // Evaluate visibility for all segments
  const visibilityResults = useEvaluationBatch(
    segments.map(segment => segment.visibility)
  );
  
  // Filter segments by visibility
  const visibleSegments = useMemo(() => {
    return segments.filter((segment, index) => {
      const result = visibilityResults[index];
      return result?.visible !== false;
    });
  }, [segments, visibilityResults]);
  
  // Track active segment in state (not URL - segment state is ephemeral)
  const [activeSegmentId, setActiveSegmentId] = React.useState<string>(() => {
    // Find default segment on initial load
    const defaultSegment = visibleSegments.find(s => s.default);
    return defaultSegment?.id || visibleSegments[0]?.id;
  });
  
  // Resolve placeholders in all segment filters
  const resolvedSegments = useMemo(() => {
    return visibleSegments.map(segment => ({
      ...segment,
      resolvedFilters: resolveFilterPlaceholders(segment.filters, placeholderContext),
    }));
  }, [visibleSegments, placeholderContext]);
  
  // Track previous mode to re-apply filters when switching modes
  const prevModeRef = React.useRef(isSearchMode);
  const initialLoadRef = React.useRef(true);
  
  // Apply initial default segment filters on mount
  useEffect(() => {
    if (initialLoadRef.current && activeSegmentId) {
      initialLoadRef.current = false;
      const activeSegment = resolvedSegments.find(s => s.id === activeSegmentId);
      if (activeSegment) {
        onSegmentChange(activeSegmentId, activeSegment.resolvedFilters);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  // Re-apply segment filters when mode switches
  useEffect(() => {
    if (!activeSegmentId) return;
    
    // Check if mode changed
    const modeChanged = prevModeRef.current !== isSearchMode;
    prevModeRef.current = isSearchMode;
    
    // Only re-apply when mode changes (not on initial load or segment change)
    if (modeChanged) {
      const activeSegment = resolvedSegments.find(s => s.id === activeSegmentId);
      if (activeSegment) {
        onSegmentChange(activeSegmentId, activeSegment.resolvedFilters);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchMode]);
  
  // Handle segment selection - apply filters immediately
  const handleSegmentChange = (value: string | number) => {
    const segmentId = String(value);
    const segment = resolvedSegments.find(s => s.id === segmentId);
    
    if (segment) {
      // Update local state
      setActiveSegmentId(segmentId);
      
      // Apply filters immediately
      onSegmentChange(segmentId, segment.resolvedFilters);
    }
  };
  
  // Don't render if no visible segments
  if (visibleSegments.length === 0) {
    return null;
  }
  
  // Build segment options for Ant Design Segmented component
  // Supports custom rendering with badges for enhanced UX
  const options = resolvedSegments.map(segment => {
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
  
  const { token } = theme.useToken();

  return (
    <div className={`filter-segments ${className} `}>
      <ConfigProvider
        theme={{
          components: {
            Segmented: {
              itemSelectedColor: token.colorWhite,
              itemSelectedBg: token.colorPrimary,
              itemActiveBg: token.colorPrimary,
              trackPadding: 4,
            },
          },
        }}
      >
        <Segmented
          options={options}
          value={activeSegmentId}
          onChange={handleSegmentChange}
          size="large"
        />
      </ConfigProvider>
    </div>
  );
};

