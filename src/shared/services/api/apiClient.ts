import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { SecureStorage } from '../storage/SecureStorage';
import { notifyLogout, notifyTokenRefresh } from './authEvents';
import { API_BASE_URL } from '@/src/shared/utils/env';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStorage.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) {
    const method = config.method?.toUpperCase();
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    if (url.includes('/auth/')) {
      console.debug('[api] request', {
        method,
        url,
        params: config.params,
        data: config.data,
      });
    }
  }

  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (value: string | null) => void; reject: (error: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const accessToken = await SecureStorage.getAccessToken();
      const refreshToken = await SecureStorage.getRefreshToken();

      if (!refreshToken) {
        await SecureStorage.clearTokens();
        await notifyLogout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data as {
          access_token: string;
          refresh_token: string;
        };

        await SecureStorage.setTokens(access_token, refresh_token);
        notifyTokenRefresh();
        apiClient.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStorage.clearTokens();
        await notifyLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (__DEV__) {
      const url = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
      if (url.includes('/auth/')) {
        console.debug('[api] error', {
          url,
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    }

    return Promise.reject(error);
  }
);
