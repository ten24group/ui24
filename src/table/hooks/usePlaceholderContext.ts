import { useMemo } from 'react';
import { useAuth } from '../../core/context/AuthContext';
import { PlaceholderContext } from '../../core/utils/placeholderResolver';

/**
 * Hook to build placeholder context for resolving placeholders.
 * Centralizes the logic for building context with actor, routeParams, etc.
 * 
 * @param routeParams - Route parameters from URL
 * @param additionalContext - Additional context fields (record, parent, queryParams, etc.)
 * @returns PlaceholderContext for use with resolveFilterPlaceholders
 */
export function usePlaceholderContext(
  routeParams?: Record<string, string>,
  additionalContext?: Partial<PlaceholderContext>
): PlaceholderContext {
  const { user } = useAuth();

  return useMemo(() => ({
    actor: user ? {
      actorId: user.sub || user.id,
      email: user.email,
      username: user.username,
      groups: user['cognito:groups'] || user.groups,
      ...user,
    } : undefined,
    routeParams: routeParams || {},
    now: new Date(),
    ...additionalContext,
  }), [user, routeParams, additionalContext]);
}

