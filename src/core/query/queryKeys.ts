/**
 * Structured query key factory for TanStack Query.
 * 
 * All query keys follow a hierarchical structure for targeted invalidation:
 *   ['entity', entityName] — invalidates ALL queries for an entity
 *   ['entity', entityName, 'list', { filters, sort, page }] — specific list query
 *   ['entity', entityName, 'detail', identifiers] — specific record
 *   ['entity', entityName, 'fieldOptions', fieldName, { search, cursor }] — field options
 *   ['sections', pageKey] — section/badge data
 */
export const queryKeys = {
  /** All entity queries (top-level, for broad invalidation) */
  entities: ['entity'] as const,

  entity: (entityName: string) => ({
    /** All queries for this entity */
    all: ['entity', entityName] as const,

    /** List queries */
    lists: () => ['entity', entityName, 'list'] as const,

    list: (params: {
      apiUrl: string;
      filters?: Record<string, any>;
      sort?: string;
      page?: number;
      cursor?: string;
      pageSize?: number;
      search?: string;
      attributes?: string;
    }) => ['entity', entityName, 'list', params] as const,

    /** Detail queries */
    details: () => ['entity', entityName, 'detail'] as const,

    detail: (identifiers: Record<string, string>) =>
      ['entity', entityName, 'detail', identifiers] as const,

    /** Field options queries */
    allFieldOptions: () => ['entity', entityName, 'fieldOptions'] as const,

    fieldOptions: (params: {
      apiUrl: string;
      fieldName?: string;
      search?: string;
      cursor?: string;
      filters?: Record<string, unknown>;
      deps?: Record<string, unknown>;
    }) => ['entity', entityName, 'fieldOptions', params] as const,
  }),

  /** Section/badge data queries */
  sections: (pageKey: string) => ['sections', pageKey] as const,
} as const;
