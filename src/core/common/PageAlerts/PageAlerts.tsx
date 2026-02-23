import React, { useState } from 'react';
import { Alert, Space } from 'antd';
import { useConditionBatch } from '../../hooks/useConditionBatch';
import type { IPageAlertConfig } from '../../types/field-config';
import { evaluateTemplate } from '../../utils/template';

interface PageAlertsProps {
  alerts: IPageAlertConfig[];
  /** Record data for condition evaluation and template interpolation */
  record?: Record<string, unknown>;
  /** Form values for condition evaluation */
  formValues?: Record<string, unknown>;
  /** Placement filter — only renders alerts matching this placement (default: 'top') */
  placement?: 'top' | 'bottom';
}

/**
 * Renders condition-driven inline alert banners on any page (#16).
 *
 * Each alert is independently evaluated: only alerts whose `visibility`
 * condition passes are shown. Template interpolation (`{fieldName}`) is
 * supported in `message` and `description`.
 *
 * Usage: drop at the top/bottom of any page wrapper component.
 */
export const PageAlerts: React.FC<PageAlertsProps> = ({
  alerts,
  record = {},
  formValues = {},
  placement = 'top',
}) => {
  // Track dismissals by index in the original `alerts` array (stable across re-renders)
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  // Keep stable alert-index pairs for all alerts matching this placement
  const placedAlerts = alerts
    .map((a, originalIdx) => ({ alert: a, originalIdx }))
    .filter(({ alert }) => (alert.placement ?? 'top') === placement);

  // Batch-evaluate all visibility conditions at once
  const conditions = placedAlerts.map(({ alert }) => alert.visibility);
  const evalContext = { record, formValues };
  const visibilityResults = useConditionBatch(conditions, evalContext);

  // Only keep alerts that pass their condition and haven't been dismissed
  const visibleAlerts = placedAlerts.filter(({ originalIdx }, i) => {
    if (dismissed.has(originalIdx)) return false;
    return visibilityResults[i] !== false;
  });

  if (visibleAlerts.length === 0) return null;

  const templateCtx = { ...record, ...formValues };

  return (
    <Space direction="vertical" style={{ width: '100%', marginBottom: placement === 'top' ? 16 : 0, marginTop: placement === 'bottom' ? 16 : 0 }}>
      {visibleAlerts.map(({ alert, originalIdx }) => (
        <Alert
          key={originalIdx}
          type={alert.type}
          message={evaluateTemplate(alert.message, templateCtx)}
          description={alert.description ? evaluateTemplate(alert.description, templateCtx) : undefined}
          closable={alert.closable}
          onClose={() => setDismissed(prev => new Set(prev).add(originalIdx))}
          showIcon
        />
      ))}
    </Space>
  );
};
