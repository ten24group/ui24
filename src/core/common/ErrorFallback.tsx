import React from 'react';
import { Button, Result, Typography } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import type { FallbackProps } from 'react-error-boundary';
import type { Template } from '../types';
import { getErrorStatus } from '../utils/api-error-handler';
import { IS_DEV } from '../constants';
import { instrument } from '../telemetry';

const { Text, Paragraph } = Typography;

/** Configuration for error handling behavior on a page/component */
export interface IErrorHandlingConfig {
  /** Custom messages per HTTP status code */
  messages?: Record<number, string | Template>;
  /** Fallback mode: 'message' (default), 'reduced-view', or 'custom' */
  fallback?: 'message' | 'reduced-view' | 'custom';
  /** Extension registry key for custom fallback component */
  fallbackKey?: string;
  /**
   * Seconds to wait before re-enabling the submit button after a failed form submission (#58).
   * During the delay the button shows "Retry in Xs" (when `showCountdown` is true).
   * Omit or set to 0 to disable this behaviour.
   */
  retryDelay?: number;
  /**
   * Show "Retry in Xs" countdown on the submit button during the retry delay.
   * @default true
   */
  showCountdown?: boolean;
}

/** Configuration for retry behavior */
export interface IRetryConfig {
  /** Show a retry button in error state (default: true) */
  showRetryButton?: boolean;
  /** Maximum number of automatic retries before showing error state */
  maxRetries?: number;
  /** Backoff strategy for automatic retries */
  backoff?: 'exponential';
}

/**
 * Safely extract a displayable message from an unknown error value.
 * Works with Error instances, strings, objects with a message property, and anything else.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg;
  }
  return 'An unknown error occurred';
}

/** Resolve error message using error handling config (custom messages per status code) */
function resolveErrorMessage(error: unknown, config?: IErrorHandlingConfig): string {
  if (config?.messages) {
    const statusCode = getErrorStatus(error);
    if (statusCode !== undefined && config.messages[statusCode]) {
      return String(config.messages[statusCode]);
    }
  }
  return toErrorMessage(error);
}

/** ErrorBoundary fallback — shown when a React render error is caught */
export const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const message = toErrorMessage(error);

  if (IS_DEV) {
    instrument.event('error.boundary', {
      'error.message': message,
      'error.type': error instanceof Error ? error.name : 'Error',
      'span.level': 'error',
    });
  }

  return (
    <Result
      status="error"
      title="Something went wrong"
      subTitle={<Text type="secondary">{message}</Text>}
      extra={[
        <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={resetErrorBoundary}>
          Try again
        </Button>
      ]}
    />
  );
};

interface QueryErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  errorHandling?: IErrorHandlingConfig;
  retry?: IRetryConfig;
  /** Use compact layout for embedding inside table empty states, etc. */
  compact?: boolean;
}

/**
 * Inline error state for query/fetch failures.
 * Renders within the page layout (not a full-page takeover like ErrorBoundary).
 */
export const QueryErrorState: React.FC<QueryErrorStateProps> = ({
  error,
  onRetry,
  errorHandling,
  retry,
  compact = false,
}) => {
  const message = resolveErrorMessage(error, errorHandling);
  const showRetry = retry?.showRetryButton !== false && onRetry;

  if (compact) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <WarningOutlined style={{ fontSize: 24, color: '#faad14', marginBottom: 8 }} />
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>{message}</Paragraph>
        {showRetry && (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>Retry</Button>
        )}
      </div>
    );
  }

  return (
    <Result
      status="warning"
      title="Failed to load data"
      subTitle={<Text type="secondary">{message}</Text>}
      extra={showRetry ? [
        <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
          Retry
        </Button>
      ] : undefined}
    />
  );
};
