import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { queryKeys } from './queryKeys';
import { queryClient } from './QueryProvider';
import { deriveEntityName } from '../utils';

export interface UseEntityMutationOptions {
  /** Entity name — used to invalidate related caches on success */
  entityName: string;
  /** 
   * Additional entity names to invalidate on success.
   * Useful when a mutation affects related entities (e.g., creating a player invalidates team stats).
   */
  relatedEntities?: string[];
  /**
   * Custom invalidation callback. Called after default invalidation.
   * Use for complex invalidation logic that can't be expressed with entity names.
   */
  onInvalidate?: () => Promise<void>;
}

/**
 * React Query wrapper for entity mutations (create, update, delete, actions).
 * 
 * Automatically invalidates:
 * - All list queries for the entity
 * - All detail queries for the entity
 * - All field options for the entity (in case options changed)
 * - Related entity caches (if specified)
 * 
 * This hook does NOT replace OperationExecutor — it wraps the cache invalidation
 * layer. OperationExecutor handles success/error UI (toasts, redirects, modals).
 * 
 * Usage pattern:
 * 1. OperationExecutor calls callApiMethod for the mutation
 * 2. On success, call `invalidate()` from this hook to refresh caches
 * 3. Any mounted useEntityList/useEntityDetail/useFieldOptions will auto-refetch
 */
export function useEntityMutation({ entityName, relatedEntities = [], onInvalidate }: UseEntityMutationOptions) {
  const queryClient = useQueryClient();

  // Stabilize relatedEntities via JSON serialization so the useCallback below
  // doesn't re-create on every render due to a new array reference from the caller.
  const relatedEntitiesKey = JSON.stringify(relatedEntities);

  /**
   * Invalidate all caches related to this entity.
   * Call this after a successful mutation to ensure stale data is refreshed.
   */
  const invalidate = useCallback(async () => {
    const related: string[] = JSON.parse(relatedEntitiesKey);
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).all }),
      ...related.map(r =>
        queryClient.invalidateQueries({ queryKey: queryKeys.entity(r).all })
      ),
    ];

    await Promise.all(invalidations);

    if (onInvalidate) {
      await onInvalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ queryClient, entityName, relatedEntitiesKey, onInvalidate ]);

  /**
   * Invalidate only list queries (lighter-weight, for when detail data is unchanged).
   */
  const invalidateLists = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).lists() }),
    [ queryClient, entityName ]
  );

  /**
   * Invalidate only detail queries.
   */
  const invalidateDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).details() }),
    [ queryClient, entityName ]
  );

  /**
   * Invalidate only field options queries.
   */
  const invalidateFieldOptions = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).allFieldOptions() }),
    [ queryClient, entityName ]
  );

  return {
    invalidate,
    invalidateLists,
    invalidateDetails,
    invalidateFieldOptions,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Non-hook utilities — safe for class-based code (e.g., OperationExecutor)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate all React Query caches for a given entity name.
 * Uses the singleton queryClient, so no hook context is required.
 */
export function invalidateEntityCacheByName(entityName: string): Promise<void> {
  console.log('[invalidateEntityCacheByName] invalidating queryKey:', queryKeys.entity(entityName).all);
  return queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).all });
}

/**
 * Derive entity name from an API URL and invalidate its cache.
 * Walks backwards through URL segments to find the first non-parameter segment.
 *
 * @example
 * invalidateEntityCacheFromUrl('/api/team/:teamId')  // invalidates 'team'
 * invalidateEntityCacheFromUrl('/admin/player')       // invalidates 'player'
 */
export function invalidateEntityCacheFromUrl(apiUrl?: string): void {
  if (!apiUrl) return;

  const entityName = deriveEntityName(apiUrl);

  console.log('[invalidateEntityCacheFromUrl] apiUrl:', apiUrl, 'derived entityName:', entityName);

  if (entityName && entityName !== 'unknown') {
    invalidateEntityCacheByName(entityName);
  }
}
