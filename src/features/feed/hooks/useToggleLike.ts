import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toggleLike } from '@/src/features/feed/api/feedApi';
import { VideoFeedItem } from '@/src/shared/types/api';

export function useToggleLike(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleLike(videoId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      const previousFeeds = queryClient.getQueriesData<VideoFeedItem[]>({
        queryKey: ['feed'],
      });

      previousFeeds.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData<VideoFeedItem[]>(key, (old) =>
          old?.map((item) => {
            if (item.id !== videoId) return item;
            if (item.is_liked === undefined) return item;
            const isLiked = !item.is_liked;
            return {
              ...item,
              is_liked: isLiked,
              like_count: isLiked ? item.like_count + 1 : Math.max(0, item.like_count - 1),
            };
          })
        );
      });

      return { previousFeeds };
    },
    onError: (_error, _vars, context) => {
      context?.previousFeeds?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['myVideos'] });
    },
  });
}
