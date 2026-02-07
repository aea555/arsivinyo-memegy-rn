import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import { getDownloadRedirectUrl, refreshDownloadUrl } from '@/src/features/download/api/downloadApi';
import { DownloadError, mapStatusToDownloadError, shouldTryRefreshFallback, toDownloadError } from '@/src/features/download/utils/downloadErrors';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';

export type VideoDownloadStage = 'requesting' | 'downloading' | 'saving';

type DownloadVideoParams = {
  videoId: string;
  suggestedName?: string | null;
  onStageChange?: (stage: VideoDownloadStage) => void;
  onProgress?: (progress: number) => void;
};

const PROGRESS_THROTTLE_MS = 180;
const TRANSIENT_RETRY_DELAY_MS = 350;

function sanitizeFilenamePart(value: string) {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'video';
}

function createTempFileUri(videoId: string, suggestedName?: string | null) {
  const safeName = sanitizeFilenamePart((suggestedName ?? 'memegy-video').slice(0, 48));
  const ts = Date.now();
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new DownloadError('unknown', 'No writable temp directory available.');
  }
  return `${baseDir}${safeName}-${videoId.slice(0, 8)}-${ts}.mp4`;
}

async function runDownloadTask({
  url,
  fileUri,
  headers,
  onProgress,
}: {
  url: string;
  fileUri: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
}) {
  let lastProgressEmit = 0;
  const task = FileSystem.createDownloadResumable(
    url,
    fileUri,
    { headers },
    (data) => {
      const expected = data.totalBytesExpectedToWrite;
      if (expected <= 0) return;
      const now = Date.now();
      const progress = Math.max(0, Math.min(1, data.totalBytesWritten / expected));
      if (progress < 1 && now - lastProgressEmit < PROGRESS_THROTTLE_MS) return;
      lastProgressEmit = now;
      onProgress?.(progress);
    }
  );

  const result = await task.downloadAsync();
  if (!result) {
    throw new DownloadError('network', 'Download did not complete.');
  }

  if (result.status < 200 || result.status >= 300) {
    throw mapStatusToDownloadError(result.status, `Download failed with status ${result.status}.`);
  }

  onProgress?.(1);
  return result.uri;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDownloadTaskWithRetry({
  url,
  fileUri,
  headers,
  onProgress,
  strategy,
}: {
  url: string;
  fileUri: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
  strategy: 'direct' | 'refresh';
}) {
  try {
    return await runDownloadTask({
      url,
      fileUri,
      headers,
      onProgress,
    });
  } catch (error) {
    const mapped = toDownloadError(error);
    const shouldRetry = mapped.code === 'network' || mapped.code === 'server';
    if (!shouldRetry) {
      throw mapped;
    }
    if (__DEV__) {
      console.debug('[download] transient retry', {
        strategy,
        code: mapped.code,
        status: mapped.status,
      });
    }
    await sleep(TRANSIENT_RETRY_DELAY_MS);
    return runDownloadTask({
      url,
      fileUri,
      headers,
      onProgress,
    });
  }
}

export async function downloadVideo({
  videoId,
  suggestedName,
  onStageChange,
  onProgress,
}: DownloadVideoParams) {
  let tempUri = '';
  let downloadedUri: string | null = null;

  try {
    onStageChange?.('requesting');
    const accessToken = await SecureStorage.getAccessToken();
    if (!accessToken) {
      throw new DownloadError('auth', 'Missing access token.', 401);
    }

    tempUri = createTempFileUri(videoId, suggestedName);

    try {
      if (__DEV__) {
        console.debug('[download] start', { videoId, strategy: 'direct' });
      }
      onStageChange?.('downloading');
      downloadedUri = await runDownloadTaskWithRetry({
        url: getDownloadRedirectUrl(videoId),
        fileUri: tempUri,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        onProgress,
        strategy: 'direct',
      });
    } catch (error) {
      const mapped = toDownloadError(error);
      if (__DEV__) {
        console.debug('[download] direct failed', {
          videoId,
          code: mapped.code,
          status: mapped.status,
          message: mapped.message,
        });
      }

      if (!shouldTryRefreshFallback(mapped)) {
        throw mapped;
      }

      if (__DEV__) {
        console.debug('[download] refresh start', { videoId });
      }
      onStageChange?.('requesting');
      const refreshResponse = await refreshDownloadUrl(videoId);
      onStageChange?.('downloading');
      downloadedUri = await runDownloadTaskWithRetry({
        url: refreshResponse.download_url,
        fileUri: tempUri,
        onProgress,
        strategy: 'refresh',
      });
    }

    if (!downloadedUri) {
      throw new DownloadError('unknown', 'No downloaded file URI.');
    }

    onStageChange?.('saving');
    try {
      // Prefer seamless save path first. On modern Android scoped storage, this can
      // work without a prior runtime permission prompt for app-created media writes.
      await MediaLibrary.saveToLibraryAsync(downloadedUri);
    } catch (saveError) {
      const saveMapped = toDownloadError(saveError);
      if (saveMapped.code !== 'permission_denied') {
        throw saveMapped;
      }

      const permission = await MediaLibrary.requestPermissionsAsync(true, ['video']);
      if (!permission.granted) {
        throw new DownloadError('permission_denied', 'Media library permission denied.');
      }

      await MediaLibrary.saveToLibraryAsync(downloadedUri);
    }

    if (__DEV__) {
      console.debug('[download] success', {
        videoId,
      });
    }

    return { uri: downloadedUri };
  } catch (error) {
    const mapped = toDownloadError(error);
    if (__DEV__) {
      console.debug('[download] failed', {
        videoId,
        code: mapped.code,
        status: mapped.status,
        message: mapped.message,
      });
    }
    throw mapped;
  } finally {
    if (!tempUri) return;
    try {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch {
      // no-op
    }
  }
}
