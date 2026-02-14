import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DownloadErrorCode, toDownloadError } from '@/src/features/download/utils/downloadErrors';
import { quickShareVideoSystem } from '@/src/features/share/services/quickShareService';
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
  if (errorCode === 'not_found') return t('video.quickShareUnavailable');
  if (errorCode === 'rate_limited') return t('video.downloadRateLimited');
  if (errorCode === 'auth') return t('video.downloadAuthRequired');
  if (errorCode === 'network' || errorCode === 'server') return t('video.quickShareFailed');
  if (errorCode === 'permission_denied') return t('video.quickShareFailed');
  if (errorCode === 'concurrency_limited') return t('video.downloadRetryLater');
  return t('video.quickShareFailed');
}

export function useQuickShareVideo(videoId: string, suggestedName?: string | null) {
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

  const onQuickShare = useCallback(async () => {
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
      showToast(t('video.quickSharePreparing'), 'info');
      await quickShareVideoSystem({
        videoId,
        suggestedName,
        onStageChange: (stage) => {
          setStage(videoId, stage);
        },
        onProgress: (progress) => {
          setProgress(videoId, progress);
        },
      });

      finishSuccess(videoId);

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
    showToast,
    startDownload,
    suggestedName,
    t,
    videoId,
  ]);

  return useMemo(
    () => ({
      state,
      isBusy,
      onQuickShare,
    }),
    [state, isBusy, onQuickShare]
  );
}
