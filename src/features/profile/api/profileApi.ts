import { apiClient } from '@/src/shared/services/api/apiClient';
import { useAuthStore } from '@/src/store/authStore';
import { mapUserVideoDtoToMyVideoItem } from '@/src/features/profile/utils/myVideoMapper';
import { UserDto, UserVideoDto } from '@/src/shared/types/api';

export async function getMyProfile() {
  const response = await apiClient.get<UserDto>('/users/me');
  return response.data;
}

export async function getMyVideos(page: number, limit: number) {
  const endpoint = '/users/me/videos';
  const params = { page, per_page: limit };

  if (__DEV__) {
    console.debug('[myVideos] request', {
      method: 'GET',
      endpoint,
      params,
    });
  }

  try {
    const response = await apiClient.get<UserVideoDto[]>(endpoint, {
      params,
    });

    const currentUser = useAuthStore.getState().user;
    const mapped = response.data.map((item) => mapUserVideoDtoToMyVideoItem(item, currentUser));

    if (__DEV__) {
      console.debug('[myVideos] response', {
        endpoint,
        status: response.status,
        count: Array.isArray(response.data) ? response.data.length : 0,
        data: response.data,
      });
    }

    return mapped;
  } catch (error: any) {
    if (__DEV__) {
      console.debug('[myVideos] error', {
        endpoint,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    }
    throw error;
  }
}

export async function deleteAccount() {
  await apiClient.delete('/users/me');
}

export async function retryVideoProcessing(videoId: string) {
  const endpoint = `/videos/${videoId}/confirm`;
  if (__DEV__) {
    console.debug('[myVideos] retry request', {
      method: 'POST',
      endpoint,
      videoId,
    });
  }

  try {
    const response = await apiClient.post(endpoint);
    if (__DEV__) {
      console.debug('[myVideos] retry response', {
        endpoint,
        status: response.status,
        videoId,
      });
    }
  } catch (error: any) {
    if (__DEV__) {
      console.debug('[myVideos] retry error', {
        endpoint,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
        videoId,
      });
    }
    throw error;
  }
}
