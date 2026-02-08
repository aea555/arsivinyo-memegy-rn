import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { FeedSort, getFeed } from '@/src/features/feed/api/feedApi';
import { FEED_PAGE_SIZE } from '@/src/shared/utils/constants';

function normalizeFeedSort(sort: FeedSort): 'random' | 'latest' | 'popular' {
  return sort === 'newest' ? 'latest' : sort;
}

export function useFeed(sort: FeedSort, options?: { enabled?: boolean }) {
  const normalizedSort = normalizeFeedSort(sort);
  const randomSeed = useMemo(() => {
    if (normalizedSort !== 'random') return undefined;
    return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }, [normalizedSort]);
  const queryKey =
    normalizedSort === 'random'
      ? (['feed', normalizedSort, randomSeed] as const)
      : (['feed', normalizedSort] as const);

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      getFeed(normalizedSort, pageParam, randomSeed),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === FEED_PAGE_SIZE ? pages.length : undefined,
    initialPageParam: 0,
    enabled: options?.enabled ?? true,
  });
}
