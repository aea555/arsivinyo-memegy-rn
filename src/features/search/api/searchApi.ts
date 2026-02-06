import { apiClient } from '@/src/shared/services/api/apiClient';
import { VideoFeedItem } from '@/src/shared/types/api';

export async function searchVideos(query: string, limit: number, offset: number, sort: 'relevance' | 'recent' | 'popular') {
  const response = await apiClient.get<VideoFeedItem[]>('/videos/search', {
    params: { q: query, limit, offset, sort },
  });
  return response.data;
}
