import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { notifyLogout } from './authEvents';
import { API_BASE_URL } from '@/src/shared/utils/env';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const REQUEST_TOKEN_SKEW_MS = 90_000;

async function clearSessionAndLogout() {
  try {
    await authSessionManager.clearSession();
  } finally {
    await notifyLogout();
  }
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!config.skipAuthRefresh) {
    try {
      await authSessionManager.ensureFreshToken({
        force: false,
        minValidityMs: REQUEST_TOKEN_SKEW_MS,
        reason: 'proactive',
      });
    } catch (error) {
      if (__DEV__) {
        console.debug('[api] proactive refresh failed', {
          url: `${config.baseURL ?? ''}${config.url ?? ''}`,
        });
      }

      if (!authSessionManager.hasValidAccessToken()) {
        await clearSessionAndLogout();
        return Promise.reject(error);
      }
    }

    const token = authSessionManager.getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (__DEV__) {
    const method = config.method?.toUpperCase();
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    if (url.includes('/auth/')) {
      console.debug('[api] request', {
        method,
        url,
        params: config.params,
      });
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest.skipAuthRefresh) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const token = await authSessionManager.ensureFreshToken({
            force: true,
            reason: 'reactive_401',
          });
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          await clearSessionAndLogout();
          return Promise.reject(refreshError);
        }
      }

      await clearSessionAndLogout();
    }

    if (__DEV__) {
      const url = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
      if (url.includes('/auth/')) {
        console.debug('[api] error', {
          url,
          status: error.response?.status,
        });
      }
    }

    return Promise.reject(error);
  }
);
