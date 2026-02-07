export type DeleteVideoErrorCode =
  | 'rate_limited'
  | 'auth'
  | 'network'
  | 'server'
  | 'unknown';

export class DeleteVideoError extends Error {
  code: DeleteVideoErrorCode;
  status?: number;

  constructor(code: DeleteVideoErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'DeleteVideoError';
    this.code = code;
    this.status = status;
  }
}

function mapStatusToDeleteVideoError(status: number, message: string) {
  if (status === 429) return new DeleteVideoError('rate_limited', message, status);
  if (status === 401 || status === 403) return new DeleteVideoError('auth', message, status);
  if (status >= 500) return new DeleteVideoError('server', message, status);
  return new DeleteVideoError('unknown', message, status);
}

export function toDeleteVideoError(error: unknown): DeleteVideoError {
  if (error instanceof DeleteVideoError) return error;

  const maybeAxios = error as {
    response?: { status?: number };
    message?: string;
  };
  const message =
    typeof maybeAxios?.message === 'string' && maybeAxios.message.trim().length > 0
      ? maybeAxios.message
      : 'Delete video failed.';

  if (typeof maybeAxios?.response?.status === 'number') {
    return mapStatusToDeleteVideoError(maybeAxios.response.status, message);
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to connect')
  ) {
    return new DeleteVideoError('network', message);
  }

  return new DeleteVideoError('unknown', message);
}

export function isRetryableDeleteError(error: unknown) {
  const mapped = toDeleteVideoError(error);
  return mapped.code === 'network' || mapped.code === 'server';
}
