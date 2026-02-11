/**
 * Tests for NeedsAsyncError.
 */
import { NeedsAsyncError } from '../NeedsAsyncError';

describe('NeedsAsyncError', () => {
  it('creates an error with evaluator name', () => {
    const error = new NeedsAsyncError('myCustomEvaluator');
    expect(error.evaluatorName).toBe('myCustomEvaluator');
    expect(error.name).toBe('NeedsAsyncError');
    expect(error.message).toContain('myCustomEvaluator');
  });

  it('is an instance of Error', () => {
    const error = new NeedsAsyncError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of NeedsAsyncError (prototype fix)', () => {
    const error = new NeedsAsyncError('test');
    expect(error).toBeInstanceOf(NeedsAsyncError);
  });

  it('can be caught in try/catch with instanceof', () => {
    let caught = false;
    try {
      throw new NeedsAsyncError('canEditGame');
    } catch (e) {
      if (e instanceof NeedsAsyncError) {
        caught = true;
        expect(e.evaluatorName).toBe('canEditGame');
      }
    }
    expect(caught).toBe(true);
  });

  it('has a stack trace', () => {
    const error = new NeedsAsyncError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('NeedsAsyncError');
  });
});
