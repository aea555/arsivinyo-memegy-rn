import { useInfiniteQuery } from '@tanstack/react-query';

import { getFeed } from '@/src/features/feed/api/feedApi';
import { FEED_PAGE_SIZE } from '@/src/shared/utils/constants';

export function useFeed(sort: 'random' | 'latest' | 'popular', options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: ['feed', sort],
    queryFn: ({ pageParam = 0 }) => getFeed(sort, pageParam),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === FEED_PAGE_SIZE ? pages.length : undefined,
    initialPageParam: 0,
    enabled: options?.enabled ?? true,
  });
}
