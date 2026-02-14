export function extractApiErrorMessage(error: unknown): string | null {
  const maybeError = error as {
    response?: {
      data?: unknown;
    };
    message?: string;
  };

  const data = maybeError?.response?.data;
  if (typeof data === 'string' && data.trim().length > 0) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    const asRecord = data as Record<string, unknown>;
    const candidates = [asRecord.error, asRecord.message, asRecord.detail];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  if (typeof maybeError?.message === 'string' && maybeError.message.trim().length > 0) {
    return maybeError.message.trim();
  }

  return null;
}
