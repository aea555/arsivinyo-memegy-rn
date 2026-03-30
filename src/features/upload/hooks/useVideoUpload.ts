import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { confirmUpload, initAnonymousUpload, initUpload, updateVideoMetadata } from '@/src/features/upload/api/uploadApi';
import { NormalizedVideoAsset } from '@/src/features/upload/types/uploadTypes';
import { validateNormalizedVideoAsset } from '@/src/features/upload/utils/uploadValidation';
import { UpdateVideoRequest } from '@/src/shared/types/api';

export type UploadResult = {
  videoId: string;
};

const MAX_UPLOAD_ATTEMPTS = 3;

export const UPLOAD_COMPAT_TRANSCODE_ENABLED =
  process.env.EXPO_PUBLIC_UPLOAD_COMPAT_TRANSCODE === 'true';

type UploadPutError = Error & { status?: number };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number) {
  const base = 350 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 220);
  return base + jitter;
}

function isRetryableUploadError(error: unknown, status?: number) {
  if (typeof status === 'number') {
    return status >= 500;
  }

  const maybe = error as { message?: string } | undefined;
  const message = maybe?.message?.toLowerCase() ?? '';
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econn') ||
    message.includes('connection')
  );
}

async function uploadBinaryWithRetry(uploadUrl: string, asset: NormalizedVideoAsset) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      if (__DEV__) {
        console.debug('[upload.put] attempt', {
          attempt,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          sourceScheme: asset.sourceScheme,
        });
      }

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, asset.normalizedUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': asset.mimeType || 'video/mp4',
        },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        return;
      }

      const uploadStatusError: UploadPutError = new Error('upload_failed');
      uploadStatusError.status = uploadResult.status;
      lastError = uploadStatusError;

      if (!isRetryableUploadError(uploadStatusError, uploadResult.status) || attempt >= MAX_UPLOAD_ATTEMPTS) {
        throw uploadStatusError;
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt >= MAX_UPLOAD_ATTEMPTS) {
        throw error;
      }
    }

    const retryDelayMs = getRetryDelayMs(attempt);
    if (__DEV__) {
      const status = (lastError as UploadPutError | undefined)?.status;
      console.debug('[upload.put] retry_scheduled', {
        attempt,
        retryDelayMs,
        status: typeof status === 'number' ? status : null,
      });
    }
    await wait(retryDelayMs);
  }

  throw lastError ?? new Error('upload_failed');
}

export async function pickVideo({ allowsEditing = false }: { allowsEditing?: boolean } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('permissions');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing,
    quality: 1,
    videoMaxDuration: 60,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0];
}

export async function uploadVideo({
  asset,
  isAnonymous,
  isNsfw,
  metadata,
}: {
  asset: NormalizedVideoAsset;
  isAnonymous: boolean;
  isNsfw: boolean;
  metadata: UpdateVideoRequest;
}): Promise<UploadResult> {
  validateNormalizedVideoAsset(asset);

  if (__DEV__) {
    console.debug('[upload.normalize] using_asset', {
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      sourceScheme: asset.sourceScheme,
      hasDuration: asset.durationMs !== null,
      compatTranscodeEnabled: UPLOAD_COMPAT_TRANSCODE_ENABLED,
    });
  }

  const initPayload = { filename: asset.filename, size_bytes: asset.sizeBytes, is_nsfw: isNsfw };
  const initResponse = isAnonymous ? await initAnonymousUpload(initPayload) : await initUpload(initPayload);

  await uploadBinaryWithRetry(initResponse.upload_url, asset);

  if (__DEV__) {
    console.debug('[upload.confirm] request', { videoId: initResponse.video_id });
  }
  await confirmUpload(initResponse.video_id);

  if (
    metadata.title ||
    metadata.description ||
    metadata.is_anonymous !== undefined ||
    metadata.is_nsfw !== undefined
  ) {
    await updateVideoMetadata(initResponse.video_id, metadata);
  }

  return { videoId: initResponse.video_id };
}
