import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { AuthTemporaryUnavailableError, authSessionManager } from '@/src/shared/services/auth/authSessionManager';
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

function getAxiosErrorSummary(error: unknown) {
  const axiosError = error as AxiosError | undefined;
  if (!axiosError) {
    return { message: String(error) };
  }
  return {
    code: axiosError.code,
    status: axiosError.response?.status,
    message: axiosError.message,
    hasResponse: Boolean(axiosError.response),
    isTimeout:
      axiosError.code === 'ECONNABORTED' ||
      (typeof axiosError.message === 'string' && axiosError.message.toLowerCase().includes('timeout')),
  };
}

async function clearSessionAndLogout() {
  if (__DEV__) {
    console.debug('[api] clearSessionAndLogout:start', {
      snapshot: authSessionManager.getDebugSnapshot(),
    });
  }
  try {
    await authSessionManager.clearSession();
  } finally {
    await notifyLogout();
    if (__DEV__) {
      console.debug('[api] clearSessionAndLogout:done', {
        snapshot: authSessionManager.getDebugSnapshot(),
      });
    }
  }
}

function toTemporaryAuthError(error: unknown) {
  if (error instanceof AuthTemporaryUnavailableError) {
    return error;
  }
  const blockState = authSessionManager.getRefreshBlockState();
  return new AuthTemporaryUnavailableError(
    authSessionManager.isRateLimitedRefreshFailure(error)
      ? 'refresh_rate_limited'
      : 'refresh_transient_unavailable',
    'Authentication temporarily unavailable.',
    undefined,
    blockState.blockedUntilMs
  );
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const skipProactiveRefreshOnce = config._skipProactiveRefreshOnce === true;
  if (skipProactiveRefreshOnce) {
    config._skipProactiveRefreshOnce = false;
  }

  if (!config.skipAuthRefresh) {
    const existingToken = authSessionManager.getAccessToken();
    let proactiveDecision: 'skipped' | 'ok' | 'failed_use_stale' | 'blocked_unusable' = 'skipped';

    if (!skipProactiveRefreshOnce) {
      try {
        await authSessionManager.ensureFreshToken({
          force: false,
          minValidityMs: REQUEST_TOKEN_SKEW_MS,
          reason: 'proactive',
        });
        proactiveDecision = 'ok';
      } catch (error) {
        const hasUsableAccess = authSessionManager.hasValidAccessToken(0);
        if (hasUsableAccess) {
          proactiveDecision = 'failed_use_stale';
        } else if (authSessionManager.isTerminalRefreshFailure(error)) {
          if (__DEV__) {
            console.debug('[api] proactive refresh failed', {
              url: `${config.baseURL ?? ''}${config.url ?? ''}`,
              decision: 'terminal_logout',
              retryable: authSessionManager.isRetryableRefreshFailure(error),
              clearSession: true,
              snapshot: authSessionManager.getDebugSnapshot(),
              error: getAxiosErrorSummary(error),
            });
          }
          await clearSessionAndLogout();
          return Promise.reject(error);
        } else {
          proactiveDecision = 'blocked_unusable';
          if (__DEV__) {
            console.debug('[api] proactive refresh failed', {
              url: `${config.baseURL ?? ''}${config.url ?? ''}`,
              decision: proactiveDecision,
              retryable: authSessionManager.isRetryableRefreshFailure(error),
              clearSession: false,
              blockedUntilMs: authSessionManager.getRefreshBlockState().blockedUntilMs,
              snapshot: authSessionManager.getDebugSnapshot(),
              error: getAxiosErrorSummary(error),
            });
          }
          return Promise.reject(toTemporaryAuthError(error));
        }
      }
    }

    const token = authSessionManager.getAccessToken();
    if (token ?? existingToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token ?? existingToken}`;
    }

    if (__DEV__ && !skipProactiveRefreshOnce) {
      console.debug('[api] auth decision', {
        url: `${config.baseURL ?? ''}${config.url ?? ''}`,
        decision: proactiveDecision,
        skipAuthRefresh: Boolean(config.skipAuthRefresh),
        skipProactiveRefreshOnce,
        snapshot: authSessionManager.getDebugSnapshot(),
      });
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
      if (__DEV__) {
        console.debug('[api] response 401', {
          url: `${originalRequest.baseURL ?? ''}${originalRequest.url ?? ''}`,
          hasRetried: Boolean(originalRequest._retry),
          snapshot: authSessionManager.getDebugSnapshot(),
          error: getAxiosErrorSummary(error),
        });
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const token = await authSessionManager.ensureFreshToken({
            force: true,
            reason: 'reactive_401',
          });
          originalRequest._skipProactiveRefreshOnce = true;
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          if (authSessionManager.shouldClearSessionAfterRefreshFailure(refreshError)) {
            await clearSessionAndLogout();
          } else if (__DEV__) {
            console.debug('[api] reactive refresh failed (session preserved)', {
              url: `${originalRequest.baseURL ?? ''}${originalRequest.url ?? ''}`,
              retryable: authSessionManager.isRetryableRefreshFailure(refreshError),
              clearSession: false,
              blockedUntilMs: authSessionManager.getRefreshBlockState().blockedUntilMs,
              snapshot: authSessionManager.getDebugSnapshot(),
              error: getAxiosErrorSummary(refreshError),
            });
          }
          return Promise.reject(toTemporaryAuthError(refreshError));
        }
      }

      if (__DEV__) {
        console.debug('[api] response 401 after retry -> logout', {
          url: `${originalRequest.baseURL ?? ''}${originalRequest.url ?? ''}`,
          snapshot: authSessionManager.getDebugSnapshot(),
        });
      }
      await clearSessionAndLogout();
    }

    if (__DEV__) {
      const url = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
      console.debug('[api] error', {
        url,
        status: error.response?.status,
        snapshot: authSessionManager.getDebugSnapshot(),
        error: getAxiosErrorSummary(error),
      });
    }

    return Promise.reject(error);
  }
);
