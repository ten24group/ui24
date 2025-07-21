import React from 'react';
import { Button } from 'antd';

interface AppliedFiltersDisplayProps {
  hasActiveFilters: boolean;
  hasActiveSorts: boolean;
  DisplayAppliedFilters: React.FC;
  clearAllFilters: () => void;
  DisplayAppliedSorts: React.FC;
  clearAllSorts: () => void;
}

export const AppliedFiltersDisplay: React.FC<AppliedFiltersDisplayProps> = ({
  hasActiveFilters,
  hasActiveSorts,
  DisplayAppliedFilters,
  clearAllFilters,
  DisplayAppliedSorts,
  clearAllSorts
}) => {
  return ((hasActiveFilters || hasActiveSorts) && (
    <div style={{ marginBottom: '10px', padding: '10px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
      {hasActiveFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: hasActiveSorts ? '10px' : '0' }}>
          <DisplayAppliedFilters />
          <Button type="link" size="small" onClick={clearAllFilters} style={{ padding: 0, height: 'auto' }}>
            Clear Filters
          </Button>
        </div>
      )}
      {hasActiveSorts && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <DisplayAppliedSorts />
          <Button type="link" size="small" onClick={clearAllSorts} style={{ padding: 0, height: 'auto' }}>
            Clear Sorts
          </Button>
        </div>
      )}
    </div>
  )
  );
}; 