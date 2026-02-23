/**
 * Table constants and shared configuration
 */

/**
 * URL parameters that should be passed through to the API
 * (for backend debugging/testing)
 */
export const PASS_THROUGH_URL_PARAMS = [
  'debug',
  'trace',
  'mock',
  'test',
  'dev',
  'verbose',
  'dryRun'
] as const;

/**
 * URL parameters that should NOT be treated as filters.
 * These are either infrastructure params (pagination, search, etc.) 
 * or pass-through params for backend debugging.
 */
export const NON_FILTER_URL_PARAMS: readonly string[] = [
  // Infrastructure params (handled separately by table logic)
  'f',           // Form/filter UI state
  'page',        // Current page number
  'cursor',      // Pagination cursor
  'count',       // Items per page
  'q',           // Search query
  'sort',        // Sort configuration
  'attributes',  // Requested attributes
  'segment',     // Filter segment ID (UI state only)

  // Backend pass-through params (for debugging/testing)
  ...PASS_THROUGH_URL_PARAMS
];

