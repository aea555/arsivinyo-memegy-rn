import * as FileSystem from 'expo-file-system/legacy';

import {
  cancelTask,
  DownloaderApiError,
  DownloaderTaskStatus,
  getTaskStatus,
  startDownload,
} from '@/src/features/upload/api/downloaderApi';
import {
  getDefaultCookieProfile,
} from '@/src/features/upload/services/downloaderCookies';
import { NormalizedVideoAsset, UploadValidationError } from '@/src/features/upload/types/uploadTypes';
import { getClipboardUrlForDownloader } from '@/src/features/upload/utils/clipboardDownloader';
import { getDownloaderPlatformFromUrl } from '@/src/features/upload/utils/downloaderPlatforms';
import { validateNormalizedVideoAsset } from '@/src/features/upload/utils/uploadValidation';

type DownloaderBridgeProgressState =
  | 'starting'
  | 'polling'
  | 'fetching'
  | 'ready';

type DownloaderBridgeOptions = {
  shouldCancel?: () => boolean;
  onProgress?: (progress: { state: DownloaderBridgeProgressState; taskId?: string | null }) => void;
};

type DownloaderBridgeResult = {
  asset: NormalizedVideoAsset;
  downloadedFilename: string;
  fallbackTitle: string;
};

const POLLING_INTERVALS_MS = {
  initial: 1200,
  medium: 2500,
  slow: 4500,
};

const MAX_POLLING_ATTEMPTS = 120;

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  '3gp': 'video/3gpp',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPollingInterval(elapsedMs: number) {
  if (elapsedMs < 30000) return POLLING_INTERVALS_MS.initial;
  if (elapsedMs < 120000) return POLLING_INTERVALS_MS.medium;
  return POLLING_INTERVALS_MS.slow;
}

function assertNotCancelled(shouldCancel?: () => boolean) {
  if (shouldCancel?.()) {
    throw new DownloaderApiError('DOWNLOAD_CANCELLED', 0, 'Download cancelled.');
  }
}

function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return `file://${path}`;
}

function extractExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  if (index <= -1 || index >= filename.length - 1) return 'mp4';
  return filename.slice(index + 1).toLowerCase();
}

function inferMimeType(filename: string): string {
  return MIME_BY_EXTENSION[extractExtension(filename)] ?? 'video/mp4';
}

function getFilenameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

function getFilenameFromStatus(status: DownloaderTaskStatus): string {
  if (status.filename?.trim()) {
    return status.filename.trim();
  }

  const filePath = status.filePath?.trim();
  if (!filePath) return `${status.taskId}.mp4`;
  const fromPath = filePath.split('/').pop();
  return fromPath && fromPath.length > 0 ? fromPath : `${status.taskId}.mp4`;
}

async function resolveDefaultCookieProfileForUrl(url: string): Promise<{
  cookiePlatform: ReturnType<typeof getDownloaderPlatformFromUrl>;
  cookieProfile?: string;
}> {
  const cookiePlatform = getDownloaderPlatformFromUrl(url);
  if (!cookiePlatform) {
    return { cookiePlatform: null };
  }

  try {
    const cookieProfile = await getDefaultCookieProfile(cookiePlatform);
    return {
      cookiePlatform,
      cookieProfile: cookieProfile ?? undefined,
    };
  } catch {
    return { cookiePlatform };
  }
}

async function pollUntilFinished(
  taskId: string,
  shouldCancel?: () => boolean,
  onProgress?: (progress: { state: DownloaderBridgeProgressState; taskId?: string | null }) => void
): Promise<DownloaderTaskStatus> {
  const startedAt = Date.now();
  let attempts = 0;

  while (attempts < MAX_POLLING_ATTEMPTS) {
    if (shouldCancel?.()) {
      await cancelTask(taskId).catch(() => {
        // no-op
      });
      throw new DownloaderApiError('DOWNLOAD_CANCELLED', 0, 'Download cancelled.');
    }

    const status = await getTaskStatus(taskId);
    onProgress?.({ state: 'polling', taskId: status.taskId });

    if (status.status === 'SUCCESS') {
      return status;
    }
    if (status.status === 'CANCELLED') {
      throw new DownloaderApiError('DOWNLOAD_CANCELLED', 0, status.message || 'Download cancelled.');
    }
    if (status.status === 'FAILURE') {
      throw new DownloaderApiError(
        status.errorCode || 'TASK_FAILED',
        500,
        status.message || 'Downloader task failed.'
      );
    }

    attempts += 1;
    await sleep(getPollingInterval(Date.now() - startedAt));
  }

  throw new DownloaderApiError('TASK_TIMEOUT', 408, 'Downloader task timed out.');
}

export async function downloadFromClipboardToNormalizedAsset(
  options: DownloaderBridgeOptions = {}
): Promise<DownloaderBridgeResult> {
  const { shouldCancel, onProgress } = options;

  assertNotCancelled(shouldCancel);
  onProgress?.({ state: 'starting', taskId: null });

  const url = await getClipboardUrlForDownloader();
  const cookieHint = await resolveDefaultCookieProfileForUrl(url);

  assertNotCancelled(shouldCancel);
  const { taskId } = await startDownload({
    url,
    cookiePlatform: cookieHint.cookiePlatform ?? undefined,
    cookieProfile: cookieHint.cookieProfile,
  });
  onProgress?.({ state: 'polling', taskId });

  const finalStatus = await pollUntilFinished(taskId, shouldCancel, onProgress);
  assertNotCancelled(shouldCancel);

  onProgress?.({ state: 'fetching', taskId });

  const filePath = finalStatus.filePath?.trim();
  if (!filePath) {
    throw new DownloaderApiError('FILE_NOT_FOUND', 404, 'Downloaded file path is missing.');
  }

  const localUri = toFileUri(filePath);
  const filename = getFilenameFromStatus(finalStatus);

  const info = await FileSystem.getInfoAsync(localUri);
  const sizeBytes = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || sizeBytes <= 0) {
    throw new UploadValidationError('empty_file', 'Downloader returned an empty file.');
  }

  const asset: NormalizedVideoAsset = {
    normalizedUri: localUri,
    filename,
    mimeType: inferMimeType(filename),
    sizeBytes,
    durationMs: null,
    sourceScheme: 'file',
  };
  validateNormalizedVideoAsset(asset);

  onProgress?.({ state: 'ready', taskId });
  return {
    asset,
    downloadedFilename: filename,
    fallbackTitle: getFilenameWithoutExtension(filename),
  };
}
