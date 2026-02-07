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
  | 'refresh_failed'
  | 'refresh_unrecoverable';

export class AuthSessionError extends Error {
  constructor(public code: AuthSessionErrorCode, message: string) {
    super(message);
    this.name = 'AuthSessionError';
  }
}

type RefreshBlockReason = 'rate_limited' | 'transient';

export class AuthTemporaryUnavailableError extends Error {
  constructor(
    public code: 'refresh_rate_limited' | 'refresh_transient_unavailable',
    message: string,
    public status?: number,
    public blockedUntilMs: number | null = null
  ) {
    super(message);
    this.name = 'AuthTemporaryUnavailableError';
  }
}

const REFRESH_TIMEOUT_MS = 15_000;
const DEFAULT_MIN_VALIDITY_MS = 90_000;
const REFRESH_MAX_RETRIES = 2;
const REFRESH_BACKOFF_BASE_MS = 300;
const REFRESH_BACKOFF_JITTER_MS = 220;
const RETRYABLE_REFRESH_COOLDOWN_MS = 8_000;
const TRANSIENT_REFRESH_BLOCK_MS = 12_000;
const RATE_LIMIT_DEFAULT_BLOCK_MS = 60_000;
const MAX_REFRESH_FAILURES_WITHOUT_USABLE_ACCESS = 3;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessExpMs: number | null = null;
let sessionVersion = 0;
let refreshDeferred: RefreshDeferred | null = null;
let bootstrapPromise: Promise<void> | null = null;
let hasBootstrapped = false;
let writeQueue: Promise<void> = Promise.resolve();
let lastRefreshFailure: { at: number; retryable: boolean; error: unknown } | null = null;
let refreshConsecutiveFailures = 0;
let refreshLastFailureAt: number | null = null;
let refreshBlockedUntilMs: number | null = null;
let refreshLastFailureStatus: number | null = null;
let refreshLastFailureRetryable = false;
let refreshBlockReason: RefreshBlockReason | null = null;

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

function getAxiosStatus(error: unknown) {
  if (!isAxiosError(error)) return undefined;
  return error.response?.status;
}

function getAxiosRetryAfter(error: unknown) {
  if (!isAxiosError(error) || !error.response) return null;

  const rawHeader = error.response.headers?.['retry-after'];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (headerValue == null) return null;

  if (typeof headerValue === 'number' && Number.isFinite(headerValue) && headerValue >= 0) {
    return headerValue * 1000;
  }
  if (typeof headerValue !== 'string') return null;

  const numericSeconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return numericSeconds * 1000;
  }

  const retryAtMs = Date.parse(headerValue);
  if (!Number.isFinite(retryAtMs)) return null;
  const delta = retryAtMs - Date.now();
  return delta > 0 ? delta : null;
}

function clearRefreshHealthState() {
  refreshConsecutiveFailures = 0;
  refreshLastFailureAt = null;
  refreshBlockedUntilMs = null;
  refreshLastFailureStatus = null;
  refreshLastFailureRetryable = false;
  refreshBlockReason = null;
}

function applyRefreshBlock(reason: RefreshBlockReason, durationMs: number) {
  const nextBlockedUntil = Date.now() + Math.max(0, durationMs);
  refreshBlockedUntilMs = Math.max(refreshBlockedUntilMs ?? 0, nextBlockedUntil);
  refreshBlockReason = reason;
}

function getRefreshBlockStateInternal() {
  if (!refreshBlockedUntilMs) {
    return {
      blocked: false as const,
      blockedUntilMs: null,
      reason: null,
    };
  }

  if (Date.now() >= refreshBlockedUntilMs) {
    refreshBlockedUntilMs = null;
    refreshBlockReason = null;
    return {
      blocked: false as const,
      blockedUntilMs: null,
      reason: null,
    };
  }

  return {
    blocked: true as const,
    blockedUntilMs: refreshBlockedUntilMs,
    reason: refreshBlockReason,
  };
}

function isRateLimitedRefreshFailure(error: unknown) {
  if (error instanceof AuthTemporaryUnavailableError) {
    return error.code === 'refresh_rate_limited';
  }
  return getAxiosStatus(error) === 429;
}

function isTransientRefreshFailure(error: unknown) {
  if (error instanceof AuthTemporaryUnavailableError) {
    return error.code === 'refresh_transient_unavailable';
  }

  if (!isAxiosError(error)) {
    return false;
  }

  if (!error.response) return true;
  const status = error.response.status;
  return status === 408 || status >= 500;
}

function isTerminalRefreshFailure(error: unknown) {
  if (error instanceof AuthSessionError) {
    return (
      error.code === 'missing_refresh_token' ||
      error.code === 'invalid_refresh_response' ||
      error.code === 'session_cleared' ||
      error.code === 'refresh_unrecoverable'
    );
  }

  if (!isAxiosError(error) || !error.response) {
    return false;
  }

  const status = error.response.status;
  return status === 400 || status === 401 || status === 403;
}

function isAuthTemporaryUnavailableError(error: unknown): error is AuthTemporaryUnavailableError {
  return error instanceof AuthTemporaryUnavailableError;
}

function shouldClearSessionAfterRefreshFailure(error: unknown) {
  return isTerminalRefreshFailure(error);
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
      lastRefreshFailure = null;
      clearRefreshHealthState();
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
      lastRefreshFailure = null;
      clearRefreshHealthState();
      hasBootstrapped = true;
    });
  },

  getAccessToken() {
    return accessToken;
  },

  hasRefreshToken() {
    return Boolean(refreshToken);
  },

  hasValidAccessToken(minValidityMs = 0) {
    if (!accessToken) return false;
    if (!accessExpMs) return true;
    return Date.now() < accessExpMs - minValidityMs;
  },

  isRetryableRefreshFailure(error: unknown) {
    return isTransientRefreshFailure(error);
  },

  shouldClearSessionAfterRefreshFailure(error: unknown) {
    return shouldClearSessionAfterRefreshFailure(error);
  },

  isTerminalRefreshFailure(error: unknown) {
    return isTerminalRefreshFailure(error);
  },

  isRateLimitedRefreshFailure(error: unknown) {
    return isRateLimitedRefreshFailure(error);
  },

  isTransientRefreshFailure(error: unknown) {
    return isTransientRefreshFailure(error);
  },

  isAuthTemporaryUnavailableError(error: unknown): error is AuthTemporaryUnavailableError {
    return isAuthTemporaryUnavailableError(error);
  },

  getRefreshBlockState() {
    const blockState = getRefreshBlockStateInternal();
    return {
      ...blockState,
      failureCount: refreshConsecutiveFailures,
      lastFailureAt: refreshLastFailureAt,
      lastFailureStatus: refreshLastFailureStatus,
      lastFailureRetryable: refreshLastFailureRetryable,
    };
  },

  async ensureFreshToken(options: EnsureFreshTokenOptions = {}) {
    await ensureBootstrapped();

    const force = Boolean(options.force);
    const bypassTransientBackoff = force && options.reason === 'reactive_401';
    const minValidityMs = options.minValidityMs ?? DEFAULT_MIN_VALIDITY_MS;

    if (!force && accessToken && !isNearExpiry(minValidityMs)) {
      if (__DEV__) {
        console.debug('[auth.refresh] skip', {
          reason: options.reason ?? 'manual',
          force,
          decision: 'access_valid',
        });
      }
      return accessToken;
    }

    const blockState = getRefreshBlockStateInternal();
    if (blockState.blocked) {
      const isRateLimitBlock = blockState.reason === 'rate_limited';
      // Only protected-request 401 recovery may bypass transient blocks; all other flows should respect backoff.
      if (!bypassTransientBackoff || isRateLimitBlock) {
        const blockedError = new AuthTemporaryUnavailableError(
          isRateLimitBlock ? 'refresh_rate_limited' : 'refresh_transient_unavailable',
          isRateLimitBlock ? 'Refresh temporarily rate limited.' : 'Refresh temporarily unavailable.',
          isRateLimitBlock ? 429 : refreshLastFailureStatus ?? undefined,
          blockState.blockedUntilMs
        );
        if (__DEV__) {
          console.debug('[auth.refresh] blocked', {
            reason: options.reason ?? 'manual',
            force,
            blockedUntilMs: blockState.blockedUntilMs,
            blockReason: blockState.reason,
          });
        }
        if (!force && accessToken) {
          return accessToken;
        }
        throw blockedError;
      }
    }

    if (
      !bypassTransientBackoff &&
      lastRefreshFailure?.retryable &&
      Date.now() - lastRefreshFailure.at < RETRYABLE_REFRESH_COOLDOWN_MS
    ) {
      if (accessToken) {
        return accessToken;
      }
      throw new AuthTemporaryUnavailableError(
        'refresh_transient_unavailable',
        'Refresh temporarily unavailable.',
        refreshLastFailureStatus ?? undefined,
        refreshBlockedUntilMs
      );
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
        lastRefreshFailure = null;
        clearRefreshHealthState();
        deferred.resolve(nextTokens.accessToken);
      } catch (error) {
        const status = getAxiosStatus(error) ?? null;
        const retryable = isRetryableRefreshError(error);
        const rateLimited = isRateLimitedRefreshFailure(error);
        const terminal = isTerminalRefreshFailure(error);

        lastRefreshFailure = {
          at: Date.now(),
          retryable,
          error,
        };
        refreshConsecutiveFailures += 1;
        refreshLastFailureAt = lastRefreshFailure.at;
        refreshLastFailureStatus = status;
        refreshLastFailureRetryable = retryable;

        if (rateLimited) {
          applyRefreshBlock('rate_limited', getAxiosRetryAfter(error) ?? RATE_LIMIT_DEFAULT_BLOCK_MS);
        } else if (retryable) {
          const transientBlockDurationMs = Math.min(
            RATE_LIMIT_DEFAULT_BLOCK_MS,
            TRANSIENT_REFRESH_BLOCK_MS * Math.max(1, refreshConsecutiveFailures)
          );
          applyRefreshBlock('transient', transientBlockDurationMs);
        }

        const hasUsableAccessToken = Boolean(accessToken) && !isNearExpiry(0);
        const shouldEscalateToUnrecoverable = force && options.reason === 'reactive_401';
        const exceededUnrecoverableThreshold =
          shouldEscalateToUnrecoverable &&
          !hasUsableAccessToken &&
          refreshConsecutiveFailures >= MAX_REFRESH_FAILURES_WITHOUT_USABLE_ACCESS;

        const blockState = getRefreshBlockStateInternal();
        const rejectError = terminal || exceededUnrecoverableThreshold
          ? new AuthSessionError(
            'refresh_unrecoverable',
            terminal
              ? 'Refresh failed with terminal auth error.'
              : 'Refresh repeatedly failed without a usable access token.'
          )
          : rateLimited
            ? new AuthTemporaryUnavailableError(
              'refresh_rate_limited',
              'Refresh temporarily rate limited.',
              status ?? 429,
              blockState.blockedUntilMs
            )
            : new AuthTemporaryUnavailableError(
              'refresh_transient_unavailable',
              'Refresh temporarily unavailable.',
              status ?? undefined,
              blockState.blockedUntilMs
            );

        if (__DEV__) {
          console.debug('[auth.refresh] failed', {
            reason: options.reason ?? 'manual',
            force,
            retryable,
            terminal,
            status,
            blockedUntilMs: blockState.blockedUntilMs,
            failureCount: refreshConsecutiveFailures,
            clearSession: shouldClearSessionAfterRefreshFailure(rejectError),
          });
        }
        deferred.reject(rejectError);
      } finally {
        if (refreshDeferred === deferred) {
          refreshDeferred = null;
        }
      }
    })();

    return deferred.promise;
  },
};
