import React from 'react';
import { Form } from 'antd';
import type { FormInstance } from 'antd';

export interface DependencyFiltersResult {
  /** Parent values to filter the options request by, or `undefined` when none are set. */
  dependencyFilters: Record<string, unknown> | undefined;
  /** Current parent values, in `dependsOn` order. `null` when the field has no parents. */
  watchedDeps: unknown[] | null;
}

/**
 * Resolves the `dependsOn` values of a cascading select into the filter object
 * sent with its options request (#3).
 *
 * A dependent field's options depend on a parent field's value — "provider teams
 * for *this* team", "cities in *this* state". This hook watches the parent fields
 * and returns their current values, which `OptionSelector` forwards to the options
 * API as `dependencyFilters`.
 *
 * Two properties matter and are easy to get wrong:
 *
 * 1. **It must re-derive when a parent changes.** Parents start empty, so a value
 *    captured once at mount is always `undefined`; the options request would then go
 *    out with no parent filter, indistinguishable on the wire from a form where
 *    nothing was selected. `Form.useWatch` returns a fresh array on every render and
 *    so cannot be a memo dependency directly — the watched values are serialized
 *    into a key that changes only on a real change.
 *
 * 2. **Empty parents are omitted, not sent as blanks.** Returning `undefined`
 *    instead of `{ teamId: '' }` lets the backend tell "not chosen yet" from
 *    "chosen as empty" and skip work (and, for API-backed options, upstream calls)
 *    until the form is actually ready.
 *
 * `watchedDeps` is returned alongside so callers can clear a stale child selection
 * when a parent changes, without setting up a second watch.
 *
 * @param dependsOn - parent field name, or names, this field depends on
 * @param form - the antd form instance the fields live in
 */
export function useDependencyFilters(
  dependsOn: string | string[] | undefined,
  form: FormInstance | undefined
): DependencyFiltersResult {
  const watchedDeps = Form.useWatch(
    dependsOn
      ? (values: Record<string, unknown>) => {
        const deps = Array.isArray(dependsOn) ? dependsOn : [ dependsOn ];
        return deps.map(dep => values?.[ dep ]);
      }
      : () => null,
    form
  );

  // Stable identity for the watched values, so the memo below recomputes on a real
  // change but not on every unrelated re-render.
  const watchedDepsKey = React.useMemo(
    () => JSON.stringify(watchedDeps ?? null),
    [ watchedDeps ]
  );

  const dependencyFilters = React.useMemo(() => {
    if (!dependsOn || !form) return undefined;

    const deps = Array.isArray(dependsOn) ? dependsOn : [ dependsOn ];
    const filters: Record<string, unknown> = {};
    let hasValue = false;

    for (const dep of deps) {
      const value = form.getFieldValue(dep);
      if (value !== undefined && value !== null && value !== '') {
        filters[ dep ] = value;
        hasValue = true;
      }
    }

    return hasValue ? filters : undefined;
    // `watchedDepsKey` is the change signal; values are read back from the form so
    // nested/array shapes come through exactly as the form holds them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ dependsOn, form, watchedDepsKey ]);

  return { dependencyFilters, watchedDeps };
}
