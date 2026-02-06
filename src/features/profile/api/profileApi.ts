import { apiClient } from '@/src/shared/services/api/apiClient';
import { UserDto, VideoFeedItem } from '@/src/shared/types/api';

export async function getMyProfile() {
  const response = await apiClient.get<UserDto>('/users/me');
  return response.data;
}

export async function getMyVideos(page: number, limit: number) {
  const response = await apiClient.get<VideoFeedItem[]>('/users/me/videos', {
    params: { page, limit },
  });
  return response.data;
}

export async function deleteAccount() {
  await apiClient.delete('/users/me');
}
