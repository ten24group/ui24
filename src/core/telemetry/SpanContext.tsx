import React, { createContext, useContext, useMemo } from 'react';
import type { Span } from '@opentelemetry/api';
import { IS_DEV } from '../constants';

interface SpanContextValue {
  activeSpan?: Span;
}

const SpanContext = createContext<SpanContextValue>({});

export const SpanContextProvider: React.FC<{
  span?: Span;
  children: React.ReactNode;
}> = ({ span, children }) => {
  // Skip provider entirely in production to avoid any overhead
  if (!IS_DEV || !span) {
    return <>{children}</>;
  }

  // Memoize the context value to prevent re-renders when span hasn't changed
  const value = useMemo(() => ({ activeSpan: span }), [ span ]);

  return (
    <SpanContext.Provider value={value}>
      {children}
    </SpanContext.Provider>
  );
};

export const useParentSpan = (): Span | undefined => {
  const { activeSpan } = useContext(SpanContext);
  return activeSpan;
};
