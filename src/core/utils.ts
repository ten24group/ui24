import { Block, BlockNoteEditor } from "@blocknote/core";
import { dayjsCustom } from './dayjs';

export function isValidURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
  return !!pattern.test(str);
}

export function replaceAll(target: string, search: string, replacement: string) {
  return target.split(search).join(replacement);
}

/**
 * Remove trailing slash from a path/URL, preserving root path "/"
 * 
 * CRITICAL for AWS API Gateway signature calculation:
 * - API Gateway routes do NOT have trailing slashes
 * - URL normalization CAN add trailing slashes
 * - Signature mismatch = 403 Forbidden
 * 
 * @param path - Path or URL to strip trailing slash from
 * @returns Path without trailing slash (unless it's root "/")
 * 
 * @example
 * stripTrailingSlash('/admin/system/rebuild-index/') // '/admin/system/rebuild-index'
 * stripTrailingSlash('/admin/system/rebuild-index')  // '/admin/system/rebuild-index'
 * stripTrailingSlash('/')                            // '/'
 */
export function stripTrailingSlash(path: string): string {
  if (!path || path === '/' || !path.endsWith('/')) {
    return path;
  }
  return path.slice(0, -1);
}

export function addPathToUrl(baseURL: string, endpoint: string) {
  if (!isValidURL(baseURL)) {
    throw new Error(`Invalid base URL: ${baseURL}`);
  }

  // make sure base url ends with a slash
  if (!baseURL.endsWith('/')) {
    baseURL = `${baseURL}/`
  }

  // Clean up endpoint: remove duplicate slashes
  endpoint = replaceAll(`./${endpoint}`, '//', '/');
  endpoint = stripTrailingSlash(endpoint);

  // CRITICAL: Strip leading slash to make endpoint relative, not absolute
  // If endpoint starts with '/', new URL() treats it as absolute path and replaces baseURL path entirely
  // This would lose the /v1 prefix from baseURL!
  if (endpoint.startsWith('/')) {
    endpoint = endpoint.substring(1);
  }

  const newUrl = new URL(endpoint, baseURL);

  // Use centralized utility to strip trailing slash from final URL
  return stripTrailingSlash(newUrl.toString());
}

export function convertUTCDateToLocalDate(date: string | Date): Date {
  // Use dayjs to correctly handle UTC to local conversion
  return dayjsCustom.utc(date).local().toDate();
}

export async function getBlocksToHtml(blocks: Block[], editor?: BlockNoteEditor): Promise<string> {
  editor = editor || BlockNoteEditor.create({});

  const markup = await editor.blocksToHTMLLossy(blocks)

  return markup
}

export function isValidJson(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export const formatValue = (value: number | string | undefined, formatter?: (value: number | string) => string): string => {
  if (value === undefined || value === null) return '';
  return formatter ? formatter(value) : String(value);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Derive an entity name from an API URL for cache keying.
 * Extracts the last non-parameter path segment (e.g., '/api/teams/:teamId' -> 'teams').
 * Returns `entityName` directly if provided.
 */
export const deriveEntityName = (apiUrl?: string, entityName?: string): string => {
  if (entityName) return entityName;
  const url = apiUrl || '';
  const parts = url.split('/').filter(Boolean);
  const lastPart = parts[ parts.length - 1 ] || 'unknown';
  return lastPart.startsWith(':') ? (parts[ parts.length - 2 ] || 'unknown') : lastPart;
};

/**
 * Helper function to get nested property value using dot notation
 * @param obj - The object to search in
 * @param path - The dot-notation path (e.g., "stats.totalNbTasks")
 * @returns The value at the nested path or undefined if not found
 */
export const getNestedValue = (obj: any, path: string): any => {
  if (!path || !obj) return undefined;

  return path.split('.').reduce((current, key) => {
    return current && current[ key ] !== undefined ? current[ key ] : undefined;
  }, obj);
};

/**
 * Substitutes URL parameters in a URL string with values from routeParams or fallback identifier
 * @param url - The URL with parameters like "/api/users/:id" or "/system/search/indices/:entityName" or "/api/tasks?indexUid.eq=:indexInfo.uid"
 * @param routeParams - Object containing parameter values from route matching (e.g., {entityName: "syncStatus", indexInfo: {uid: "123"}})
 * @param fallbackIdentifier - Fallback value to use if parameter not found in routeParams
 * @returns URL with parameters substituted
 */
export const substituteUrlParams = (
  url: string,
  routeParams: Record<string, any> = {},
  fallbackIdentifier?: string | number
): string => {
  // Check if we have route parameters or an identifier to work with
  const hasRouteParams = routeParams && Object.keys(routeParams).length > 0;

  if (!hasRouteParams && !fallbackIdentifier) {
    return url; // No substitution possible
  }

  // Check if URL has placeholders (like :entityName, :id, :indexInfo.uid, :aaa.123.frfr.4545, etc.)
  // Support /:param (path), ^:param (start of string), and =:param (query string values)
  if (/(?:^|[/=]):([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)/.test(url)) {
    // Use parameter substitution for URLs with placeholders
    return url.replace(/(^|[/=]):([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)/g, (match, prefix, param) => {
      let value: any;

      // First try to get the parameter from routeParams (for simple params like :entityName)
      if (routeParams[ param ] !== undefined) {
        value = routeParams[ param ];
      }
      // Try to get nested value from routeParams (for nested params like :indexInfo.uid)
      else if (param.includes('.')) {
        const nestedValue = getNestedValue(routeParams, param);
        if (nestedValue !== undefined) {
          value = nestedValue;
        }
      }
      // Fallback to using the identifier (if available)
      else if (fallbackIdentifier !== undefined) {
        value = fallbackIdentifier;
      }

      // If no value found, keep the placeholder (will likely cause an error)
      if (value === undefined) {
        console.warn(`No value found for URL parameter ${param}`);
        return match;
      }

      // Return the value with the prefix (slash or empty string)
      return `${prefix}${String(value)}`;
    });
  } else if (fallbackIdentifier !== undefined) {
    // Legacy behavior: append identifier to URL (only if we have an identifier)
    return `${url}/${fallbackIdentifier}`;
  }

  return url;
};

/**
 * Extract placeholder parameter names from a URL pattern.
 * Companion to substituteUrlParams — uses the same placeholder syntax.
 *
 * @example
 * extractUrlParamNames('/admin/socialaccount/:id/health')        // ['id']
 * extractUrlParamNames('/admin/:teamId/posts/:postId')           // ['teamId', 'postId']
 * extractUrlParamNames('/api/:entityName?status=:status')        // ['entityName', 'status']
 * extractUrlParamNames('/admin/:indexInfo.uid')                  // ['indexInfo.uid']
 */
export const extractUrlParamNames = (urlPattern: string): string[] => {
  const names: string[] = [];
  const re = /(^|[/=]):([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)/g;
  let match;
  while ((match = re.exec(urlPattern)) !== null) {
    names.push(match[ 2 ]);
  }
  return names;
};

/**
 * Build a stable cache-key object from only the identifier and params referenced in a URL pattern.
 * Prevents query-key instability when routeParams contains extra data (e.g., record fields merged
 * by DetailPage for template resolution) that would otherwise change the TanStack Query key on
 * every fetch response and cause an infinite refetch loop.
 */
export const buildCacheIdentifiers = (
  urlPattern: string | undefined,
  routeParams: Record<string, any>,
  identifier?: string | number
): Record<string, string> => {
  const ids: Record<string, string> = {};
  if (identifier) ids.id = String(identifier);

  if (urlPattern && routeParams) {
    for (const paramName of extractUrlParamNames(urlPattern)) {
      let value = routeParams[ paramName ];
      if (value === undefined && paramName.includes('.')) {
        value = getNestedValue(routeParams, paramName);
      }
      if (value !== undefined && typeof value !== 'object') {
        ids[ paramName ] = String(value);
      }
    }
  }

  return ids;
};

export const formatKey = (key: string): string => {
  if (typeof key !== 'string') return '';
  // Convert camelCase or snake_case to a readable format
  const result = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

/**
 * Evaluates template strings in an object against a context object.
 * Used for pre-filling form fields from route params or record data.
 * 
 * Template syntax:
 * - Simple: `'{fieldName}'` → gets context.fieldName
 * - Nested: `'{team.name}'` → gets context.team.name
 * - Static: any non-template value is returned as-is
 * 
 * @param template - Object with potential template strings as values
 * @param context - Context object containing values (routeParams, record data, etc.)
 * @returns Object with template strings replaced by actual values
 * 
 * @example
 * const template = { teamId: '{teamId}', sport: '{sport}', isActive: true };
 * const context = { teamId: '123', sport: 'basketball' };
 * evaluateTemplateObject(template, context);
 * // Returns: { teamId: '123', sport: 'basketball', isActive: true }
 * 
 * @example
 * // Nested paths
 * const template = { teamName: '{team.name}', teamId: '{team.teamId}' };
 * const context = { team: { name: 'Lakers', teamId: 'lakers-123' } };
 * evaluateTemplateObject(template, context);
 * // Returns: { teamName: 'Lakers', teamId: 'lakers-123' }
 */
export const evaluateTemplateObject = (
  template: Record<string, any>,
  context: Record<string, any>
): Record<string, any> => {
  if (!template || typeof template !== 'object') {
    return {};
  }

  return Object.entries(template).reduce((acc, [ key, value ]) => {
    // Check if value is a template string: '{fieldName}' or '{field.nested.path}'
    if (typeof value === 'string' && value.match(/^\{[\w.]+\}$/)) {
      // Extract path from template: '{team.name}' → 'team.name'
      const path = value.slice(1, -1);

      // Try to get value from context
      const evaluatedValue = getNestedValue(context, path);

      // Only set the value if it's not undefined (allow null, false, 0, '')
      if (evaluatedValue !== undefined) {
        acc[ key ] = evaluatedValue;
      } else {
        // Template couldn't be evaluated, log warning
        console.warn(`[evaluateTemplateObject] Could not resolve template '${value}' for field '${key}'`);
      }
    } else {
      // Not a template string, use value as-is (static values, numbers, booleans, etc.)
      acc[ key ] = value;
    }

    return acc;
  }, {} as Record<string, any>);
};

/**
 * Matches a URL path against a route pattern
 * @param pattern - Route pattern with parameters, e.g., "/user/:userId/posts/:postId"
 * @param path - Actual URL path, e.g., "/user/123/posts/456"
 * @returns Object with extracted parameters or null if no match
 * @example
 * matchRoutePattern("/user/:userId", "/user/123") // { userId: "123" }
 * matchRoutePattern("/user/:userId/posts", "/user/123/orders") // null (no match)
 */
export function matchRoutePattern(pattern: string, path: string): Record<string, string> | null {
  // Remove leading and trailing slashes and split into segments
  const patternParts = pattern.replace(/^\/+|\/+$/g, '').split('/');
  const pathParts = path.replace(/^\/+|\/+$/g, '').split('/');

  // If the number of segments doesn't match, this isn't a match
  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  // Check each segment
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[ i ];
    const pathPart = pathParts[ i ];

    if (patternPart.startsWith(':')) {
      // This is a parameter - capture it (preserve original case)
      const paramName = patternPart.slice(1);
      params[ paramName ] = pathPart;
    } else if (patternPart.toLowerCase() !== pathPart.toLowerCase()) {
      // Static segment doesn't match (case-insensitive comparison)
      return null;
    }
  }

  return params;
}

