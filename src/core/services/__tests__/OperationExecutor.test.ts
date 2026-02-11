/**
 * Tests for core/services/OperationExecutor.ts
 * 
 * The OperationExecutor is the centralized service for executing API operations.
 * It handles the full lifecycle:
 * - Loading state management
 * - API call execution (with retry)
 * - Success handling (toast, redirect, response modal, callbacks)
 * - Error handling (validation errors, generic errors)
 * - Request cancellation
 * - Template-based messages
 */

// Mock external dependencies to avoid ESM/TextEncoder issues
jest.mock('../../../routes/Navigation', () => ({
  useCoreNavigator: jest.fn(() => jest.fn()),
}));
jest.mock('../../context/ApiContext', () => ({
  useApi: jest.fn(() => ({ callApiMethod: jest.fn() })),
}));
jest.mock('../../context/AppContext', () => ({
  useAppContext: jest.fn(() => ({ notifySuccess: jest.fn(), notifyError: jest.fn() })),
}));
jest.mock('../../context/ResponseModalContext', () => ({
  useResponseModalContext: jest.fn(() => ({ showResponseModal: jest.fn() })),
}));
jest.mock('@blocknote/core', () => ({
  BlockNoteEditor: { create: jest.fn() },
}));
jest.mock('jsonpath-plus', () => ({
  JSONPath: jest.fn(() => undefined),
}));

import { OperationExecutor } from '../OperationExecutor';
import type { OperationConfig, OperationCallbacks, OperationExecutorDeps } from '../OperationExecutor';

// ============================================================================
// HELPERS
// ============================================================================

function makeDeps(overrides: Partial<OperationExecutorDeps> = {}): OperationExecutorDeps {
  return {
    navigate: jest.fn(),
    callApiMethod: jest.fn(),
    notifySuccess: jest.fn(),
    notifyError: jest.fn(),
    showResponseModal: jest.fn(),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<OperationConfig> = {}): OperationConfig {
  return {
    apiConfig: {
      apiMethod: 'POST',
      apiUrl: '/api/teams',
    } as any,
    ...overrides,
  };
}

// ============================================================================
// SUCCESS HANDLING
// ============================================================================

describe('OperationExecutor', () => {
  describe('execute - success flow', () => {
    it('calls API and handles 200 response', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { id: '123', name: 'Test Team' },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onSuccess = jest.fn();
      const onClose = jest.fn();

      await executor.execute(makeConfig(), { onSuccess, onClose });

      expect(deps.callApiMethod).toHaveBeenCalled();
      expect(deps.notifySuccess).toHaveBeenCalledWith('Success');
      expect(onSuccess).toHaveBeenCalledWith({ id: '123', name: 'Test Team' });
      expect(onClose).toHaveBeenCalled();
    });

    it('manages loading state', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      });

      const executor = new OperationExecutor(deps);
      const onLoading = jest.fn();

      await executor.execute(makeConfig({ onLoading }));

      // First call: loading = true, last call: loading = false
      expect(onLoading).toHaveBeenCalledWith(true);
      expect(onLoading).toHaveBeenCalledWith(false);
      expect(onLoading.mock.calls[0][0]).toBe(true);
      expect(onLoading.mock.calls[1][0]).toBe(false);
    });

    it('uses custom success message', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { name: 'Lakers' },
        }),
      });

      const executor = new OperationExecutor(deps);
      await executor.execute(makeConfig({
        successMessage: 'Created {name} successfully',
      }));

      expect(deps.notifySuccess).toHaveBeenCalledWith('Created Lakers successfully');
    });

    it('skips success toast when skipSuccessToast is true', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      });

      const executor = new OperationExecutor(deps);
      await executor.execute(makeConfig({ skipSuccessToast: true }));

      expect(deps.notifySuccess).not.toHaveBeenCalled();
    });

    it('extracts data with responseKey', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { team: { id: '123', name: 'Test' }, meta: { total: 1 } },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onSuccess = jest.fn();

      await executor.execute(
        makeConfig({ apiConfig: { apiMethod: 'GET', apiUrl: '/api/teams', responseKey: 'team' } as any }),
        { onSuccess }
      );

      expect(onSuccess).toHaveBeenCalledWith({ id: '123', name: 'Test' });
    });

    it('applies transformResponse', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { items: [1, 2, 3] },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onSuccess = jest.fn();

      await executor.execute(
        makeConfig({
          transformResponse: (data) => ({ ...data, count: data.items.length }),
        }),
        { onSuccess }
      );

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ count: 3 })
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REDIRECT
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - redirect', () => {
    it('navigates to submitSuccessRedirect URL', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { id: '123' },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onClose = jest.fn();

      await executor.execute(
        makeConfig({ submitSuccessRedirect: '/teams/:id' }),
        { onClose }
      );

      expect(deps.navigate).toHaveBeenCalledWith('/teams/123', undefined);
      expect(onClose).toHaveBeenCalled();
    });

    it('substitutes route params in redirect URL', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { teamId: 'abc' },
        }),
      });

      const executor = new OperationExecutor(deps);

      await executor.execute(
        makeConfig({
          submitSuccessRedirect: '/teams/:teamId/details',
          routeParams: {},
        })
      );

      expect(deps.navigate).toHaveBeenCalledWith('/teams/abc/details', undefined);
    });

    it('passes redirect options', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      });

      const executor = new OperationExecutor(deps);

      await executor.execute(
        makeConfig({
          submitSuccessRedirect: '/teams',
          submitSuccessRedirectOptions: { replace: true },
        })
      );

      expect(deps.navigate).toHaveBeenCalledWith('/teams', { replace: true });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RESPONSE MODAL
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - response modal', () => {
    it('shows response modal when configured', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { id: '123', name: 'Created Team' },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onChain = jest.fn();
      const onClose = jest.fn();

      await executor.execute(
        makeConfig({
          responseConfig: { showModal: true } as any,
        }),
        { onChain, onClose }
      );

      expect(deps.showResponseModal).toHaveBeenCalled();
      expect(onChain).toHaveBeenCalled();
      // onClose should NOT be called (modal handles closing)
      expect(onClose).not.toHaveBeenCalled();
    });

    it('refreshes parent before showing modal', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      });

      const executor = new OperationExecutor(deps);
      const onRefresh = jest.fn();

      await executor.execute(
        makeConfig({
          responseConfig: { showModal: true } as any,
          refreshParentOnSuccess: true,
        }),
        { onRefresh }
      );

      expect(onRefresh).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - error handling', () => {
    it('handles API response errors (status >= 400)', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 500,
          data: { message: 'Internal Server Error' },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onError = jest.fn();

      await executor.execute(makeConfig(), { onError });

      expect(deps.notifyError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    it('handles validation errors (400)', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 400,
          data: {
            errors: [
              { path: ['body', 'email'], message: 'Must be valid email' },
            ],
          },
        }),
      });

      const executor = new OperationExecutor(deps);
      const onValidationError = jest.fn();

      await executor.execute(makeConfig(), { onValidationError });

      expect(onValidationError).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email', errors: ['Must be valid email'] }),
        ]),
        []
      );
    });

    it('handles thrown exceptions (network errors)', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(new Error('Network Error')),
      });

      const executor = new OperationExecutor(deps);
      const onError = jest.fn();

      await executor.execute(makeConfig(), { onError });

      expect(deps.notifyError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    it('ignores cancellation errors', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(abortError),
      });

      const executor = new OperationExecutor(deps);
      const onError = jest.fn();

      await executor.execute(makeConfig(), { onError });

      // Cancellation is silently ignored
      expect(deps.notifyError).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('skips error toast when skipErrorToast is true', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(new Error('Fail')),
      });

      const executor = new OperationExecutor(deps);
      await executor.execute(makeConfig({ skipErrorToast: true }));

      expect(deps.notifyError).not.toHaveBeenCalled();
    });

    it('closes modal on error when configured', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(new Error('Fail')),
      });

      const executor = new OperationExecutor(deps);
      const onClose = jest.fn();

      await executor.execute(makeConfig({ closeModalOnError: true }), { onClose });

      expect(onClose).toHaveBeenCalled();
    });

    it('uses custom error message template', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(new Error('Network Error')),
      });

      const executor = new OperationExecutor(deps);
      await executor.execute(makeConfig({
        errorMessage: 'Failed to save team',
      }));

      expect(deps.notifyError).toHaveBeenCalledWith('Failed to save team');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RETRY LOGIC
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - retry', () => {
    it('retries on retryable status codes', async () => {
      const callApiMethod = jest.fn()
        .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
        .mockResolvedValueOnce({ status: 200, data: { ok: true } });

      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);
      const onSuccess = jest.fn();

      await executor.execute(
        makeConfig({
          retry: { maxAttempts: 3, delayMs: 10, retryableStatuses: [503] },
        }),
        { onSuccess }
      );

      expect(callApiMethod).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('gives up after maxAttempts', async () => {
      const callApiMethod = jest.fn()
        .mockRejectedValue({ status: 503, message: 'Service Unavailable' });

      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);
      const onError = jest.fn();

      await executor.execute(
        makeConfig({
          retry: { maxAttempts: 2, delayMs: 10, retryableStatuses: [503] },
        }),
        { onError }
      );

      expect(callApiMethod).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalled();
    });

    it('does not retry non-retryable status codes', async () => {
      const callApiMethod = jest.fn()
        .mockRejectedValue({ status: 400, message: 'Bad Request' });

      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);

      await executor.execute(
        makeConfig({
          retry: { maxAttempts: 3, delayMs: 10, retryableStatuses: [503] },
        })
      );

      expect(callApiMethod).toHaveBeenCalledTimes(1);
    });

    it('skips retry when not configured', async () => {
      const callApiMethod = jest.fn()
        .mockRejectedValue({ status: 503, message: 'Error' });

      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);

      await executor.execute(makeConfig());

      expect(callApiMethod).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITIONAL BEHAVIOR
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - conditional behavior', () => {
    it('applies conditional overrides based on response data', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockResolvedValue({
          status: 200,
          data: { type: 'redirect', redirectUrl: '/dashboard' },
        }),
      });

      const executor = new OperationExecutor(deps);

      await executor.execute(
        makeConfig({
          conditionalBehavior: (data) => {
            if (data.type === 'redirect') {
              return { submitSuccessRedirect: data.redirectUrl };
            }
            return {};
          },
        })
      );

      expect(deps.navigate).toHaveBeenCalledWith('/dashboard', undefined);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAYLOAD HANDLING
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - payload', () => {
    it('passes payload to API config', async () => {
      const callApiMethod = jest.fn().mockResolvedValue({ status: 200, data: {} });
      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);

      await executor.execute(
        makeConfig({
          payload: { name: 'Test', active: true },
        })
      );

      expect(callApiMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { name: 'Test', active: true },
        })
      );
    });

    it('does not override payload when not provided', async () => {
      const callApiMethod = jest.fn().mockResolvedValue({ status: 200, data: {} });
      const deps = makeDeps({ callApiMethod });
      const executor = new OperationExecutor(deps);

      await executor.execute(makeConfig());

      const callArg = callApiMethod.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('payload');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE ALWAYS CLEANED UP
  // ══════════════════════════════════════════════════════════════════════════

  describe('execute - loading cleanup on error', () => {
    it('sets loading to false even on error', async () => {
      const deps = makeDeps({
        callApiMethod: jest.fn().mockRejectedValue(new Error('Fail')),
      });

      const executor = new OperationExecutor(deps);
      const onLoading = jest.fn();

      await executor.execute(makeConfig({ onLoading }));

      const lastCall = onLoading.mock.calls[onLoading.mock.calls.length - 1];
      expect(lastCall[0]).toBe(false);
    });
  });
});
