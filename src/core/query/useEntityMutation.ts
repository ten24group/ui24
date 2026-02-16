import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { queryKeys } from './queryKeys';

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

  /**
   * Invalidate all caches related to this entity.
   * Call this after a successful mutation to ensure stale data is refreshed.
   */
  const invalidate = useCallback(async () => {
    const invalidations = [
      // Invalidate all queries for the primary entity
      queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).all }),
      // Invalidate related entities
      ...relatedEntities.map(related =>
        queryClient.invalidateQueries({ queryKey: queryKeys.entity(related).all })
      ),
    ];

    await Promise.all(invalidations);

    // Custom invalidation callback
    if (onInvalidate) {
      await onInvalidate();
    }
  }, [queryClient, entityName, relatedEntities, onInvalidate]);

  /**
   * Invalidate only list queries (lighter-weight, for when detail data is unchanged).
   */
  const invalidateLists = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).lists() }),
    [queryClient, entityName]
  );

  /**
   * Invalidate only detail queries.
   */
  const invalidateDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).details() }),
    [queryClient, entityName]
  );

  /**
   * Invalidate only field options queries.
   */
  const invalidateFieldOptions = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).allFieldOptions() }),
    [queryClient, entityName]
  );

  return {
    invalidate,
    invalidateLists,
    invalidateDetails,
    invalidateFieldOptions,
  };
}
