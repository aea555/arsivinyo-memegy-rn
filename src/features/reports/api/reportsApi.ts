import { apiClient } from '@/src/shared/services/api/apiClient';
import {
  MyReportsResponse,
  ReportVideoRequest,
  ReportVideoResponse,
} from '@/src/shared/types/api';

export async function reportVideo(videoId: string, payload: ReportVideoRequest) {
  const response = await apiClient.post<ReportVideoResponse>(`/videos/${videoId}/report`, payload, {
    validateStatus: (status) => status === 200 || status === 201,
  });
  return response.data;
}

export async function getMyReports(limit: number, cursor?: number | null) {
  const response = await apiClient.get<MyReportsResponse>('/users/me/reports', {
    params: {
      limit,
      ...(typeof cursor === 'number' ? { cursor } : {}),
    },
  });
  return response.data;
}
