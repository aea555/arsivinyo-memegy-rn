import { useRouter } from 'expo-router';
import React from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  ackPendingQuickUpload,
  consumePendingQuickMetadataRequest,
  getQuickUploadSettings,
  listPendingQuickUploads,
  setQuickUploadSettings,
} from '@/src/features/upload/api/downloaderApi';
import { uploadVideo } from '@/src/features/upload/hooks/useVideoUpload';
import {
  normalizeDownloadedFilePathToAsset,
} from '@/src/features/upload/services/downloaderUploadBridge';
import { cleanupNormalizedVideoAsset } from '@/src/features/upload/services/videoAssetNormalizer';
import { addBackgroundStateListener, isLocalDownloaderRuntimeAvailable } from '@/src/native/localDownloader';
import { queryClient } from '@/src/shared/services/api/queryClient';
import {
  clampUtf8Bytes,
  UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES,
  UPLOAD_VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';
import { useAuthStore } from '@/src/store/authStore';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';
import { useToastStore } from '@/src/store/toastStore';

const FAILED_RETRY_DELAY_MS = 75_000;

type QuickUploadSettingsSnapshot = {
  nsfwDefault: boolean;
  anonymousDefault: boolean;
  saveToDeviceDefault: boolean;
  askMetadata: boolean;
};

function filenameToFallbackTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim();
  return withoutExtension.length > 0 ? withoutExtension : 'downloaded_video';
}

function areQuickUploadSettingsEqual(
  a: QuickUploadSettingsSnapshot,
  b: QuickUploadSettingsSnapshot
): boolean {
  return (
    a.nsfwDefault === b.nsfwDefault &&
    a.anonymousDefault === b.anonymousDefault &&
    a.saveToDeviceDefault === b.saveToDeviceDefault &&
    a.askMetadata === b.askMetadata
  );
}

export function useQuickUploadCoordinator() {
  const router = useRouter();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const authStatus = useAuthStore((state) => state.status);
  const uploadNsfwDefault = useAppSettingsStore((state) => state.uploadNsfwDefault);
  const setUploadNsfwDefault = useAppSettingsStore((state) => state.setUploadNsfwDefault);
  const uploadAnonymousDefault = useAppSettingsStore((state) => state.uploadAnonymousDefault);
  const setUploadAnonymousDefault = useAppSettingsStore((state) => state.setUploadAnonymousDefault);
  const clipboardUploadSaveToDevice = useAppSettingsStore((state) => state.clipboardUploadSaveToDevice);
  const setClipboardUploadSaveToDevice = useAppSettingsStore((state) => state.setClipboardUploadSaveToDevice);
  const clipboardUploadAskMetadata = useAppSettingsStore((state) => state.clipboardUploadAskMetadata);
  const setClipboardUploadAskMetadata = useAppSettingsStore((state) => state.setClipboardUploadAskMetadata);
  const processingRef = React.useRef(false);
  const retryAfterRef = React.useRef<Map<string, number>>(new Map());
  const uploadedButUnackedRef = React.useRef<Set<string>>(new Set());
  const pendingNativePushRef = React.useRef<QuickUploadSettingsSnapshot | null>(null);

  const desiredQuickUploadSettings = React.useMemo<QuickUploadSettingsSnapshot>(
    () => ({
      nsfwDefault: uploadNsfwDefault,
      anonymousDefault: uploadAnonymousDefault,
      saveToDeviceDefault: clipboardUploadSaveToDevice,
      askMetadata: clipboardUploadAskMetadata,
    }),
    [
      clipboardUploadAskMetadata,
      clipboardUploadSaveToDevice,
      uploadAnonymousDefault,
      uploadNsfwDefault,
    ]
  );
  const latestQuickUploadSettingsRef = React.useRef<QuickUploadSettingsSnapshot>(desiredQuickUploadSettings);

  React.useEffect(() => {
    latestQuickUploadSettingsRef.current = desiredQuickUploadSettings;
  }, [desiredQuickUploadSettings]);

  const applyNativeSettings = React.useCallback(
    async (settings: QuickUploadSettingsSnapshot) => {
      const pendingPush = pendingNativePushRef.current;
      if (pendingPush) {
        if (!areQuickUploadSettingsEqual(settings, pendingPush)) {
          return;
        }
        pendingNativePushRef.current = null;
      }

      const current = latestQuickUploadSettingsRef.current;
      const updates: Promise<void>[] = [];

      if (settings.nsfwDefault !== current.nsfwDefault) {
        updates.push(setUploadNsfwDefault(settings.nsfwDefault));
      }
      if (settings.anonymousDefault !== current.anonymousDefault) {
        updates.push(setUploadAnonymousDefault(settings.anonymousDefault));
      }
      if (settings.saveToDeviceDefault !== current.saveToDeviceDefault) {
        updates.push(setClipboardUploadSaveToDevice(settings.saveToDeviceDefault));
      }
      if (settings.askMetadata !== current.askMetadata) {
        updates.push(setClipboardUploadAskMetadata(settings.askMetadata));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }
      latestQuickUploadSettingsRef.current = settings;
    },
    [
      setClipboardUploadAskMetadata,
      setClipboardUploadSaveToDevice,
      setUploadAnonymousDefault,
      setUploadNsfwDefault,
    ]
  );

  const hydrateSettingsFromNative = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    try {
      const settings = await getQuickUploadSettings();
      await applyNativeSettings(settings);
    } catch {
      // no-op
    }
  }, [applyNativeSettings]);

  const syncSettingsToNative = React.useCallback(async (settings: QuickUploadSettingsSnapshot) => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    const pendingPush = pendingNativePushRef.current;
    if (pendingPush && areQuickUploadSettingsEqual(pendingPush, settings)) {
      return;
    }
    pendingNativePushRef.current = settings;
    try {
      const resolved = await setQuickUploadSettings(settings);
      await applyNativeSettings(resolved);
    } catch {
      if (
        pendingNativePushRef.current &&
        areQuickUploadSettingsEqual(pendingNativePushRef.current, settings)
      ) {
        pendingNativePushRef.current = null;
      }
    }
  }, [applyNativeSettings]);

  const processPendingQuickUploads = React.useCallback(async () => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    if (authStatus !== 'authenticated') return;
    if (processingRef.current) return;

    processingRef.current = true;
    let shouldInvalidateFeed = false;

    try {
      const pendingMetadataRequest = await consumePendingQuickMetadataRequest();
      if (pendingMetadataRequest?.url) {
        router.push({
          pathname: '/upload-modal',
          params: {
            quickUploadMode: 'clipboard',
            quickMetadataUrl: pendingMetadataRequest.url,
            quickMetadataRequestId: pendingMetadataRequest.requestId,
          },
        } as never);
        showToast(t('upload.quickMetadataPromptOpened'), 'info');
        return;
      }

      const pending = await listPendingQuickUploads();
      const nowMs = Date.now();

      for (const item of pending) {
        const nextRetryAt = retryAfterRef.current.get(item.taskId) ?? 0;
        if (nextRetryAt > nowMs) {
          continue;
        }

        if (uploadedButUnackedRef.current.has(item.taskId)) {
          try {
            await ackPendingQuickUpload(item.taskId);
            uploadedButUnackedRef.current.delete(item.taskId);
            retryAfterRef.current.delete(item.taskId);
          } catch {
            retryAfterRef.current.set(item.taskId, Date.now() + FAILED_RETRY_DELAY_MS);
          }
          continue;
        }

        let uploadedAsset: Awaited<ReturnType<typeof normalizeDownloadedFilePathToAsset>> | null = null;
        let uploadSucceeded = false;
        try {
          uploadedAsset = await normalizeDownloadedFilePathToAsset(item.filePath, item.filename);
          const fallbackTitle = clampUtf8Bytes(
            filenameToFallbackTitle(item.filename),
            UPLOAD_VIDEO_TITLE_MAX_BYTES
          );
          const resolvedTitle =
            clampUtf8Bytes((item.customTitle ?? '').trim(), UPLOAD_VIDEO_TITLE_MAX_BYTES) ||
            fallbackTitle;
          const resolvedDescription =
            clampUtf8Bytes((item.customDescription ?? '').trim(), UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES) || null;

          await uploadVideo({
            asset: uploadedAsset,
            isAnonymous: item.anonymousDefault,
            isNsfw: item.nsfwDefault,
            metadata: {
              title: resolvedTitle,
              description: resolvedDescription,
              is_nsfw: item.nsfwDefault,
            },
          });

          uploadSucceeded = true;
          uploadedButUnackedRef.current.add(item.taskId);
          await ackPendingQuickUpload(item.taskId);
          uploadedButUnackedRef.current.delete(item.taskId);
          shouldInvalidateFeed = true;
          retryAfterRef.current.delete(item.taskId);
        } catch {
          retryAfterRef.current.set(item.taskId, Date.now() + FAILED_RETRY_DELAY_MS);
          if (!uploadSucceeded) {
            showToast(t('upload.quickBackgroundUploadFailed'), 'error');
          }
        } finally {
          if (uploadedAsset) {
            await cleanupNormalizedVideoAsset(uploadedAsset).catch(() => {
              // no-op
            });
          }
        }
      }
    } finally {
      processingRef.current = false;
      if (shouldInvalidateFeed) {
        await queryClient.invalidateQueries({ queryKey: ['feed'] });
        await queryClient.invalidateQueries({ queryKey: ['myVideos'] });
      }
    }
  }, [authStatus, router, showToast, t]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    void hydrateSettingsFromNative();
  }, [hydrateSettingsFromNative]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    void syncSettingsToNative(desiredQuickUploadSettings);
  }, [desiredQuickUploadSettings, syncSettingsToNative]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;

    const subscription = addBackgroundStateListener((event) => {
      const settings = event.quickUploadSettings;
      if (settings) {
        void applyNativeSettings(settings);
      }
      if ((event.pendingQuickUploadCount ?? 0) > 0 || (event.pendingQuickMetadataCount ?? 0) > 0) {
        void processPendingQuickUploads();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [applyNativeSettings, processPendingQuickUploads]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void hydrateSettingsFromNative();
      void processPendingQuickUploads();
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [hydrateSettingsFromNative, processPendingQuickUploads]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !isLocalDownloaderRuntimeAvailable) return;
    if (authStatus !== 'authenticated') return;
    void processPendingQuickUploads();
  }, [authStatus, processPendingQuickUploads]);
}
