import React from 'react';
import { useCondition } from '../../hooks/useCondition';
import type { Condition } from '../../types/evaluation';
import { Forbidden } from '../../../pages/403/Forbidden';

interface RequireRoleProps {
  /** Array of roles that are allowed to see the children */
  roles: string[];
  /** Optional fallback to render when the user lacks the required role (default: Forbidden page) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has one of the specified roles.
 * Builds a condition using the `actor.groups` context path and `inList` operator.
 * When no fallback is provided, shows the Forbidden (403) page.
 * 
 * @example
 * <RequireRole roles={['admin']}>
 *   <AdminSettings />
 * </RequireRole>
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ roles, fallback, children }) => {
  const condition: Condition = {
    actor: { groups: { inList: roles } }
  };

  const hasRole = useCondition(condition);

  if (hasRole) return <>{children}</>;
  return <>{fallback !== undefined ? fallback : <Forbidden />}</>;
};
