import { useInfiniteQuery } from '@tanstack/react-query';

import { searchVideos } from '@/src/features/search/api/searchApi';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { SEARCH_PAGE_SIZE } from '@/src/shared/utils/constants';
import { clampSearchQuery } from '@/src/shared/utils/inputLimits';
import { useAuthStore } from '@/src/store/authStore';

export function useSearch(query: string, sort: 'relevance' | 'recent' | 'popular') {
  const normalizedQuery = clampSearchQuery(query);
  const authStatus = useAuthStore((state) => state.status);

  return useInfiniteQuery({
    queryKey: ['search', normalizedQuery, sort],
    queryFn: ({ pageParam = 0 }) =>
      searchVideos(normalizedQuery, SEARCH_PAGE_SIZE, pageParam, sort),
    enabled: authStatus === 'authenticated' && normalizedQuery.length > 0,
    retry: (failureCount, error) => {
      if (authSessionManager.isAuthTemporaryUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
  });
}
