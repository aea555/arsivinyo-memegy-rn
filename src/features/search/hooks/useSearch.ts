import { useInfiniteQuery } from '@tanstack/react-query';

import { searchVideos } from '@/src/features/search/api/searchApi';
import { SEARCH_PAGE_SIZE } from '@/src/shared/utils/constants';

export function useSearch(query: string, sort: 'relevance' | 'recent' | 'popular') {
  return useInfiniteQuery({
    queryKey: ['search', query, sort],
    queryFn: ({ pageParam = 0 }) => searchVideos(query, SEARCH_PAGE_SIZE, pageParam, sort),
    enabled: query.trim().length > 0,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
  });
}
