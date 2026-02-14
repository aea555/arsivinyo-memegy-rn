import { useInfiniteQuery } from '@tanstack/react-query';

import { getMyVideos } from '@/src/features/profile/api/profileApi';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { MY_VIDEOS_PAGE_SIZE } from '@/src/shared/utils/constants';
import { useAuthStore } from '@/src/store/authStore';

export function useMyVideos() {
  const authStatus = useAuthStore((state) => state.status);

  return useInfiniteQuery({
    queryKey: ['myVideos'],
    queryFn: ({ pageParam = 1 }) => getMyVideos(pageParam, MY_VIDEOS_PAGE_SIZE),
    enabled: authStatus === 'authenticated',
    retry: (failureCount, error) => {
      if (authSessionManager.isAuthTemporaryUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === MY_VIDEOS_PAGE_SIZE ? pages.length + 1 : undefined,
  });
}
