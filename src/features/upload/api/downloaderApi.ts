import * as FileSystem from 'expo-file-system';

import {
  DOWNLOADER_ACCESS_HEADER_NAME,
  DOWNLOADER_ACCESS_KEY,
  DOWNLOADER_API_BASE_URL,
  DOWNLOADER_APP_SECRET,
} from '@/src/shared/utils/env';

type DownloaderResponse<T> = {
  success: boolean;
  code: string;
  status_code: number;
  message?: string;
  data?: T;
};

type DownloadStartData = {
  task_id?: string;
  estimated_size_mb?: number | null;
};

type DownloadStatusData = {
  task_id?: string;
  status?: string;
  message?: string;
  filename?: string;
  data?: {
    filename?: string;
    data?: {
      filename?: string;
    };
  };
};

export type DownloaderTaskStatus = {
  taskId: string;
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'UNKNOWN';
  filename: string | null;
  message: string | null;
};

export type DownloadedTaskFile = {
  localUri: string;
  filename: string;
};

export class DownloaderApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'DownloaderApiError';
  }
}

function ensureDownloaderBaseUrl() {
  const baseUrl = DOWNLOADER_API_BASE_URL.trim();
  if (!baseUrl) {
    throw new DownloaderApiError(
      'DOWNLOADER_NOT_CONFIGURED',
      0,
      'Downloader API base URL is not configured.'
    );
  }
  return baseUrl.replace(/\/+$/, '');
}

function buildDownloaderHeaders(includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (DOWNLOADER_APP_SECRET) {
    headers['X-App-Secret'] = DOWNLOADER_APP_SECRET;
  }
  if (DOWNLOADER_ACCESS_KEY) {
    headers[DOWNLOADER_ACCESS_HEADER_NAME] = DOWNLOADER_ACCESS_KEY;
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<DownloaderResponse<T>> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'code' in payload &&
    'status_code' in payload
  ) {
    return payload as DownloaderResponse<T>;
  }

  throw new DownloaderApiError(
    'DOWNLOADER_INVALID_RESPONSE',
    response.status || 0,
    'Downloader API returned an invalid response.'
  );
}

function readFilenameFromStatusData(data: DownloadStatusData): string | null {
  const value =
    data.filename ??
    data.data?.filename ??
    data.data?.data?.filename ??
    null;

  if (!value || typeof value !== 'string') return null;
  return value;
}

function sanitizeFilename(value: string | null | undefined, fallback: string): string {
  const selected = value && value.trim().length > 0 ? value.trim() : fallback;
  const safe = selected.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  const normalized = safe.length > 0 ? safe : fallback;
  return normalized.includes('.') ? normalized : `${normalized}.mp4`;
}

export async function startDownload(url: string): Promise<{ taskId: string }> {
  const baseUrl = ensureDownloaderBaseUrl();
  const response = await fetch(`${baseUrl}/download`, {
    method: 'POST',
    headers: buildDownloaderHeaders(true),
    body: JSON.stringify({ url }),
  });

  const payload = await parseResponse<DownloadStartData>(response);
  if (!payload.success || !payload.data?.task_id) {
    throw new DownloaderApiError(
      payload.code || 'DOWNLOADER_START_FAILED',
      payload.status_code || response.status || 0,
      payload.message || 'Downloader failed to start.'
    );
  }

  return { taskId: payload.data.task_id };
}

export async function getTaskStatus(taskId: string): Promise<DownloaderTaskStatus> {
  const baseUrl = ensureDownloaderBaseUrl();
  const response = await fetch(`${baseUrl}/status/${taskId}`, {
    method: 'GET',
    headers: buildDownloaderHeaders(false),
  });

  const payload = await parseResponse<DownloadStatusData>(response);
  if (!payload.success || !payload.data) {
    throw new DownloaderApiError(
      payload.code || 'DOWNLOADER_STATUS_FAILED',
      payload.status_code || response.status || 0,
      payload.message || 'Downloader status request failed.'
    );
  }

  const rawStatus = payload.data.status ?? 'UNKNOWN';
  const status =
    rawStatus === 'PENDING' ||
    rawStatus === 'STARTED' ||
    rawStatus === 'PROGRESS' ||
    rawStatus === 'SUCCESS' ||
    rawStatus === 'FAILURE'
      ? rawStatus
      : 'UNKNOWN';

  return {
    taskId: payload.data.task_id ?? taskId,
    status,
    filename: readFilenameFromStatusData(payload.data),
    message: payload.data.message ?? payload.message ?? null,
  };
}

export async function downloadTaskFile(
  taskId: string,
  filenameHint: string | null
): Promise<DownloadedTaskFile> {
  const baseUrl = ensureDownloaderBaseUrl();
  const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheRoot) {
    throw new DownloaderApiError('DOWNLOADER_CACHE_UNAVAILABLE', 0, 'No writable cache directory found.');
  }

  const directory = `${cacheRoot.replace(/\/+$/, '')}/downloader-cache`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const fallbackName = `${taskId}.mp4`;
  const filename = sanitizeFilename(filenameHint, fallbackName);
  const localUri = `${directory}/${Date.now()}-${filename}`;
  const downloadUrl = `${baseUrl}/files/${taskId}`;

  const result = await FileSystem.downloadAsync(downloadUrl, localUri, {
    headers: buildDownloaderHeaders(false),
  });

  if (result.status < 200 || result.status >= 300) {
    throw new DownloaderApiError(
      'DOWNLOADER_FILE_FETCH_FAILED',
      result.status,
      'Failed to fetch downloaded media file.'
    );
  }

  const info = await FileSystem.getInfoAsync(result.uri);
  const sizeBytes = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || sizeBytes <= 0) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {
      // no-op
    });
    throw new DownloaderApiError(
      'DOWNLOADER_FILE_EMPTY',
      result.status,
      'Downloader returned an empty file.'
    );
  }

  return { localUri: result.uri, filename };
}
