import { QueryClient } from '@tanstack/react-query';

const getStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined;
  if ('response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    if (response?.status) return response.status;
  }
  if ('status' in error) {
    const status = (error as { status?: number }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
};

const shouldRetry = (failureCount: number, error: unknown, maxRetries: number) => {
  const status = getStatusCode(error);
  if (status === 429) return false;
  return failureCount < maxRetries;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => shouldRetry(failureCount, error, 1),
    },
  },
});
