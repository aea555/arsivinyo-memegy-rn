import { create } from 'zustand/react';

import { DownloadErrorCode } from '@/src/features/download/utils/downloadErrors';

export type DownloadStatus = 'idle' | 'requesting' | 'downloading' | 'saving' | 'success' | 'error';

export type DownloadItemState = {
  status: DownloadStatus;
  progress: number;
  errorCode: DownloadErrorCode | null;
  updatedAt: number;
};

type StartDownloadResult = 'started' | 'already_active' | 'concurrency_limited';

type DownloadStoreState = {
  maxConcurrent: number;
  activeCount: number;
  items: Record<string, DownloadItemState>;
  startDownload: (videoId: string) => StartDownloadResult;
  setStage: (videoId: string, status: Extract<DownloadStatus, 'requesting' | 'downloading' | 'saving'>) => void;
  setProgress: (videoId: string, progress: number) => void;
  finishSuccess: (videoId: string) => void;
  finishError: (videoId: string, errorCode: DownloadErrorCode) => void;
  reset: (videoId: string) => void;
};

const DEFAULT_ITEM_STATE: DownloadItemState = {
  status: 'idle',
  progress: 0,
  errorCode: null,
  updatedAt: 0,
};

function isActiveStatus(status: DownloadStatus) {
  return status === 'requesting' || status === 'downloading' || status === 'saving';
}

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  maxConcurrent: 2,
  activeCount: 0,
  items: {},
  startDownload: (videoId) => {
    const { items, activeCount, maxConcurrent } = get();
    const current = items[videoId];
    if (current && isActiveStatus(current.status)) {
      return 'already_active';
    }
    if (activeCount >= maxConcurrent) {
      return 'concurrency_limited';
    }

    set((state) => ({
      activeCount: state.activeCount + 1,
      items: {
        ...state.items,
        [videoId]: {
          status: 'requesting',
          progress: 0,
          errorCode: null,
          updatedAt: Date.now(),
        },
      },
    }));
    return 'started';
  },
  setStage: (videoId, status) => {
    set((state) => ({
      items: {
        ...state.items,
        [videoId]: {
          ...(state.items[videoId] ?? DEFAULT_ITEM_STATE),
          status,
          updatedAt: Date.now(),
          errorCode: null,
        },
      },
    }));
  },
  setProgress: (videoId, progress) => {
    set((state) => {
      const current = state.items[videoId] ?? DEFAULT_ITEM_STATE;
      return {
        items: {
          ...state.items,
          [videoId]: {
            ...current,
            progress: Math.max(0, Math.min(1, progress)),
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  finishSuccess: (videoId) => {
    set((state) => {
      const current = state.items[videoId] ?? DEFAULT_ITEM_STATE;
      return {
        activeCount: isActiveStatus(current.status) ? Math.max(0, state.activeCount - 1) : state.activeCount,
        items: {
          ...state.items,
          [videoId]: {
            status: 'success',
            progress: 1,
            errorCode: null,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  finishError: (videoId, errorCode) => {
    set((state) => {
      const current = state.items[videoId] ?? DEFAULT_ITEM_STATE;
      return {
        activeCount: isActiveStatus(current.status) ? Math.max(0, state.activeCount - 1) : state.activeCount,
        items: {
          ...state.items,
          [videoId]: {
            status: 'error',
            progress: 0,
            errorCode,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  reset: (videoId) => {
    set((state) => ({
      items: {
        ...state.items,
        [videoId]: {
          status: 'idle',
          progress: 0,
          errorCode: null,
          updatedAt: Date.now(),
        },
      },
    }));
  },
}));
