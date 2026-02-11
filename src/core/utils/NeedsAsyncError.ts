/**
 * Error thrown by ConditionEvaluator.evaluateSync() when async evaluation is required.
 * This signals that the condition contains a `custom` evaluator that may be async,
 * and the caller should use evaluateAsync() instead.
 * 
 * NOTE: Manually sets prototype because TypeScript ES5 target breaks `instanceof`
 * for classes extending built-in objects (Error, Array, etc.).
 */
export class NeedsAsyncError extends Error {
  public readonly evaluatorName: string;

  constructor(evaluatorName: string) {
    super(`Async evaluation required for custom evaluator: "${evaluatorName}"`);
    this.name = 'NeedsAsyncError';
    this.evaluatorName = evaluatorName;
    // Fix instanceof for ES5 targets
    Object.setPrototypeOf(this, NeedsAsyncError.prototype);
  }
}
