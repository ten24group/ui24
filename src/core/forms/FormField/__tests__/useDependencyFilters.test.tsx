/**
 * Regression tests for `dependsOn` cascading selects (#3).
 *
 * The bug this guards: `dependencyFilters` was memoized on `[dependsOn, form]`,
 * both stable for the component's lifetime, so it was computed once at mount —
 * when every parent field is still empty — and never again. A dependent select
 * therefore fetched its options with no parent filter at all, which on the wire is
 * indistinguishable from a form where nothing had been selected.
 *
 * Tests drive a real antd Form so the `Form.useWatch` behaviour is the real thing.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { Form, Input } from 'antd';
import { useDependencyFilters } from '../useDependencyFilters';

/** Renders the hook inside a real antd Form and reports every value it produced. */
function setup(dependsOn: string | string[] | undefined, initialValues: Record<string, unknown> = {}) {
  const seen: Array<Record<string, unknown> | undefined> = [];
  let formRef: any;

  const Probe: React.FC = () => {
    const form = Form.useFormInstance();
    const { dependencyFilters, watchedDeps } = useDependencyFilters(dependsOn, form);
    seen.push(dependencyFilters);
    return (
      <>
        <span data-testid="filters">{JSON.stringify(dependencyFilters ?? null)}</span>
        <span data-testid="watched">{JSON.stringify(watchedDeps ?? null)}</span>
      </>
    );
  };

  let bumpRef: () => void = () => {};

  const Harness: React.FC = () => {
    const [ form ] = Form.useForm();
    const [ , setTick ] = React.useState(0);
    formRef = form;
    bumpRef = () => setTick(t => t + 1);
    return (
      <Form form={form} initialValues={initialValues}>
        <Form.Item name="teamId"><Input /></Form.Item>
        <Form.Item name="season"><Input /></Form.Item>
        <Probe />
      </Form>
    );
  };

  render(<Harness />);

  return {
    seen,
    filters: () => JSON.parse(screen.getByTestId('filters').textContent || 'null'),
    watched: () => JSON.parse(screen.getByTestId('watched').textContent || 'null'),
    set: (values: Record<string, unknown>) => act(() => { formRef.setFieldsValue(values); }),
    /** Force a re-render of the whole form from outside, without touching values. */
    rerender: () => act(() => { bumpRef(); }),
  };
}

describe('useDependencyFilters', () => {
  it('returns undefined while the parent is empty', () => {
    const { filters } = setup('teamId');

    // Not `{ teamId: '' }` — the backend must be able to tell "not chosen yet"
    // from "chosen as empty" and skip work until the form is ready.
    expect(filters()).toBeNull();
  });

  it('picks up the parent value after it is set — the regression', () => {
    const { filters, set } = setup('teamId');

    expect(filters()).toBeNull();

    set({ teamId: 'team-1' });

    expect(filters()).toEqual({ teamId: 'team-1' });
  });

  it('tracks further changes to the parent', () => {
    const { filters, set } = setup('teamId');

    set({ teamId: 'team-1' });
    expect(filters()).toEqual({ teamId: 'team-1' });

    set({ teamId: 'team-2' });
    expect(filters()).toEqual({ teamId: 'team-2' });
  });

  it('goes back to undefined when the parent is cleared', () => {
    const { filters, set } = setup('teamId');

    set({ teamId: 'team-1' });
    set({ teamId: undefined });

    expect(filters()).toBeNull();
  });

  it('reads a value present from the start', () => {
    const { filters } = setup('teamId', { teamId: 'team-preset' });

    expect(filters()).toEqual({ teamId: 'team-preset' });
  });

  it('includes every dependency when dependsOn is a list', () => {
    const { filters, set } = setup([ 'teamId', 'season' ]);

    set({ teamId: 'team-1', season: '2026' });

    expect(filters()).toEqual({ teamId: 'team-1', season: '2026' });
  });

  it('omits the dependencies that are still empty', () => {
    const { filters, set } = setup([ 'teamId', 'season' ]);

    set({ teamId: 'team-1' });

    expect(filters()).toEqual({ teamId: 'team-1' });
  });

  it('treats an empty string as not set', () => {
    const { filters, set } = setup('teamId');

    set({ teamId: '' });

    expect(filters()).toBeNull();
  });

  it('returns undefined when the field has no dependsOn', () => {
    const { filters, set } = setup(undefined);

    set({ teamId: 'team-1' });

    expect(filters()).toBeNull();
  });

  it('keeps one object identity across re-renders that change nothing', () => {
    const { seen, set, rerender } = setup('teamId');

    set({ teamId: 'team-1' });
    // The filter object feeds a react-query key: a fresh object on every render
    // would invalidate the key and refetch the options forever.
    rerender();
    rerender();

    const settled = seen.filter(Boolean) as Array<Record<string, unknown>>;
    expect(settled.length).toBeGreaterThan(1);
    expect(new Set(settled).size).toBe(1);
  });

  it('does not re-render the field when an unwatched value changes', () => {
    const { seen, set } = setup('teamId');
    const before = seen.length;

    set({ season: '2026' });

    expect(seen.length).toBe(before);
  });

  it('exposes the watched values so a stale child selection can be cleared', () => {
    const { watched, set } = setup([ 'teamId', 'season' ]);

    set({ teamId: 'team-1', season: '2026' });

    expect(watched()).toEqual([ 'team-1', '2026' ]);
  });

  it('preserves non-string parent values as the form holds them', () => {
    const { filters, set } = setup('teamId');

    set({ teamId: [ 'a', 'b' ] });

    expect(filters()).toEqual({ teamId: [ 'a', 'b' ] });
  });
});
