export type DownloadErrorCode =
  | 'auth'
  | 'not_found'
  | 'rate_limited'
  | 'permission_denied'
  | 'network'
  | 'server'
  | 'expired_or_redirect'
  | 'unknown'
  | 'concurrency_limited';

export class DownloadError extends Error {
  code: DownloadErrorCode;
  status?: number;

  constructor(code: DownloadErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.status = status;
  }
}

function parseStatusFromMessage(message: string) {
  const match = message.match(/\b([1-5]\d{2})\b/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapStatusToDownloadError(status: number, message?: string) {
  if (status === 401) return new DownloadError('auth', message ?? 'Authentication required.', status);
  if (status === 404) return new DownloadError('not_found', message ?? 'Video unavailable.', status);
  if (status === 429) return new DownloadError('rate_limited', message ?? 'Rate limited.', status);
  if (status === 302 || status === 303 || status === 307 || status === 308 || status === 403) {
    return new DownloadError('expired_or_redirect', message ?? 'Redirect/presigned URL issue.', status);
  }
  if (status >= 500) return new DownloadError('server', message ?? 'Server error.', status);
  return new DownloadError('unknown', message ?? 'Unknown download error.', status);
}

export function toDownloadError(error: unknown): DownloadError {
  if (error instanceof DownloadError) return error;

  const maybeAxios = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };

  if (typeof maybeAxios?.response?.status === 'number') {
    return mapStatusToDownloadError(maybeAxios.response.status, maybeAxios.message);
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusFromMessage = parseStatusFromMessage(message);
  if (typeof statusFromMessage === 'number') {
    return mapStatusToDownloadError(statusFromMessage, message);
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('permission')) {
    return new DownloadError('permission_denied', message);
  }
  if (normalized.includes('network') || normalized.includes('timeout') || normalized.includes('failed to connect')) {
    return new DownloadError('network', message);
  }

  return new DownloadError('unknown', message);
}

export function shouldTryRefreshFallback(error: DownloadError) {
  return error.code === 'expired_or_redirect' || error.code === 'network' || error.code === 'server';
}
