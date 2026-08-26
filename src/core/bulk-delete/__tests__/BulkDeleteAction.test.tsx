/// <reference types="@testing-library/jest-dom" />
/**
 * BEHAVIORAL tests for BulkDeleteAction, against the real fw24 delete-impact / delete-plan
 * contract (getDeleteImpact / executeDeletePlan on BaseEntityService, feat/overhaul-du-integration):
 *
 * - Dry-run calls POST {apiBaseUrl}/delete-impact with ids/filters and shows totals/blockers/relations.
 * - A truncated dry-run (top-level and per-relation) surfaces a visible warning.
 * - Confirm Delete is disabled while blockers remain.
 * - Confirming calls POST {apiBaseUrl}/execute-delete-plan and renders the real
 *   BulkDeleteExecutionResult (deletedCount/failedCount/cascadedCount/orphanedCount/unprocessed).
 * - A 404 from either route (opt-in, not-yet-enabled backend) is handled gracefully, not as a
 *   generic failure.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));

const mockCallApi = jest.fn();
jest.mock('../../context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: mockCallApi }),
}));

const notifyError = jest.fn();
const notifySuccess = jest.fn();
const notifyWarning = jest.fn();
jest.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ notifyError, notifySuccess, notifyWarning, notifyInfo: jest.fn(), notifyLoading: jest.fn() }),
}));

jest.mock('../../query/useEntityMutation', () => ({
  invalidateEntityCacheByName: jest.fn(),
}));

// The nested "delete by query" table renders the full framework Table; stub it so
// these tests stay focused on BulkDeleteAction's own wizard/API behavior.
jest.mock('../../../table/Table', () => ({
  Table: () => <div data-testid="mock-framework-table" />,
}));

import { BulkDeleteAction } from '../BulkDeleteAction';
import type { IBulkDeleteActionConfig } from '../../../table/type';

const baseConfig: IBulkDeleteActionConfig = {
  entityName: 'post',
  apiBaseUrl: '/admin/post',
  identifierFields: [ 'postId' ],
};

const selectedRecords = [ { postId: 'p1', title: 'First' }, { postId: 'p2', title: 'Second' } ];

function makeImpact(overrides: Record<string, unknown> = {}) {
  return {
    dryRun: true,
    entityName: 'post',
    direct: [
      { identifiers: { postId: 'p1' }, preview: { postId: 'p1', title: 'First' } },
      { identifiers: { postId: 'p2' }, preview: { postId: 'p2', title: 'Second' } },
    ],
    relations: [],
    blockers: [],
    warnings: [],
    truncated: false,
    totals: { direct: 2, cascaded: 0, orphaned: 0, blocked: 0, ignored: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  mockCallApi.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
  notifyWarning.mockReset();
});

async function openAndDryRun(config: IBulkDeleteActionConfig = baseConfig) {
  render(
    <BulkDeleteAction config={config} label="Delete Posts" selectedRecords={selectedRecords} />
  );
  fireEvent.click(screen.getByRole('button', { name: /delete posts/i }));
  fireEvent.click(await screen.findByRole('button', { name: /dry run/i }));
}

describe('BulkDeleteAction - dry run request shape', () => {
  it('POSTs ids + relationPolicyOverrides to {apiBaseUrl}/delete-impact for selection mode', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact() });

    await openAndDryRun();

    await waitFor(() => expect(mockCallApi).toHaveBeenCalledTimes(1));
    expect(mockCallApi).toHaveBeenCalledWith(expect.objectContaining({
      apiMethod: 'POST',
      apiUrl: '/admin/post/delete-impact',
      payload: expect.objectContaining({
        ids: [ { postId: 'p1' }, { postId: 'p2' } ],
        filters: undefined,
        relationPolicyOverrides: {},
      }),
    }));
  });

  it('respects an explicit impactApiUrl over apiBaseUrl derivation', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact() });

    await openAndDryRun({ ...baseConfig, impactApiUrl: '/custom/preview' });

    await waitFor(() => expect(mockCallApi).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: '/custom/preview' })
    ));
  });
});

describe('BulkDeleteAction - impact preview', () => {
  it('shows totals from the dry-run result', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact({
      totals: { direct: 2, cascaded: 3, orphaned: 1, blocked: 0, ignored: 4 },
    }) });

    await openAndDryRun();

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('surfaces a truncation warning when the dry-run was truncated', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact({ truncated: true }) });

    await openAndDryRun();

    expect(await screen.findByText(/this preview was truncated/i)).toBeInTheDocument();
  });

  it('shows blockers and disables Confirm Delete while any remain', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact({
      blockers: [ { code: 'RESTRICTED', message: 'Post has active comments', relationAttribute: 'comments' } ],
      totals: { direct: 2, cascaded: 0, orphaned: 0, blocked: 1, ignored: 0 },
    }) });

    await openAndDryRun();

    expect(await screen.findByText('Delete is blocked')).toBeInTheDocument();
    expect(screen.getAllByText('Post has active comments').length).toBeGreaterThan(0);

    // Walk to the Confirm step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeDisabled();
  });

  it('flags a truncated relation with a tag', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact({
      relations: [ {
        relationAttribute: 'comments',
        targetEntityName: 'comment',
        label: 'Comments',
        policy: 'cascade',
        overridable: false,
        items: [ { parentIdentifiers: { postId: 'p1' }, identifiers: { id: 'c1' }, preview: { id: 'c1' } } ],
        truncated: true,
      } ],
    }) });

    await openAndDryRun();

    expect(await screen.findByText('truncated')).toBeInTheDocument();
  });
});

const noRevalidateConfig: IBulkDeleteActionConfig = { ...baseConfig, revalidateBeforeExecute: false };

describe('BulkDeleteAction - execute', () => {
  it('POSTs to {apiBaseUrl}/execute-delete-plan and renders the real execution result', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact() });
    mockCallApi.mockResolvedValueOnce({
      status: 200,
      data: {
        entityName: 'post',
        deletedCount: 2,
        failedCount: 0,
        cascadedCount: 3,
        orphanedCount: 1,
        ignoredCount: 0,
        totalProcessed: 2,
        unprocessed: [],
      },
    });

    await openAndDryRun(noRevalidateConfig);
    fireEvent.click(await screen.findByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => expect(mockCallApi).toHaveBeenCalledTimes(2));
    expect(mockCallApi).toHaveBeenNthCalledWith(2, expect.objectContaining({
      apiMethod: 'POST',
      apiUrl: '/admin/post/execute-delete-plan',
    }));

    expect(await screen.findByText('Delete completed')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.getByText('Cascaded')).toBeInTheDocument();
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('Deleted 2 record'));
  });

  it('shows unprocessed identifiers when failedCount > 0', async () => {
    mockCallApi.mockResolvedValueOnce({ status: 200, data: makeImpact() });
    mockCallApi.mockResolvedValueOnce({
      status: 200,
      data: {
        entityName: 'post',
        deletedCount: 1,
        failedCount: 1,
        cascadedCount: 0,
        orphanedCount: 0,
        ignoredCount: 0,
        totalProcessed: 2,
        unprocessed: [ { postId: 'p2' } ],
      },
    });

    await openAndDryRun(noRevalidateConfig);
    fireEvent.click(await screen.findByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(await screen.findByText('Delete completed with some failures')).toBeInTheDocument();
    expect(screen.getByText('Unprocessed records')).toBeInTheDocument();
    expect(notifyWarning).toHaveBeenCalledWith(expect.stringContaining('1 failed'));
  });
});

describe('BulkDeleteAction - opt-in routes not enabled (404)', () => {
  it('shows a clear "not enabled" message instead of a generic error on a 404 dry-run', async () => {
    mockCallApi.mockRejectedValueOnce({ response: { status: 404 } });

    await openAndDryRun();

    expect(await screen.findByText(/bulk delete preview is not available/i)).toBeInTheDocument();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('shows a generic error toast for a non-404 dry-run failure', async () => {
    mockCallApi.mockRejectedValueOnce({ response: { status: 500 }, message: 'Server exploded' });

    await openAndDryRun();

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(screen.queryByText(/bulk delete preview is not available/i)).not.toBeInTheDocument();
  });
});

describe('BulkDeleteAction - scope gating', () => {
  it('disables Dry Run in selection mode with nothing selected', () => {
    render(<BulkDeleteAction config={baseConfig} label="Delete Posts" selectedRecords={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /delete posts/i }));

    expect(screen.getByRole('button', { name: /dry run/i })).toBeDisabled();
  });
});
