import { apiClient } from '@/src/shared/services/api/apiClient';
import { VideoFeedItem } from '@/src/shared/types/api';
import { normalizeSearchQuery } from '@/src/shared/utils/inputLimits';

export async function searchVideos(query: string, limit: number, offset: number, sort: 'relevance' | 'recent' | 'popular') {
  const normalizedQuery = normalizeSearchQuery(query);

  const response = await apiClient.get<VideoFeedItem[]>('/videos/search', {
    params: { q: normalizedQuery, limit, offset, sort },
  });
  return response.data;
}
