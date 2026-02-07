import { useInfiniteQuery } from '@tanstack/react-query';

import { searchVideos } from '@/src/features/search/api/searchApi';
import { SEARCH_PAGE_SIZE } from '@/src/shared/utils/constants';
import { clampSearchQuery } from '@/src/shared/utils/inputLimits';

export function useSearch(query: string, sort: 'relevance' | 'recent' | 'popular') {
  const normalizedQuery = clampSearchQuery(query);

  return useInfiniteQuery({
    queryKey: ['search', normalizedQuery, sort],
    queryFn: ({ pageParam = 0 }) =>
      searchVideos(normalizedQuery, SEARCH_PAGE_SIZE, pageParam, sort),
    enabled: normalizedQuery.length > 0,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
  });
}
