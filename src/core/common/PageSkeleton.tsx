import React from 'react';
import { Skeleton } from 'antd';

interface PageSkeletonProps {
  type: 'table' | 'form' | 'detail' | 'dashboard' | 'wizard';
  rows?: number;
  columns?: number;
}

/**
 * Table skeleton: mimics an antd Table with header + data rows.
 * Uses antd's standard Skeleton component for proper visual weight.
 * All columns use equal flex (uniform widths) matching real table column layout.
 * Caps visible columns to avoid overly dense layouts with many-column tables.
 */
const TableSkeleton: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => {
  const visibleCols = Math.min(columns, 6);

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', gap: 24, padding: '14px 12px',
        borderBottom: '2px solid #f0f0f0', marginBottom: 2,
      }}>
        {Array.from({ length: visibleCols }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <Skeleton active title={{ width: '60%' }} paragraph={false} />
          </div>
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{
          display: 'flex', gap: 24, padding: '12px 12px',
          borderBottom: '1px solid #f5f5f5',
        }}>
          {Array.from({ length: visibleCols }).map((_, colIdx) => (
            <div key={colIdx} style={{ flex: 1, minWidth: 0 }}>
              <Skeleton active title={{ width: '80%' }} paragraph={false} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Form skeleton: multi-column layout matching real antd form rendering.
 * Uses antd's standard Skeleton component for labels and a styled div for input fields.
 * Fields include varied heights for text inputs vs textareas for visual realism.
 */
const FormSkeleton: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => {
  const totalFields = rows;
  const fieldElements: React.ReactNode[] = [];
  const labelWidths = ['30%', '40%', '25%', '35%', '45%'];

  for (let i = 0; i < totalFields; i++) {
    const isTextarea = i % 5 === 3;

    fieldElements.push(
      <div key={i} style={{ marginBottom: 28 }}>
        {/* Label */}
        <Skeleton active title={{ width: labelWidths[i % labelWidths.length] }} paragraph={false} style={{ marginBottom: 8 }} />
        {/* Input field */}
        <div style={{
          height: isTextarea ? 72 : 36,
          borderRadius: 6,
          background: 'linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%)',
          backgroundSize: '200% 100%',
          animation: 'ant-skeleton-loading 1.4s ease infinite',
        }} />
      </div>
    );
  }

  const fieldsPerColumn = Math.ceil(totalFields / columns);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 32 }}>
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} style={{ flex: 1, minWidth: 0 }}>
            {fieldElements.slice(colIdx * fieldsPerColumn, (colIdx + 1) * fieldsPerColumn)}
          </div>
        ))}
      </div>
      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Skeleton.Button active style={{ width: 100, height: 36 }} />
        <Skeleton.Button active style={{ width: 80, height: 36 }} />
      </div>
    </div>
  );
};

/**
 * Detail skeleton: key-value description rows in multi-column layout.
 * Uses the same stacked label + value-bar pattern as FormSkeleton for
 * consistent visual weight. Value bars use a slightly shorter height (28px)
 * to differentiate from editable inputs, with a subtle background to
 * indicate read-only fields.
 */
const DetailSkeleton: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => {
  const totalFields = rows;
  const fieldElements: React.ReactNode[] = [];
  const labelWidths = ['30%', '40%', '25%', '35%', '45%'];
  const valueWidths = ['90%', '60%', '75%', '50%', '85%'];

  for (let i = 0; i < totalFields; i++) {
    fieldElements.push(
      <div key={i} style={{ marginBottom: 28 }}>
        {/* Label */}
        <Skeleton active title={{ width: labelWidths[i % labelWidths.length] }} paragraph={false} style={{ marginBottom: 8 }} />
        {/* Value bar (read-only appearance) */}
        <div style={{
          height: 28,
          width: valueWidths[i % valueWidths.length],
          borderRadius: 6,
          background: 'linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%)',
          backgroundSize: '200% 100%',
          animation: 'ant-skeleton-loading 1.4s ease infinite',
        }} />
      </div>
    );
  }

  const fieldsPerColumn = Math.ceil(totalFields / columns);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 32 }}>
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} style={{ flex: 1, minWidth: 0 }}>
            {fieldElements.slice(colIdx * fieldsPerColumn, (colIdx + 1) * fieldsPerColumn)}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Dashboard skeleton: card grid */
const DashboardSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
    {Array.from({ length: columns * 2 }).map((_, i) => (
      <div key={i} style={{ padding: 20, borderRadius: 8, border: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Skeleton.Input active size="small" style={{ width: '60%', height: 14, marginBottom: 12 }} />
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      </div>
    ))}
  </div>
);

/** Wizard skeleton: step indicator bar + form fields */
const WizardSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div style={{ padding: '8px 0' }}>
    {/* Step indicator bar */}
    <div style={{ display: 'flex', gap: 24, marginBottom: 32, justifyContent: 'center' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Skeleton.Avatar active size="small" />
          <Skeleton.Input active size="small" style={{ width: 60, height: 12 }} />
        </div>
      ))}
    </div>
    {/* Form content area */}
    <FormSkeleton rows={rows} columns={1} />
  </div>
);

/**
 * Shape-aware skeleton loader that matches the layout of the actual page content.
 * Use instead of generic `<Skeleton paragraph={{ rows: N }} />`.
 */
export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  type,
  rows,
  columns,
}) => {
  switch (type) {
    case 'table':
      return <TableSkeleton rows={rows ?? 8} columns={columns ?? 5} />;
    case 'form':
      return <FormSkeleton rows={rows ?? 6} columns={columns ?? 2} />;
    case 'detail':
      return <DetailSkeleton rows={rows ?? 6} columns={columns ?? 2} />;
    case 'dashboard':
      return <DashboardSkeleton columns={columns ?? 3} />;
    case 'wizard':
      return <WizardSkeleton rows={rows ?? 4} />;
    default:
      return <Skeleton active paragraph={{ rows: rows ?? 8 }} />;
  }
};
