import axios, { AxiosError, InternalAxiosRequestConfig, isAxiosError } from 'axios';

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

const REFRESH_RETRY_MAX_ATTEMPTS = 3;
const REFRESH_RETRY_BASE_DELAY_MS = 400;

type RefreshTokens = {
  accessToken: string;
  refreshToken: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestTokenRefresh(): Promise<RefreshTokens> {
  const accessToken = await SecureStorage.getAccessToken();
  const refreshToken = await SecureStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error('missing_refresh_token');
  }

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data as Partial<{ access_token: string; refresh_token: string }>;
  if (!data.access_token || !data.refresh_token) {
    throw new Error('invalid_refresh_response');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

function isRetryableRefreshError(error: unknown) {
  if (!isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  const status = error.response.status;
  return status === 408 || status === 429 || status >= 500;
}

function shouldForceLogoutAfterRefreshFailure(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'missing_refresh_token' || error.message === 'invalid_refresh_response') {
      return true;
    }
  }

  if (!isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return false;
  }

  const status = error.response.status;
  return status === 400 || status === 401 || status === 403;
}

async function refreshTokensWithRetry(): Promise<RefreshTokens> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < REFRESH_RETRY_MAX_ATTEMPTS) {
    attempt += 1;

    try {
      return await requestTokenRefresh();
    } catch (error) {
      lastError = error;
      if (!isRetryableRefreshError(error) || attempt >= REFRESH_RETRY_MAX_ATTEMPTS) {
        throw error;
      }
      await wait(REFRESH_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError ?? new Error('refresh_failed');
}

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
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken, refreshToken } = await refreshTokensWithRetry();
        await SecureStorage.setTokens(accessToken, refreshToken);
        notifyTokenRefresh();
        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (shouldForceLogoutAfterRefreshFailure(refreshError)) {
          await SecureStorage.clearTokens();
          await notifyLogout();
        }
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
