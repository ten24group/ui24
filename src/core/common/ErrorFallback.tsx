import React from 'react';
import type { FallbackProps } from 'react-error-boundary';

/**
 * Safely extract a displayable message from an unknown error value.
 * Works with Error instances, strings, objects with a message property, and anything else.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = error.message;
    if (typeof msg === 'string') return msg;
  }
  return 'An unknown error occurred';
}

export const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const message = toErrorMessage(error);
  return (
    <div role="alert" style={{ padding: '20px', border: '1px solid #ff4d4f', borderRadius: '4px', backgroundColor: '#fff0f6' }}>
      <h3 style={{ color: '#ff4d4f', marginBottom: '10px' }}>Something went wrong!</h3>
      <pre style={{ color: '#d43808', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto', padding: '10px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f' }}>
        {message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        style={{
          marginTop: '15px',
          padding: '8px 15px',
          backgroundColor: '#1890ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Try again
      </button>
      <p style={{ marginTop: '10px', fontSize: '12px', color: '#8c8c8c' }}>
        If the problem persists, please contact support.
      </p>
    </div>
  );
};
