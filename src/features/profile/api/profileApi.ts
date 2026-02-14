import { isAxiosError } from 'axios';

import { apiClient } from '@/src/shared/services/api/apiClient';
import { useAuthStore } from '@/src/store/authStore';
import { mapUserVideoDtoToMyVideoItem } from '@/src/features/profile/utils/myVideoMapper';
import {
  ApiErrorResponse,
  UpdateUsernameRequest,
  UpdateVideoRequest,
  UserDto,
  UserVideoDto,
} from '@/src/shared/types/api';
import { toDeleteVideoError } from '@/src/features/profile/utils/deleteVideoErrors';

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

export type UpdateUsernameErrorCode =
  | 'invalid_username'
  | 'auth'
  | 'username_taken'
  | 'idempotency_mismatch'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class UpdateUsernameError extends Error {
  constructor(
    public code: UpdateUsernameErrorCode,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'UpdateUsernameError';
  }
}

function toUpdateUsernameError(error: unknown) {
  if (!isAxiosError(error)) {
    return new UpdateUsernameError('unknown', 'Unknown error');
  }

  if (!error.response) {
    return new UpdateUsernameError('network', error.message || 'Network error');
  }

  const status = error.response.status;
  const data = error.response.data as ApiErrorResponse | undefined;
  const errorCode = typeof data?.error === 'string' ? data.error : null;

  if (status === 400) {
    return new UpdateUsernameError('invalid_username', 'Invalid username', status);
  }
  if (status === 401 || status === 403) {
    return new UpdateUsernameError('auth', 'Authentication required', status);
  }
  if (status === 409) {
    if (errorCode === 'idempotency_key_reuse_mismatch') {
      return new UpdateUsernameError('idempotency_mismatch', 'Idempotency key mismatch', status);
    }
    return new UpdateUsernameError('username_taken', 'Username already taken', status);
  }
  if (status === 429) {
    return new UpdateUsernameError('rate_limited', 'Rate limited', status);
  }

  return new UpdateUsernameError('unknown', error.message || 'Unknown error', status);
}

type UpdateMyUsernameOptions = {
  idempotencyKey?: string;
};

export async function updateMyUsername(
  payload: UpdateUsernameRequest,
  options: UpdateMyUsernameOptions = {}
) {
  try {
    const response = await apiClient.put<UserDto>('/users/me/username', payload, {
      headers: options.idempotencyKey
        ? { 'Idempotency-Key': options.idempotencyKey }
        : undefined,
    });
    return response.data;
  } catch (error) {
    throw toUpdateUsernameError(error);
  }
}

// Backend semantics:
// - Soft-delete only (record remains)
// - Idempotent 204 for already deleted
// - Owner-only (404 for missing/not-owned)
export async function deleteVideo(videoId: string): Promise<'deleted' | 'already_gone'> {
  const endpoint = `/videos/${videoId}`;

  if (__DEV__) {
    console.debug('[video.delete] request', {
      method: 'DELETE',
      endpoint,
      videoId,
    });
  }

  try {
    const response = await apiClient.delete(endpoint);
    if (__DEV__) {
      console.debug('[video.delete] response', {
        endpoint,
        status: response.status,
        videoId,
      });
    }
    return 'deleted';
  } catch (error: any) {
    if (__DEV__) {
      console.debug('[video.delete] error', {
        endpoint,
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
        videoId,
      });
    }

    if (error?.response?.status === 404) {
      return 'already_gone';
    }

    throw toDeleteVideoError(error);
  }
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

export async function updateMyVideoMetadata(videoId: string, payload: UpdateVideoRequest): Promise<void> {
  const endpoint = `/videos/${videoId}`;
  const startedAt = Date.now();
  const changedFields = Object.keys(payload).filter((key) =>
    ['title', 'description', 'is_anonymous'].includes(key)
  );

  if (__DEV__) {
    console.debug('[video.update] request', {
      method: 'PATCH',
      endpoint,
      videoId,
      changedFields,
    });
  }

  try {
    const response = await apiClient.patch(endpoint, payload);
    if (__DEV__) {
      console.debug('[video.update] response', {
        endpoint,
        status: response.status,
        videoId,
        changedFields,
        elapsedMs: Date.now() - startedAt,
      });
    }
  } catch (error: any) {
    if (__DEV__) {
      const status = error?.response?.status;
      const statusClass = typeof status === 'number' ? `${Math.floor(status / 100)}xx` : 'none';
      console.debug('[video.update] error', {
        endpoint,
        status,
        statusClass,
        videoId,
        changedFields,
        elapsedMs: Date.now() - startedAt,
        data: error?.response?.data,
        message: error?.message,
      });
    }
    throw error;
  }
}
