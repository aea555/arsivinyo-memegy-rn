import { apiClient } from '@/src/shared/services/api/apiClient';
import {
  BulkDownloadCreateRequest,
  BulkDownloadCreateResponse,
  BulkDownloadStatusResponse,
  RefreshDownloadResponse,
} from '@/src/shared/types/api';
import { API_BASE_URL } from '@/src/shared/utils/env';

function toAbsoluteUrl(path: string) {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
}

export function getDownloadRedirectEndpoint(videoId: string) {
  return `/videos/${videoId}/download`;
}

export function getDownloadRedirectUrl(videoId: string) {
  return toAbsoluteUrl(getDownloadRedirectEndpoint(videoId));
}

export async function refreshDownloadUrl(videoId: string) {
  const endpoint = `/videos/${videoId}/download/refresh`;
  const response = await apiClient.post<RefreshDownloadResponse>(endpoint);
  return response.data;
}

export async function createBulkDownloadJob(payload: BulkDownloadCreateRequest) {
  const endpoint = '/videos/download/bulk';
  const response = await apiClient.post<BulkDownloadCreateResponse>(endpoint, payload);
  return response.data;
}

export async function getBulkDownloadJob(jobId: string) {
  const endpoint = `/videos/download/bulk/${jobId}`;
  const response = await apiClient.get<BulkDownloadStatusResponse>(endpoint);
  return response.data;
}
