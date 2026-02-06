import { useEffect, useState } from 'react';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';

import { VideoFeedItem } from '@/src/shared/types/api';

function findVideoInPages(data?: InfiniteData<VideoFeedItem[]>, id?: string) {
  if (!data || !id) return null;
  for (const page of data.pages) {
    const match = page.find((item) => item.id === id);
    if (match) return match;
  }
  return null;
}

function getVideoFromCache(queryClient: ReturnType<typeof useQueryClient>, videoId?: string) {
  if (!videoId) return null;

  const feedCaches = queryClient.getQueriesData<InfiniteData<VideoFeedItem[]>>({
    queryKey: ['feed'],
  });
  for (const [, data] of feedCaches) {
    const match = findVideoInPages(data, videoId);
    if (match) return match;
  }

  const searchCaches = queryClient.getQueriesData<InfiniteData<VideoFeedItem[]>>({
    queryKey: ['search'],
  });
  for (const [, data] of searchCaches) {
    const match = findVideoInPages(data, videoId);
    if (match) return match;
  }

  const myVideosCache = queryClient.getQueriesData<InfiniteData<VideoFeedItem[]>>({
    queryKey: ['myVideos'],
  });
  for (const [, data] of myVideosCache) {
    const match = findVideoInPages(data, videoId);
    if (match) return match;
  }

  return null;
}

export function useCachedVideo(videoId?: string) {
  const queryClient = useQueryClient();
  const [video, setVideo] = useState<VideoFeedItem | null>(() => getVideoFromCache(queryClient, videoId));

  useEffect(() => {
    setVideo(getVideoFromCache(queryClient, videoId));

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const next = getVideoFromCache(queryClient, videoId);
      setVideo((current) => (Object.is(current, next) ? current : next));
    });

    return unsubscribe;
  }, [queryClient, videoId]);

  return video;
}
