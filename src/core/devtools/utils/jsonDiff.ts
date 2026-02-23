/**
 * Lightweight JSON diff utility for DevTools state diffing.
 * No external dependencies — ~60 lines of recursive comparison.
 */

export interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export function jsonDiff(oldObj: unknown, newObj: unknown, prefix = ''): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  if (oldObj === newObj) return diffs;

  if (oldObj == null && newObj != null) {
    diffs.push({ path: prefix || '(root)', type: 'added', newValue: newObj });
    return diffs;
  }
  if (oldObj != null && newObj == null) {
    diffs.push({ path: prefix || '(root)', type: 'removed', oldValue: oldObj });
    return diffs;
  }

  if (typeof oldObj !== typeof newObj) {
    diffs.push({ path: prefix || '(root)', type: 'changed', oldValue: oldObj, newValue: newObj });
    return diffs;
  }

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length);
    for (let i = 0; i < maxLen; i++) {
      const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (i >= oldObj.length) {
        diffs.push({ path: p, type: 'added', newValue: newObj[ i ] });
      } else if (i >= newObj.length) {
        diffs.push({ path: p, type: 'removed', oldValue: oldObj[ i ] });
      } else {
        diffs.push(...jsonDiff(oldObj[ i ], newObj[ i ], p));
      }
    }
    return diffs;
  }

  if (typeof oldObj === 'object' && typeof newObj === 'object' && oldObj != null && newObj != null) {
    const oldKeys = new Set(Object.keys(oldObj as Record<string, unknown>));
    const newKeys = new Set(Object.keys(newObj as Record<string, unknown>));

    for (const key of Array.from(newKeys)) {
      const p = prefix ? `${prefix}.${key}` : key;
      if (!oldKeys.has(key)) {
        diffs.push({ path: p, type: 'added', newValue: (newObj as Record<string, unknown>)[ key ] });
      } else {
        diffs.push(...jsonDiff(
          (oldObj as Record<string, unknown>)[ key ],
          (newObj as Record<string, unknown>)[ key ],
          p
        ));
      }
    }

    for (const key of Array.from(oldKeys)) {
      if (!newKeys.has(key)) {
        const p = prefix ? `${prefix}.${key}` : key;
        diffs.push({ path: p, type: 'removed', oldValue: (oldObj as Record<string, unknown>)[ key ] });
      }
    }

    return diffs;
  }

  // Primitive comparison
  if (oldObj !== newObj) {
    diffs.push({ path: prefix || '(root)', type: 'changed', oldValue: oldObj, newValue: newObj });
  }

  return diffs;
}

export function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value.length > 50 ? value.slice(0, 50) + '…' : value}"`;
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value);
      return s.length > 60 ? s.slice(0, 60) + '…' : s;
    } catch {
      return '[object]';
    }
  }
  return String(value);
}
