import { useInfiniteQuery } from '@tanstack/react-query';

import { getMyVideos } from '@/src/features/profile/api/profileApi';
import { FEED_PAGE_SIZE } from '@/src/shared/utils/constants';

export function useMyVideos() {
  return useInfiniteQuery({
    queryKey: ['myVideos'],
    queryFn: ({ pageParam = 0 }) => getMyVideos(pageParam, FEED_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === FEED_PAGE_SIZE ? pages.length : undefined,
  });
}
