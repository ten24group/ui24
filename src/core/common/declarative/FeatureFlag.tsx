import React from 'react';
import { useCondition } from '../../hooks/useCondition';
import type { Condition } from '../../types/evaluation';

interface FeatureFlagProps {
  /** Feature flag name — evaluated against `featureFlags.{flag}` in the condition context */
  flag: string;
  /** Optional fallback to render when the feature is disabled */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when a feature flag is enabled.
 * Evaluates `featureFlags.{flag}.eq: true` against the condition context.
 * The evaluation context provides `featureFlags` (not `features`).
 * 
 * @example
 * <FeatureFlag flag="richText" fallback={<PlainTextEditor />}>
 *   <RichTextEditor />
 * </FeatureFlag>
 */
export const FeatureFlag: React.FC<FeatureFlagProps> = ({ flag, fallback = null, children }) => {
  const condition: Condition = {
    featureFlags: { [ flag ]: { eq: true } }
  };

  const isEnabled = useCondition(condition);

  if (isEnabled) return <>{children}</>;
  return <>{fallback}</>;
};
