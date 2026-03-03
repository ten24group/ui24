/**
 * Sparkline field type registrations (#31).
 * 
 * Renders compact charts inside table cells and detail views.
 * Powered by @ant-design/plots (Tiny chart variants).
 * 
 * Field types: sparkline-line, sparkline-area, sparkline-bar
 * 
 * Config example:
 * ```
 * { fieldType: 'sparkline-line', sparklineConfig: { color: '#1677ff', height: 32 } }
 * ```
 * 
 * The field value should be an array of numbers: [1, 3, 2, 5, 4, 7, 6]
 */

import React from 'react';
import type { BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

// Lazy-load @ant-design/plots to keep the main bundle size small
const TinyLineLazy = React.lazy(() =>
  import('@ant-design/plots').then(m => ({ default: m.Tiny.Line }))
);
const TinyAreaLazy = React.lazy(() =>
  import('@ant-design/plots').then(m => ({ default: m.Tiny.Area }))
);
const TinyColumnLazy = React.lazy(() =>
  import('@ant-design/plots').then(m => ({ default: m.Tiny.Column }))
);

interface SparklineConfig {
  color?: string;
  height?: number;
  smooth?: boolean;
}

function normalizeData(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(n => !isNaN(n));
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

function getSparklineConfig(config: Record<string, unknown>): SparklineConfig {
  const raw = config.sparklineConfig as SparklineConfig | undefined;
  return { color: '#1677ff', height: 32, smooth: true, ...raw };
}

// ---- Sparkline Line --------------------------------------------------------

const SparklineLineDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(config as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 100, display: 'inline-block' }}>…</span>}>
      <TinyLineLazy data={data} color={sc.color} height={sc.height ?? 40} smooth={sc.smooth} autoFit />
    </React.Suspense>
  );
};

const SparklineLineTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(column as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 80, display: 'inline-block' }}>…</span>}>
      <TinyLineLazy data={data} color={sc.color} height={sc.height ?? 32} smooth={sc.smooth} autoFit />
    </React.Suspense>
  );
};

// ---- Sparkline Area --------------------------------------------------------

const SparklineAreaDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(config as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 100, display: 'inline-block' }}>…</span>}>
      <TinyAreaLazy data={data} color={sc.color} height={sc.height ?? 40} smooth={sc.smooth} autoFit />
    </React.Suspense>
  );
};

const SparklineAreaTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(column as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 80, display: 'inline-block' }}>…</span>}>
      <TinyAreaLazy data={data} color={sc.color} height={sc.height ?? 32} smooth={sc.smooth} autoFit />
    </React.Suspense>
  );
};

// ---- Sparkline Bar ---------------------------------------------------------

const SparklineBarDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(config as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 100, display: 'inline-block' }}>…</span>}>
      <TinyColumnLazy data={data} color={sc.color} height={sc.height ?? 40} autoFit />
    </React.Suspense>
  );
};

const SparklineBarTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const data = normalizeData(value);
  if (data.length === 0) return <span>—</span>;
  const sc = getSparklineConfig(column as Record<string, unknown>);
  return (
    <React.Suspense fallback={<span style={{ width: 80, display: 'inline-block' }}>…</span>}>
      <TinyColumnLazy data={data} color={sc.color} height={sc.height ?? 32} autoFit />
    </React.Suspense>
  );
};

// ---- Registrations ---------------------------------------------------------

export const sparklineRegistrations: Record<string, FieldTypeRegistration> = {
  'sparkline-line': {
    detail: SparklineLineDetail,
    table: SparklineLineTable,
    defaults: { table: { width: 120 } },
  },
  'sparkline-area': {
    detail: SparklineAreaDetail,
    table: SparklineAreaTable,
    defaults: { table: { width: 120 } },
  },
  'sparkline-bar': {
    detail: SparklineBarDetail,
    table: SparklineBarTable,
    defaults: { table: { width: 120 } },
  },
};
