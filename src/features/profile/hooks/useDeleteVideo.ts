import { InfiniteData, QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { deleteVideo } from '@/src/features/profile/api/profileApi';
import {
  isRetryableDeleteError,
  toDeleteVideoError,
} from '@/src/features/profile/utils/deleteVideoErrors';
import { removeByIdFromInfinitePages } from '@/src/features/profile/utils/videoCacheOps';
import { extractApiErrorMessage } from '@/src/shared/utils/errorParser';
import { useToastStore } from '@/src/store/toastStore';

type CacheListItem = { id: string };
type CachePages = InfiniteData<CacheListItem[]>;
type QuerySnapshot = [QueryKey, CachePages | undefined];

export function useDeleteVideo() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  return useMutation({
    retry: (failureCount, error) => {
      return isRetryableDeleteError(error) && failureCount < 1;
    },
    mutationFn: async (videoId: string) => deleteVideo(videoId),
    onMutate: async (videoId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['myVideos'] }),
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: ['search'] }),
      ]);

      const previousMyVideos = queryClient.getQueriesData<CachePages>({
        queryKey: ['myVideos'],
      });
      const previousFeed = queryClient.getQueriesData<CachePages>({
        queryKey: ['feed'],
      });
      const previousSearch = queryClient.getQueriesData<CachePages>({
        queryKey: ['search'],
      });

      const snapshots: QuerySnapshot[] = [
        ...previousMyVideos,
        ...previousFeed,
        ...previousSearch,
      ];

      snapshots.forEach(([key]) => {
        queryClient.setQueryData<CachePages>(key, (old) =>
          removeByIdFromInfinitePages(old, videoId)
        );
      });

      return { snapshots };
    },
    onSuccess: () => {
      showToast(t('profile.deleteVideoSuccess'), 'success');
    },
    onError: (error, _videoId, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });

      const mappedError = toDeleteVideoError(error);
      if (mappedError.code === 'rate_limited') {
        showToast(t('profile.deleteVideoRateLimited'), 'error');
        return;
      }

      const backendMessage = extractApiErrorMessage(error);
      showToast(backendMessage ?? t('profile.deleteVideoFailed'), 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['myVideos'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'], refetchType: 'inactive' });
      void queryClient.invalidateQueries({ queryKey: ['search'], refetchType: 'inactive' });
    },
  });
}
