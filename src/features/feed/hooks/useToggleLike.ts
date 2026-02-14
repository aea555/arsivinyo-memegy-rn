import { InfiniteData, QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LikeStateResponse, setLikeState } from '@/src/features/feed/api/feedApi';
import { VideoFeedItem } from '@/src/shared/types/api';

type VideoPages = InfiniteData<VideoFeedItem[]>;
type QuerySnapshot = [QueryKey, VideoPages | undefined];
type ToggleLikeVars = { currentLiked: boolean };

function patchLikeInPages(
  data: VideoPages | undefined,
  videoId: string,
  nextLiked: boolean,
  nextLikeCount?: number
) {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) =>
      page.map((item) => {
        if (item.id !== videoId) return item;
        if (item.is_liked === undefined) return item;
        const likeCount =
          typeof nextLikeCount === 'number'
            ? Math.max(0, nextLikeCount)
            : nextLiked
              ? item.like_count + 1
              : Math.max(0, item.like_count - 1);
        return {
          ...item,
          is_liked: nextLiked,
          like_count: likeCount,
        };
      })
    ),
  };
}

export function useToggleLike(videoId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: async ({ currentLiked }: ToggleLikeVars) => {
      const shouldLike = !currentLiked;
      if (__DEV__) {
        console.debug('[like] mutate:start', { videoId, currentLiked, shouldLike });
      }
      const data = await setLikeState(videoId, shouldLike);
      if (__DEV__) {
        console.debug('[like] mutate:success', {
          videoId,
          shouldLike,
          response: data,
          is_liked: data?.is_liked,
          like_count: data?.like_count,
        });
      }
      return data;
    },
    onMutate: async ({ currentLiked }) => {
      const nextLiked = !currentLiked;
      if (__DEV__) {
        console.debug('[like] optimistic:onMutate', { videoId, currentLiked, nextLiked });
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['feed'] }),
        queryClient.cancelQueries({ queryKey: ['search'] }),
        queryClient.cancelQueries({ queryKey: ['myVideos'] }),
      ]);

      const previousFeeds = queryClient.getQueriesData<VideoPages>({
        queryKey: ['feed'],
      });
      const previousSearch = queryClient.getQueriesData<VideoPages>({
        queryKey: ['search'],
      });
      const previousMyVideos = queryClient.getQueriesData<VideoPages>({
        queryKey: ['myVideos'],
      });
      const snapshots: QuerySnapshot[] = [...previousFeeds, ...previousSearch, ...previousMyVideos];

      snapshots.forEach(([key]) => {
        queryClient.setQueryData<VideoPages>(key, (old) => patchLikeInPages(old, videoId, nextLiked));
      });

      if (__DEV__) {
        console.debug('[like] optimistic:patchedCaches', {
          videoId,
          nextLiked,
          count: snapshots.length,
          keys: snapshots.map(([key]) => key),
        });
      }

      return { snapshots, nextLiked };
    },
    onSuccess: (data: LikeStateResponse | null) => {
      if (!data || typeof data.is_liked !== 'boolean' || typeof data.like_count !== 'number') {
        if (__DEV__) {
          console.debug('[like] mutate:onSuccess missing authoritative payload', {
            videoId,
            data,
          });
        }
        return;
      }

      const queryGroups = [
        queryClient.getQueriesData<VideoPages>({ queryKey: ['feed'] }),
        queryClient.getQueriesData<VideoPages>({ queryKey: ['search'] }),
        queryClient.getQueriesData<VideoPages>({ queryKey: ['myVideos'] }),
      ];
      const keys = queryGroups.flat().map(([key]) => key);

      keys.forEach((key) => {
        queryClient.setQueryData<VideoPages>(key, (old) =>
          patchLikeInPages(old, videoId, data.is_liked, data.like_count)
        );
      });

      if (__DEV__) {
        console.debug('[like] mutate:onSuccess reconciledCaches', {
          videoId,
          is_liked: data.is_liked,
          like_count: data.like_count,
          count: keys.length,
        });
      }
    },
    onError: (error: any, _vars, context) => {
      if (__DEV__) {
        console.debug('[like] mutate:onError', {
          videoId,
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
      }

      if (error?.response?.status === 429) {
        Alert.alert(t('common.error'), t('video.likeRateLimited'));
      }

      context?.snapshots?.forEach(([key, data]: QuerySnapshot) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      if (__DEV__) {
        console.debug('[like] mutate:onSettled skipImmediateInvalidate', {
          videoId,
          reason: 'authoritative mutation response already reconciled in cache',
        });
      }
      // Immediate invalidation causes active immersive feed to refetch/reorder and jump.
      // We keep caches in sync from mutation response and avoid disruptive list resets.
    },
  });
}
