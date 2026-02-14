import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadVideo, VideoDownloadStage } from '@/src/features/download/services/videoDownloadService';
import { DownloadErrorCode, toDownloadError } from '@/src/features/download/utils/downloadErrors';
import { DownloadItemState, useDownloadStore } from '@/src/store/downloadStore';
import { useToastStore } from '@/src/store/toastStore';

const RESET_DELAY_MS = 1200;

const DEFAULT_DOWNLOAD_STATE: DownloadItemState = {
  status: 'idle',
  progress: 0,
  errorCode: null,
  updatedAt: 0,
};

function getErrorMessage(errorCode: DownloadErrorCode, t: (key: string) => string) {
  if (errorCode === 'permission_denied') return t('video.downloadPermissionDenied');
  if (errorCode === 'rate_limited') return t('video.downloadRateLimited');
  if (errorCode === 'not_found') return t('video.downloadUnavailable');
  if (errorCode === 'auth') return t('video.downloadAuthRequired');
  if (errorCode === 'network' || errorCode === 'server') return t('video.downloadRetryLater');
  if (errorCode === 'concurrency_limited') return t('video.downloadRetryLater');
  return t('video.downloadFailed');
}

function mapStageToStatus(stage: VideoDownloadStage): VideoDownloadStage {
  return stage;
}

export function useVideoDownload(videoId: string, suggestedName?: string | null) {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const state = useDownloadStore(useCallback((store) => store.items[videoId] ?? DEFAULT_DOWNLOAD_STATE, [videoId]));
  const startDownload = useDownloadStore((store) => store.startDownload);
  const setStage = useDownloadStore((store) => store.setStage);
  const setProgress = useDownloadStore((store) => store.setProgress);
  const finishSuccess = useDownloadStore((store) => store.finishSuccess);
  const finishError = useDownloadStore((store) => store.finishError);
  const reset = useDownloadStore((store) => store.reset);

  const isBusy = state.status === 'requesting' || state.status === 'downloading' || state.status === 'saving';

  const onPress = useCallback(async () => {
    const startResult = startDownload(videoId);
    if (startResult === 'already_active') {
      return;
    }
    if (startResult === 'concurrency_limited') {
      finishError(videoId, 'concurrency_limited');
      showToast(getErrorMessage('concurrency_limited', t), 'error');
      return;
    }

    try {
      await downloadVideo({
        videoId,
        suggestedName,
        onStageChange: (stage) => {
          setStage(videoId, mapStageToStatus(stage));
        },
        onProgress: (progress) => {
          setProgress(videoId, progress);
        },
      });

      finishSuccess(videoId);
      showToast(t('video.downloadSaved'), 'success');
      setTimeout(() => {
        reset(videoId);
      }, RESET_DELAY_MS);
    } catch (error) {
      const mapped = toDownloadError(error);
      finishError(videoId, mapped.code);
      showToast(getErrorMessage(mapped.code, t), 'error');
    }
  }, [
    finishError,
    finishSuccess,
    reset,
    setProgress,
    setStage,
    startDownload,
    suggestedName,
    t,
    videoId,
    showToast,
  ]);

  return useMemo(
    () => ({
      state,
      isBusy,
      onPress,
    }),
    [state, isBusy, onPress]
  );
}
