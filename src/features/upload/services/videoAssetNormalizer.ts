import * as FileSystem from 'expo-file-system/legacy';
import { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { NormalizedVideoAsset, UploadValidationError } from '@/src/features/upload/types/uploadTypes';

const VIDEO_CACHE_DIR = 'upload-videos-cache';
const ALLOWED_TEMP_DIR_MARKERS = [`/${VIDEO_CACHE_DIR}/`, '/downloader-cache/'];
const DEFAULT_EXTENSION = 'mp4';
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

function getUriScheme(uri: string) {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'unknown';
}

function normalizeFileUri(uri: string) {
  if (uri.startsWith('file:///')) return uri;
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('file:/')) {
    const withoutScheme = uri.replace(/^file:\/*/, '');
    return `file:///${withoutScheme}`;
  }
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return uri;
}

function sanitizeBaseName(baseName: string) {
  const cleaned = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 40);
  return cleaned.length > 0 ? cleaned : 'video';
}

function getExtensionFromName(fileName: string | null | undefined) {
  if (!fileName) return null;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= -1 || dotIndex === fileName.length - 1) return null;
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function getExtensionFromMime(mimeType: string | null | undefined) {
  if (!mimeType || !mimeType.startsWith('video/')) return null;
  const subtype = mimeType.slice('video/'.length).toLowerCase();
  if (subtype === 'quicktime') return 'mov';
  if (subtype === 'x-m4v') return 'm4v';
  if (subtype === 'x-matroska') return 'mkv';
  if (subtype === 'x-msvideo') return 'avi';
  if (subtype === '3gpp') return '3gp';
  return subtype || null;
}

function normalizeMimeType(extension: string, mimeType: string | null | undefined) {
  if (mimeType && mimeType.startsWith('video/')) return mimeType;
  return MIME_BY_EXTENSION[extension] ?? 'video/mp4';
}

function buildFileName(asset: ImagePickerAsset, extension: string) {
  const baseFromName = asset.fileName ? asset.fileName.replace(/\.[^.]+$/, '') : null;
  const baseName = sanitizeBaseName(baseFromName ?? `video_${Date.now()}`);
  return `${baseName}.${extension}`;
}

function ensureCacheBaseDir() {
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) {
    if (__DEV__) {
      console.debug('[upload.normalize] cache_root_missing', {
        hasCacheDirectory: Boolean(FileSystem.cacheDirectory),
        hasDocumentDirectory: Boolean(FileSystem.documentDirectory),
      });
    }
    throw new UploadValidationError('file_unreadable', 'No writable cache directory available.');
  }
  return root.endsWith('/') ? root : `${root}/`;
}

export async function normalizePickedVideoAsset(asset: ImagePickerAsset): Promise<NormalizedVideoAsset> {
  const sourceScheme = getUriScheme(asset.uri);
  if (!asset.uri || sourceScheme === 'unknown') {
    throw new UploadValidationError('unsupported_source', 'Unsupported video source URI.');
  }
  const sourceUri = sourceScheme === 'file' ? normalizeFileUri(asset.uri) : asset.uri;

  if (__DEV__) {
    const platformConstants = Platform.constants as
      | { Brand?: string; Manufacturer?: string; Model?: string }
      | undefined;
    console.debug('[upload.normalize] start', {
      sourceScheme,
      mimeType: asset.mimeType ?? null,
      originalFileName: asset.fileName ?? null,
      os: Platform.OS,
      osVersion: Platform.Version,
      brand: platformConstants?.Brand ?? null,
      manufacturer: platformConstants?.Manufacturer ?? null,
      model: platformConstants?.Model ?? null,
    });
  }

  const extension =
    getExtensionFromName(asset.fileName) ??
    getExtensionFromMime(asset.mimeType) ??
    DEFAULT_EXTENSION;
  const mimeType = normalizeMimeType(extension, asset.mimeType);
  const filename = buildFileName(asset, extension);

  const cacheRoot = ensureCacheBaseDir();
  const cacheDir = `${cacheRoot}${VIDEO_CACHE_DIR}`;
  try {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  } catch (mkdirError) {
    if (__DEV__) {
      console.debug('[upload.normalize] mkdir_failed', {
        cacheDir,
        error: mkdirError instanceof Error ? mkdirError.message : String(mkdirError),
      });
    }
    throw new UploadValidationError('file_unreadable', 'Could not prepare temporary directory for upload.');
  }

  const normalizedUri = `${cacheDir}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${filename}`;

  try {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: normalizedUri,
    });
  } catch (copyError) {
    if (__DEV__) {
      console.debug('[upload.normalize] copy_failed', {
        sourceScheme,
        sourceUri,
        error: copyError instanceof Error ? copyError.message : String(copyError),
      });
    }

    if (sourceScheme === 'file') {
      try {
        const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
        const sourceSizeBytes =
          'size' in sourceInfo && typeof sourceInfo.size === 'number' ? sourceInfo.size : 0;
        if (sourceInfo.exists && sourceSizeBytes > 0) {
          if (__DEV__) {
            console.debug('[upload.normalize] fallback_source_uri', {
              sourceUri,
              sourceSizeBytes,
            });
          }
          return {
            normalizedUri: sourceUri,
            filename,
            mimeType,
            sizeBytes: sourceSizeBytes,
            durationMs:
              typeof asset.duration === 'number' && Number.isFinite(asset.duration)
                ? asset.duration
                : null,
            sourceScheme,
          };
        }
      } catch {
        // no-op
      }
    }

    throw new UploadValidationError('file_unreadable', 'Selected file could not be copied to cache.');
  }

  let info: Awaited<ReturnType<typeof FileSystem.getInfoAsync>>;
  try {
    info = await FileSystem.getInfoAsync(normalizedUri);
  } catch (statError) {
    if (__DEV__) {
      console.debug('[upload.normalize] stat_failed', {
        normalizedUri,
        error: statError instanceof Error ? statError.message : String(statError),
      });
    }
    throw new UploadValidationError('file_unreadable', 'Could not verify selected file.');
  }
  const sizeBytes = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  if (!info.exists || sizeBytes <= 0) {
    await FileSystem.deleteAsync(normalizedUri, { idempotent: true }).catch(() => {
      // no-op
    });
    throw new UploadValidationError('empty_file', 'Selected file is empty or unreadable.');
  }

  if (__DEV__) {
    console.debug('[upload.normalize] success', {
      sourceScheme,
      mimeType,
      extension,
      sizeBytes,
      hasDuration: typeof asset.duration === 'number',
    });
  }

  return {
    normalizedUri,
    filename,
    mimeType,
    sizeBytes,
    durationMs: typeof asset.duration === 'number' && Number.isFinite(asset.duration) ? asset.duration : null,
    sourceScheme,
  };
}

export async function cleanupNormalizedVideoAsset(asset: Pick<NormalizedVideoAsset, 'normalizedUri'> | null) {
  if (!asset?.normalizedUri) return;
  const canDelete = ALLOWED_TEMP_DIR_MARKERS.some((marker) => asset.normalizedUri.includes(marker));
  if (!canDelete) return;
  await FileSystem.deleteAsync(asset.normalizedUri, { idempotent: true }).catch(() => {
    // no-op
  });
}
