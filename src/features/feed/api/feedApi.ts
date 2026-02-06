import { apiClient } from '@/src/shared/services/api/apiClient';
import { VideoFeedItem } from '@/src/shared/types/api';

export async function getFeed(sort: 'random' | 'latest' | 'popular', page: number) {
  const response = await apiClient.get<VideoFeedItem[]>('/feed', {
    params: { sort, page },
  });
  return response.data;
}

export async function toggleLike(videoId: string) {
  await apiClient.post(`/videos/${videoId}/like`);
}
