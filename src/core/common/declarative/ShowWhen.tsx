import React from 'react';
import { useCondition } from '../../hooks/useCondition';
import type { Condition } from '../../types/evaluation';

interface ShowWhenProps {
  /** Condition to evaluate — children render only when this evaluates to true */
  condition: Condition;
  /** Optional fallback to render when the condition is false */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Declarative condition wrapper — renders children only when the condition matches.
 * Uses the existing condition evaluation system (useCondition).
 * 
 * @example
 * <ShowWhen condition={{ subscription: { tier: { inList: ['pro'] } } }}>
 *   <AdvancedAnalytics />
 * </ShowWhen>
 */
export const ShowWhen: React.FC<ShowWhenProps> = ({ condition, fallback = null, children }) => {
  const result = useCondition(condition);

  if (result) return <>{children}</>;
  return <>{fallback}</>;
};
