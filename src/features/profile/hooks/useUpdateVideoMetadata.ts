import { isAxiosError } from 'axios';
import { InfiniteData, QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { updateMyVideoMetadata } from '@/src/features/profile/api/profileApi';
import { patchByIdInInfinitePages } from '@/src/features/profile/utils/videoCacheOps';
import { VideoFeedItem, MyVideoItem, UpdateVideoRequest } from '@/src/shared/types/api';
import { extractApiErrorMessage } from '@/src/shared/utils/errorParser';
import { useAuthStore } from '@/src/store/authStore';
import { useToastStore } from '@/src/store/toastStore';

type QuerySnapshot<T extends { id: string }> = [QueryKey, InfiniteData<T[]> | undefined];

type UpdateVideoMetadataInput = {
  videoId: string;
  payload: UpdateVideoRequest;
  changedFields: ('title' | 'description' | 'is_anonymous' | 'is_nsfw')[];
};

type MutationContext = {
  startedAt: number;
  changedFields: ('title' | 'description' | 'is_anonymous' | 'is_nsfw')[];
  myVideosSnapshots: QuerySnapshot<MyVideoItem>[];
  feedSnapshots: QuerySnapshot<VideoFeedItem>[];
  searchSnapshots: QuerySnapshot<VideoFeedItem>[];
};

export function useUpdateVideoMetadata() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.user);

  return useMutation<void, unknown, UpdateVideoMetadataInput, MutationContext>({
    mutationFn: async ({ videoId, payload }) => updateMyVideoMetadata(videoId, payload),
    onMutate: async ({ videoId, payload, changedFields }) => {
      const startedAt = Date.now();

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['myVideos'] }),
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: ['search'] }),
      ]);

      const previousMyVideos = queryClient.getQueriesData<InfiniteData<MyVideoItem[]>>({
        queryKey: ['myVideos'],
      });
      const previousFeed = queryClient.getQueriesData<InfiniteData<VideoFeedItem[]>>({
        queryKey: ['feed'],
      });
      const previousSearch = queryClient.getQueriesData<InfiniteData<VideoFeedItem[]>>({
        queryKey: ['search'],
      });

      previousMyVideos.forEach(([key]) => {
        queryClient.setQueryData<InfiniteData<MyVideoItem[]>>(key, (old) => {
          if (!old) return old;
          return patchByIdInInfinitePages(old, videoId, (item) => {
            const anonymousPatch =
              typeof payload.is_anonymous === 'boolean' ? payload.is_anonymous : undefined;
            let nextUploader = item.uploader;
            if (anonymousPatch !== undefined) {
              nextUploader = anonymousPatch
                ? null
                : item.uploader ?? (currentUser ? { id: currentUser.id, username: currentUser.username } : null);
            }

            return {
              ...item,
              title: payload.title !== undefined ? payload.title : item.title,
              description: payload.description !== undefined ? payload.description : item.description,
              is_anonymous: anonymousPatch ?? item.is_anonymous,
              is_nsfw: payload.is_nsfw !== undefined ? payload.is_nsfw : item.is_nsfw,
              uploader: nextUploader,
            };
          });
        });
      });

      const patchVideoFeedCache = ([key]: QuerySnapshot<VideoFeedItem>) => {
        queryClient.setQueryData<InfiniteData<VideoFeedItem[]>>(key, (old) => {
          if (!old) return old;
          return patchByIdInInfinitePages(old, videoId, (item) => {
            const anonymousPatch =
              typeof payload.is_anonymous === 'boolean' ? payload.is_anonymous : undefined;
            let nextUploader = item.uploader;
            if (anonymousPatch !== undefined) {
              nextUploader = anonymousPatch
                ? null
                : item.uploader ?? (currentUser ? { id: currentUser.id, username: currentUser.username } : null);
            }

            return {
              ...item,
              title: payload.title !== undefined ? payload.title : item.title,
              description: payload.description !== undefined ? payload.description : item.description,
              is_nsfw: payload.is_nsfw !== undefined ? Boolean(payload.is_nsfw) : item.is_nsfw,
              uploader: nextUploader,
            };
          });
        });
      };

      previousFeed.forEach(patchVideoFeedCache);
      previousSearch.forEach(patchVideoFeedCache);

      if (__DEV__) {
        console.debug('[video.update] optimistic patch', {
          videoId,
          changedFields,
          cacheKeys: previousMyVideos.length + previousFeed.length + previousSearch.length,
        });
      }

      return {
        startedAt,
        changedFields,
        myVideosSnapshots: previousMyVideos,
        feedSnapshots: previousFeed,
        searchSnapshots: previousSearch,
      };
    },
    onSuccess: (_data, variables, context) => {
      if (__DEV__) {
        console.debug('[video.update] success', {
          videoId: variables.videoId,
          changedFields: context?.changedFields ?? variables.changedFields,
          elapsedMs: Date.now() - (context?.startedAt ?? Date.now()),
        });
      }
      showToast(t('profile.editMetadataSuccess'), 'success');
    },
    onError: (error, variables, context) => {
      context?.myVideosSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.feedSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.searchSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });

      const status = isAxiosError(error) ? error.response?.status : undefined;
      const statusClass = typeof status === 'number' ? `${Math.floor(status / 100)}xx` : 'none';

      if (__DEV__) {
        console.debug('[video.update] failed', {
          videoId: variables.videoId,
          status,
          statusClass,
          changedFields: context?.changedFields ?? variables.changedFields,
          elapsedMs: Date.now() - (context?.startedAt ?? Date.now()),
        });
      }

      if (status === 400) {
        showToast(t('profile.editMetadataValidationError'), 'error');
        return;
      }

      if (status === 404) {
        showToast(t('profile.editMetadataNotFound'), 'error');
        return;
      }

      if (status === 429) {
        showToast(t('profile.editMetadataRateLimited'), 'error');
        return;
      }

      const backendMessage = extractApiErrorMessage(error);
      showToast(backendMessage ?? t('profile.editMetadataFailed'), 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['myVideos'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'], refetchType: 'inactive' });
      void queryClient.invalidateQueries({ queryKey: ['search'], refetchType: 'inactive' });
    },
  });
}
