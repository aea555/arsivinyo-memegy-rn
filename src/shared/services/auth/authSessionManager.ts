import axios, { isAxiosError } from 'axios';

import { notifyTokenRefresh } from '@/src/shared/services/api/authEvents';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { API_BASE_URL } from '@/src/shared/utils/env';

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

type EnsureFreshTokenOptions = {
  force?: boolean;
  minValidityMs?: number;
  reason?: 'proactive' | 'reactive_401' | 'app_resume' | 'download' | 'websocket' | 'manual';
};

type RefreshDeferred = {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  sessionVersion: number;
};

type AuthSessionErrorCode =
  | 'missing_refresh_token'
  | 'invalid_refresh_response'
  | 'session_cleared'
  | 'stale_refresh_response'
  | 'refresh_failed';

export class AuthSessionError extends Error {
  constructor(public code: AuthSessionErrorCode, message: string) {
    super(message);
    this.name = 'AuthSessionError';
  }
}

const REFRESH_TIMEOUT_MS = 15_000;
const DEFAULT_MIN_VALIDITY_MS = 90_000;
const REFRESH_MAX_RETRIES = 2;
const REFRESH_BACKOFF_BASE_MS = 300;
const REFRESH_BACKOFF_JITTER_MS = 220;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessExpMs: number | null = null;
let sessionVersion = 0;
let refreshDeferred: RefreshDeferred | null = null;
let bootstrapPromise: Promise<void> | null = null;
let hasBootstrapped = false;
let writeQueue: Promise<void> = Promise.resolve();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padLength)}`;

  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (input: string, encoding: string) => { toString: (enc: string) => string } } }).Buffer;
  if (bufferCtor?.from) {
    return bufferCtor.from(padded, 'base64').toString('utf-8');
  }

  return null;
}

function decodeJwtExpMs(token: string) {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadRaw = decodeBase64Url(segments[1]);
    if (!payloadRaw) return null;
    const payload = JSON.parse(payloadRaw) as Partial<{ exp: number }>;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function setInMemorySession(tokens: SessionTokens | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  accessExpMs = accessToken ? decodeJwtExpMs(accessToken) : null;
}

function isNearExpiry(minValidityMs: number) {
  if (!accessToken) return true;
  if (!accessExpMs) return true;
  return Date.now() >= accessExpMs - minValidityMs;
}

function enqueueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

function isRetryableRefreshError(error: unknown) {
  if (!isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  const status = error.response.status;
  return status === 408 || status >= 500;
}

function getRetryDelay(attempt: number) {
  const exponential = REFRESH_BACKOFF_BASE_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * REFRESH_BACKOFF_JITTER_MS);
  return exponential + jitter;
}

async function refreshRequestWithRetry(currentAccessToken: string | null, currentRefreshToken: string, reason: EnsureFreshTokenOptions['reason']) {
  let attempt = 0;
  let lastError: unknown = null;
  const maxAttempts = REFRESH_MAX_RETRIES + 1;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      if (__DEV__) {
        console.debug('[auth.refresh] attempt', { attempt, reason });
      }

      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {
          access_token: currentAccessToken ?? '',
          refresh_token: currentRefreshToken,
        },
        {
          timeout: REFRESH_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status === 200,
        }
      );

      const data = response.data as Partial<{ access_token: string; refresh_token: string }>;
      if (!data.access_token || !data.refresh_token) {
        throw new AuthSessionError('invalid_refresh_response', 'Refresh response is missing token fields.');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      } satisfies SessionTokens;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableRefreshError(error);
      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      await wait(getRetryDelay(attempt));
    }
  }

  throw lastError ?? new AuthSessionError('refresh_failed', 'Refresh request failed.');
}

async function ensureBootstrapped() {
  if (hasBootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const session = await SecureStorage.getSession();
    if (session) {
      setInMemorySession(session);
      sessionVersion += 1;
    } else {
      setInMemorySession(null);
    }
    hasBootstrapped = true;
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

function createRefreshDeferred(version: number) {
  let resolve!: (value: string) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject, sessionVersion: version } satisfies RefreshDeferred;
}

export const authSessionManager = {
  async bootstrapFromStorage() {
    await ensureBootstrapped();
  },

  async setSession(tokens: SessionTokens) {
    await ensureBootstrapped();

    await enqueueWrite(async () => {
      await SecureStorage.setSession(tokens);
      sessionVersion += 1;
      setInMemorySession(tokens);
      hasBootstrapped = true;
    });
  },

  async clearSession() {
    await ensureBootstrapped();

    const pending = refreshDeferred;
    if (pending) {
      pending.reject(new AuthSessionError('session_cleared', 'Session was cleared while refresh was running.'));
      refreshDeferred = null;
    }

    await enqueueWrite(async () => {
      await SecureStorage.clearSession();
      sessionVersion += 1;
      setInMemorySession(null);
      hasBootstrapped = true;
    });
  },

  getAccessToken() {
    return accessToken;
  },

  hasValidAccessToken(minValidityMs = 0) {
    if (!accessToken) return false;
    if (!accessExpMs) return true;
    return Date.now() < accessExpMs - minValidityMs;
  },

  async ensureFreshToken(options: EnsureFreshTokenOptions = {}) {
    await ensureBootstrapped();

    const force = Boolean(options.force);
    const minValidityMs = options.minValidityMs ?? DEFAULT_MIN_VALIDITY_MS;

    if (!force && accessToken && !isNearExpiry(minValidityMs)) {
      return accessToken;
    }

    if (!refreshToken) {
      throw new AuthSessionError('missing_refresh_token', 'Refresh token is missing.');
    }

    if (refreshDeferred) {
      return refreshDeferred.promise;
    }

    const deferred = createRefreshDeferred(sessionVersion);
    refreshDeferred = deferred;

    void (async () => {
      try {
        const nextTokens = await refreshRequestWithRetry(accessToken, refreshToken!, options.reason ?? 'manual');

        await enqueueWrite(async () => {
          if (deferred.sessionVersion !== sessionVersion) {
            throw new AuthSessionError('stale_refresh_response', 'Discarding stale refresh response.');
          }

          await SecureStorage.setSession(nextTokens);
          sessionVersion += 1;
          setInMemorySession(nextTokens);
          hasBootstrapped = true;
        });

        if (__DEV__) {
          console.debug('[auth.refresh] success', {
            reason: options.reason ?? 'manual',
          });
        }

        notifyTokenRefresh();
        deferred.resolve(nextTokens.accessToken);
      } catch (error) {
        if (__DEV__) {
          console.debug('[auth.refresh] failed', {
            reason: options.reason ?? 'manual',
            retryable: isRetryableRefreshError(error),
          });
        }
        deferred.reject(error);
      } finally {
        if (refreshDeferred === deferred) {
          refreshDeferred = null;
        }
      }
    })();

    return deferred.promise;
  },
};
