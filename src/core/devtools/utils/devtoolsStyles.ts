/**
 * Shared style constants for DevTools panels.
 *
 * Replaces hundreds of repeated inline style objects across all panel files.
 * All styles are plain CSSProperties objects — no runtime cost, single allocation.
 * Colors use CSS custom properties (var(--ant-color-*)) so they respond to
 * dark/light mode switching automatically.
 */
import type React from 'react';

type S = React.CSSProperties;

// ── Layout ─────────────────────────────────────────────────────

/** Full-height flex column container — used as the root of most panels */
export const panelRoot: S = { display: 'flex', flexDirection: 'column', height: '100%' };

/** Standard filter/toolbar bar at the top of a panel */
export const filterBar: S = { padding: '8px 12px', borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' };

/** Row with gap — used for toolbars, filter rows, etc. */
export const row = (gap = 8): S => ({ display: 'flex', alignItems: 'center', gap });

/** Scrollable content area that fills remaining space */
export const scrollArea: S = { flex: 1, overflow: 'auto', padding: '8px 12px' };

/** Padded content area (no flex) */
export const paddedContent: S = { padding: 12, display: 'flex', flexDirection: 'column', gap: 12 };

// ── Typography ─────────────────────────────────────────────────

/** Monospace text, 12px — for field names, code, keys */
export const mono12: S = { fontFamily: 'monospace', fontSize: 12 };

/** Monospace text, 11px — for smaller code values */
export const mono11: S = { fontFamily: 'monospace', fontSize: 11 };

/** Monospace text, 10px — for compact code, IDs */
export const mono10: S = { fontFamily: 'monospace', fontSize: 10 };

/** Secondary descriptive text */
export const textSecondary: S = { fontSize: 11, color: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))' };

/** Truncated single-line text */
export const truncate: S = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ── Cards / Containers ─────────────────────────────────────────

/** Bordered section card */
export const sectionCard: S = {
  border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
  borderRadius: 6,
  padding: 10,
};

/** Stats grid — 4 columns */
export const statsGrid: S = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  padding: '10px 12px',
  background: 'var(--ant-color-bg-layout, #fafafa)',
  borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
};

/** Tag style without margin (for inline tags) */
export const tagNoMargin: S = { margin: 0 };

/** Small tag style (fontSize 10) */
export const tagSmall: S = { margin: 0, fontSize: 10 };

/** Extra-small tag style (fontSize 9) */
export const tagXs: S = { margin: 0, fontSize: 9 };

// ── Colors ─────────────────────────────────────────────────────
// These are CSS variable strings — when used as `color:` or `background:` values
// in inline styles they resolve to the current theme's token values.

export const colors = {
  primary: 'var(--ant-color-primary, #1677ff)',
  success: 'var(--ant-color-success, #52c41a)',
  warning: 'var(--ant-color-warning, #faad14)',
  error: 'var(--ant-color-error, #ff4d4f)',
  purple: '#722ed1',
  orange: '#fa8c16',
  teal: '#13c2c2',
  border: 'var(--ant-color-border-secondary, #f0f0f0)',
  borderDark: 'var(--ant-color-border, #d9d9d9)',
  text: 'var(--ant-color-text, rgba(0, 0, 0, 0.88))',
  textSecondary: 'var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65))',
  textMuted: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
  textLight: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))',
  bgLight: 'var(--ant-color-bg-layout, #fafafa)',
} as const;
