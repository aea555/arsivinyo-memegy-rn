import { apiClient } from '@/src/shared/services/api/apiClient';
import { InitUploadRequest, InitUploadResponse, UpdateVideoRequest } from '@/src/shared/types/api';

export async function initUpload(payload: InitUploadRequest) {
  const response = await apiClient.post<InitUploadResponse>('/videos/init', payload);
  return response.data;
}

export async function initAnonymousUpload(payload: InitUploadRequest) {
  const response = await apiClient.post<InitUploadResponse>('/videos/init/anonymous', payload);
  return response.data;
}

export async function confirmUpload(videoId: string) {
  await apiClient.post(`/videos/${videoId}/confirm`);
}

export async function updateVideoMetadata(videoId: string, payload: UpdateVideoRequest) {
  await apiClient.patch(`/videos/${videoId}`, payload);
}
