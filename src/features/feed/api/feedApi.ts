import { apiClient } from '@/src/shared/services/api/apiClient';
import { VideoFeedItem } from '@/src/shared/types/api';

export type FeedSort = 'random' | 'latest' | 'newest' | 'popular';

function normalizeFeedSort(sort: FeedSort): 'random' | 'latest' | 'popular' {
  return sort === 'newest' ? 'latest' : sort;
}

export async function getFeed(sort: FeedSort, page: number) {
  const normalizedSort = normalizeFeedSort(sort);
  const endpoint = '/feed';
  const params = { sort: normalizedSort, page };

  if (__DEV__) {
    console.debug('[feed] request', {
      method: 'GET',
      endpoint,
      params,
    });
  }

  try {
    const response = await apiClient.get<VideoFeedItem[]>(endpoint, {
      params,
    });

    if (__DEV__) {
      console.debug('[feed] response', {
        endpoint,
        status: response.status,
        count: Array.isArray(response.data) ? response.data.length : 0,
        data: response.data,
      });
    }

    return response.data;
  } catch (error: any) {
    if (__DEV__) {
      console.debug('[feed] error', {
        endpoint,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }
    throw error;
  }
}

export type LikeStateResponse = {
  is_liked: boolean;
  like_count: number;
};

export async function setLikeState(videoId: string, shouldLike: boolean) {
  const endpoint = `/videos/${videoId}/like`;
  const method = shouldLike ? 'PUT' : 'DELETE';

  if (__DEV__) {
    console.debug('[like] request', {
      method,
      endpoint,
      videoId,
    });
  }

  try {
    const response = await apiClient.request<LikeStateResponse>({
      method,
      url: endpoint,
    });

    if (__DEV__) {
      console.debug('[like] response', {
        method,
        endpoint,
        status: response.status,
        data: response.data,
      });
    }

    return response.data ?? null;
  } catch (error: any) {
    if (__DEV__) {
      console.debug('[like] error', {
        method,
        endpoint,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }
    throw error;
  }
}
