import { useInfiniteQuery } from '@tanstack/react-query';

import { getMyVideos } from '@/src/features/profile/api/profileApi';
import { MY_VIDEOS_PAGE_SIZE } from '@/src/shared/utils/constants';

export function useMyVideos() {
  return useInfiniteQuery({
    queryKey: ['myVideos'],
    queryFn: ({ pageParam = 1 }) => getMyVideos(pageParam, MY_VIDEOS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === MY_VIDEOS_PAGE_SIZE ? pages.length + 1 : undefined,
  });
}
