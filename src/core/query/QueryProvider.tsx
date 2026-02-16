import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s — data is fresh for 30s before background refetch
      gcTime: 5 * 60 * 1000,       // 5min — unused cache entries garbage collected after 5min
      retry: 1,                     // One retry on failure (the transport layer also retries auth)
      refetchOnWindowFocus: false,  // Disabled — apps control refresh via refetchInterval or manual
      refetchOnReconnect: true,     // Refetch when network reconnects
    },
    mutations: {
      retry: 0,                     // No automatic retries for mutations
    },
  },
});

/**
 * Provides the TanStack Query client to the component tree.
 * Must be placed inside ApiProvider (query hooks need callApiMethod).
 */
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

/**
 * Access the singleton QueryClient for imperative operations (e.g., invalidation from OperationExecutor).
 */
export { queryClient };
