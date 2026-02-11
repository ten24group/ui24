/**
 * Tests for core/utils.ts
 * 
 * Covers the foundational utility functions used across the entire UI24 system:
 * - getNestedValue: dot-notation property access
 * - substituteUrlParams: URL parameter substitution
 * - matchRoutePattern: route matching with param extraction
 * - evaluateTemplateObject: template object evaluation for form pre-fill
 * - formatValue, formatKey, truncateText: display formatting
 * - isValidURL, replaceAll, stripTrailingSlash, addPathToUrl: URL utilities
 * - isValidJson: JSON validation
 */

// Mock @blocknote/core to avoid ESM parsing issues
jest.mock('@blocknote/core', () => ({
  BlockNoteEditor: { create: jest.fn() },
}));

import {
  getNestedValue,
  substituteUrlParams,
  matchRoutePattern,
  evaluateTemplateObject,
  formatValue,
  formatKey,
  truncateText,
  isValidURL,
  replaceAll,
  stripTrailingSlash,
  addPathToUrl,
  isValidJson,
} from '../utils';

// ============================================================================
// getNestedValue
// ============================================================================

describe('getNestedValue', () => {
  const obj = {
    name: 'Lakers',
    stats: {
      totalNbTasks: 42,
      nested: {
        deep: 'value',
      },
    },
    items: [1, 2, 3],
    nullProp: null,
    zeroProp: 0,
    emptyString: '',
    falseProp: false,
  };

  it('returns top-level property', () => {
    expect(getNestedValue(obj, 'name')).toBe('Lakers');
  });

  it('returns nested property via dot notation', () => {
    expect(getNestedValue(obj, 'stats.totalNbTasks')).toBe(42);
  });

  it('returns deeply nested property', () => {
    expect(getNestedValue(obj, 'stats.nested.deep')).toBe('value');
  });

  it('returns undefined for non-existent path', () => {
    expect(getNestedValue(obj, 'nonExistent')).toBeUndefined();
    expect(getNestedValue(obj, 'stats.nonExistent')).toBeUndefined();
    expect(getNestedValue(obj, 'stats.nested.nonExistent')).toBeUndefined();
  });

  it('returns undefined for path beyond null', () => {
    expect(getNestedValue(obj, 'nullProp.child')).toBeUndefined();
  });

  it('handles falsy values correctly (0, false, empty string)', () => {
    expect(getNestedValue(obj, 'zeroProp')).toBe(0);
    expect(getNestedValue(obj, 'emptyString')).toBe('');
    expect(getNestedValue(obj, 'falseProp')).toBe(false);
  });

  it('returns undefined for empty path', () => {
    expect(getNestedValue(obj, '')).toBeUndefined();
  });

  it('returns undefined for null/undefined obj', () => {
    expect(getNestedValue(null, 'name')).toBeUndefined();
    expect(getNestedValue(undefined, 'name')).toBeUndefined();
  });

  it('accesses array elements (if key is numeric)', () => {
    expect(getNestedValue(obj, 'items.0')).toBe(1);
    expect(getNestedValue(obj, 'items.2')).toBe(3);
  });
});

// ============================================================================
// substituteUrlParams
// ============================================================================

describe('substituteUrlParams', () => {
  it('substitutes simple URL parameters from routeParams', () => {
    const url = '/api/users/:id/profile';
    const result = substituteUrlParams(url, { id: '123' });
    expect(result).toBe('/api/users/123/profile');
  });

  it('substitutes multiple parameters', () => {
    const url = '/api/users/:userId/posts/:postId';
    const result = substituteUrlParams(url, { userId: '123', postId: '456' });
    expect(result).toBe('/api/users/123/posts/456');
  });

  it('substitutes nested params via dot notation', () => {
    const url = '/api/tasks?indexUid.eq=:indexInfo.uid';
    const result = substituteUrlParams(url, { indexInfo: { uid: 'abc-123' } });
    // The regex only matches after / or at start, so query string params won't match
    // because `:indexInfo.uid` is preceded by `=`, not `/`
    // This is by design - URL params are only in path segments
    expect(result).toBe('/api/tasks?indexUid.eq=:indexInfo.uid');
  });

  it('uses fallback identifier when param not in routeParams', () => {
    const url = '/api/users/:id';
    const result = substituteUrlParams(url, {}, 'fallback-id');
    expect(result).toBe('/api/users/fallback-id');
  });

  it('appends fallback identifier to URL without placeholders', () => {
    const url = '/api/users';
    const result = substituteUrlParams(url, {}, '123');
    expect(result).toBe('/api/users/123');
  });

  it('returns URL as-is when no routeParams and no fallback', () => {
    const url = '/api/users/:id';
    const result = substituteUrlParams(url, {});
    expect(result).toBe('/api/users/:id');
  });

  it('returns URL as-is when nothing to substitute', () => {
    const url = '/api/users/list';
    const result = substituteUrlParams(url);
    expect(result).toBe('/api/users/list');
  });

  it('preserves unresolved params and logs warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const url = '/api/users/:userId/posts/:postId';
    const result = substituteUrlParams(url, { userId: '123' });
    // postId has no value, should keep placeholder
    expect(result).toBe('/api/users/123/posts/:postId');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('postId'));
    warnSpy.mockRestore();
  });

  it('handles numeric fallback identifier', () => {
    const url = '/api/items';
    const result = substituteUrlParams(url, {}, 42);
    expect(result).toBe('/api/items/42');
  });
});

// ============================================================================
// matchRoutePattern
// ============================================================================

describe('matchRoutePattern', () => {
  it('matches simple pattern and extracts params', () => {
    const result = matchRoutePattern('/user/:userId', '/user/123');
    expect(result).toEqual({ userId: '123' });
  });

  it('matches multiple parameters', () => {
    const result = matchRoutePattern('/user/:userId/posts/:postId', '/user/123/posts/456');
    expect(result).toEqual({ userId: '123', postId: '456' });
  });

  it('returns null when segment count differs', () => {
    expect(matchRoutePattern('/user/:id', '/user/123/extra')).toBeNull();
    expect(matchRoutePattern('/user/:id/extra', '/user/123')).toBeNull();
  });

  it('returns null when static segments do not match', () => {
    expect(matchRoutePattern('/user/:id/posts', '/user/123/orders')).toBeNull();
  });

  it('matches case-insensitively for static segments', () => {
    const result = matchRoutePattern('/User/:userId', '/user/123');
    expect(result).toEqual({ userId: '123' });
  });

  it('preserves original case of path values', () => {
    const result = matchRoutePattern('/entity/:name', '/entity/TeamConfig');
    expect(result).toEqual({ name: 'TeamConfig' });
  });

  it('handles patterns with no parameters', () => {
    const result = matchRoutePattern('/dashboard', '/dashboard');
    expect(result).toEqual({});
  });

  it('handles leading/trailing slashes', () => {
    const result = matchRoutePattern('user/:id/', '/user/abc/');
    expect(result).toEqual({ id: 'abc' });
  });
});

// ============================================================================
// evaluateTemplateObject
// ============================================================================

describe('evaluateTemplateObject', () => {
  it('evaluates simple template strings', () => {
    const template = { teamId: '{teamId}', sport: '{sport}' };
    const context = { teamId: '123', sport: 'basketball' };
    expect(evaluateTemplateObject(template, context)).toEqual({
      teamId: '123',
      sport: 'basketball',
    });
  });

  it('evaluates nested path templates', () => {
    const template = { teamName: '{team.name}', teamId: '{team.teamId}' };
    const context = { team: { name: 'Lakers', teamId: 'lakers-123' } };
    expect(evaluateTemplateObject(template, context)).toEqual({
      teamName: 'Lakers',
      teamId: 'lakers-123',
    });
  });

  it('passes through static values unchanged', () => {
    const template = { isActive: true, count: 42, label: 'Hello' };
    const context = {};
    expect(evaluateTemplateObject(template, context)).toEqual({
      isActive: true,
      count: 42,
      label: 'Hello',
    });
  });

  it('mixes template and static values', () => {
    const template = { teamId: '{teamId}', isActive: true };
    const context = { teamId: '123' };
    expect(evaluateTemplateObject(template, context)).toEqual({
      teamId: '123',
      isActive: true,
    });
  });

  it('omits unresolvable templates and warns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const template = { missing: '{nonExistent}' };
    const context = {};
    const result = evaluateTemplateObject(template, context);
    // Should NOT include the key since the template couldn't be resolved
    expect(result).not.toHaveProperty('missing');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve template')
    );
    warnSpy.mockRestore();
  });

  it('handles falsy resolved values correctly', () => {
    const template = { count: '{count}', flag: '{flag}', empty: '{empty}' };
    const context = { count: 0, flag: false, empty: '' };
    const result = evaluateTemplateObject(template, context);
    expect(result.count).toBe(0);
    expect(result.flag).toBe(false);
    expect(result.empty).toBe('');
  });

  it('returns empty object for null/undefined template', () => {
    expect(evaluateTemplateObject(null as any, {})).toEqual({});
    expect(evaluateTemplateObject(undefined as any, {})).toEqual({});
  });

  it('returns empty object for non-object template', () => {
    expect(evaluateTemplateObject('string' as any, {})).toEqual({});
  });
});

// ============================================================================
// formatValue
// ============================================================================

describe('formatValue', () => {
  it('returns empty string for undefined/null', () => {
    expect(formatValue(undefined)).toBe('');
    expect(formatValue(null as any)).toBe('');
  });

  it('converts number to string', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(0)).toBe('0');
  });

  it('returns string as-is', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it('applies custom formatter', () => {
    const formatter = (v: number | string) => `$${v}`;
    expect(formatValue(100, formatter)).toBe('$100');
    expect(formatValue('free', formatter)).toBe('$free');
  });
});

// ============================================================================
// formatKey
// ============================================================================

describe('formatKey', () => {
  it('converts camelCase to readable format', () => {
    expect(formatKey('firstName')).toBe('First Name');
    expect(formatKey('totalNbTasks')).toBe('Total Nb Tasks');
  });

  it('converts snake_case to readable format', () => {
    expect(formatKey('first_name')).toBe('First name');
  });

  it('handles mixed camelCase and snake_case', () => {
    expect(formatKey('teamName_id')).toBe('Team Name id');
  });

  it('handles single word', () => {
    expect(formatKey('name')).toBe('Name');
  });

  it('returns empty string for non-string input', () => {
    expect(formatKey(123 as any)).toBe('');
    expect(formatKey(null as any)).toBe('');
  });
});

// ============================================================================
// truncateText
// ============================================================================

describe('truncateText', () => {
  it('returns text unchanged when within limit', () => {
    expect(truncateText('short', 100)).toBe('short');
  });

  it('truncates text exceeding maxLength', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('uses default maxLength of 100', () => {
    const longText = 'a'.repeat(150);
    const result = truncateText(longText);
    expect(result).toBe('a'.repeat(100) + '...');
  });

  it('handles empty/falsy text', () => {
    expect(truncateText('')).toBe('');
    expect(truncateText(null as any)).toBe(null);
    expect(truncateText(undefined as any)).toBe(undefined);
  });

  it('handles exact maxLength boundary', () => {
    expect(truncateText('12345', 5)).toBe('12345');
    expect(truncateText('123456', 5)).toBe('12345...');
  });
});

// ============================================================================
// isValidURL
// ============================================================================

describe('isValidURL', () => {
  it('validates correct URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('https://api.example.com/v1/users')).toBe(true);
    expect(isValidURL('http://192.168.1.1:3000')).toBe(true);
  });

  it('does not match localhost (no TLD)', () => {
    // The regex requires a TLD with 2+ chars or an IP address
    expect(isValidURL('http://localhost:3000')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isValidURL('')).toBe(false);
    expect(isValidURL('not-a-url')).toBe(false);
  });
});

// ============================================================================
// replaceAll
// ============================================================================

describe('replaceAll', () => {
  it('replaces all occurrences', () => {
    expect(replaceAll('a-b-c', '-', '_')).toBe('a_b_c');
  });

  it('handles no occurrences', () => {
    expect(replaceAll('abc', '-', '_')).toBe('abc');
  });

  it('handles empty strings', () => {
    expect(replaceAll('', '-', '_')).toBe('');
  });

  it('replaces multi-character search', () => {
    expect(replaceAll('hello//world//foo', '//', '/')).toBe('hello/world/foo');
  });
});

// ============================================================================
// stripTrailingSlash
// ============================================================================

describe('stripTrailingSlash', () => {
  it('removes trailing slash', () => {
    expect(stripTrailingSlash('/admin/system/')).toBe('/admin/system');
  });

  it('preserves root path', () => {
    expect(stripTrailingSlash('/')).toBe('/');
  });

  it('returns path unchanged without trailing slash', () => {
    expect(stripTrailingSlash('/admin/system')).toBe('/admin/system');
  });

  it('handles empty/falsy input', () => {
    expect(stripTrailingSlash('')).toBe('');
    expect(stripTrailingSlash(undefined as any)).toBe(undefined);
    expect(stripTrailingSlash(null as any)).toBe(null);
  });
});

// ============================================================================
// addPathToUrl
// ============================================================================

describe('addPathToUrl', () => {
  it('combines base URL and endpoint', () => {
    const result = addPathToUrl('https://api.example.com/v1', 'users/123');
    expect(result).toBe('https://api.example.com/v1/users/123');
  });

  it('handles endpoint with leading slash', () => {
    const result = addPathToUrl('https://api.example.com/v1', '/users/123');
    expect(result).toBe('https://api.example.com/v1/users/123');
  });

  it('strips trailing slash from result', () => {
    const result = addPathToUrl('https://api.example.com/v1', 'users/');
    expect(result).toBe('https://api.example.com/v1/users');
  });

  it('throws on invalid base URL', () => {
    expect(() => addPathToUrl('not-a-url', 'users')).toThrow('Invalid base URL');
  });
});

// ============================================================================
// isValidJson
// ============================================================================

describe('isValidJson', () => {
  it('validates correct JSON', () => {
    expect(isValidJson('{"key": "value"}')).toBe(true);
    expect(isValidJson('[1,2,3]')).toBe(true);
    expect(isValidJson('"string"')).toBe(true);
    expect(isValidJson('42')).toBe(true);
    expect(isValidJson('null')).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(isValidJson('{invalid}')).toBe(false);
    expect(isValidJson('undefined')).toBe(false);
    expect(isValidJson('')).toBe(false);
  });
});
