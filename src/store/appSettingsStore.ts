import { create } from 'zustand/react';

import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

export const FEED_HOLD_FAST_FORWARD_SPEED_OPTIONS = [1.5, 2, 2.5, 3] as const;
export type FeedHoldFastForwardSpeed = (typeof FEED_HOLD_FAST_FORWARD_SPEED_OPTIONS)[number];

type AppSettingsState = {
  autoPlayVideos: boolean;
  autoPlayFeedVideos: boolean;
  autoSwipeFeedVideos: boolean;
  resetFeedVideoOnSwipe: boolean;
  feedHoldFastForwardSpeed: FeedHoldFastForwardSpeed;
  feedPreserveAspectRatio: boolean;
  feedIncludeNsfw: boolean;
  searchIncludeNsfw: boolean;
  authDebugAggressiveRefresh: boolean;
  uploadAnonymousDefault: boolean;
  clipboardUploadAskMetadata: boolean;
  clipboardUploadSaveToDevice: boolean;
  hydrate: () => Promise<void>;
  setAutoPlayVideos: (enabled: boolean) => Promise<void>;
  setAutoPlayFeedVideos: (enabled: boolean) => Promise<void>;
  setAutoSwipeFeedVideos: (enabled: boolean) => Promise<void>;
  setResetFeedVideoOnSwipe: (enabled: boolean) => Promise<void>;
  setFeedHoldFastForwardSpeed: (speed: FeedHoldFastForwardSpeed) => Promise<void>;
  setFeedPreserveAspectRatio: (enabled: boolean) => Promise<void>;
  setFeedIncludeNsfw: (enabled: boolean) => Promise<void>;
  setSearchIncludeNsfw: (enabled: boolean) => Promise<void>;
  setAuthDebugAggressiveRefresh: (enabled: boolean) => Promise<void>;
  setUploadAnonymousDefault: (enabled: boolean) => Promise<void>;
  setClipboardUploadAskMetadata: (enabled: boolean) => Promise<void>;
  setClipboardUploadSaveToDevice: (enabled: boolean) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  autoPlayVideos: false,
  autoPlayFeedVideos: true,
  autoSwipeFeedVideos: true,
  resetFeedVideoOnSwipe: true,
  feedHoldFastForwardSpeed: 1.5,
  feedPreserveAspectRatio: true,
  feedIncludeNsfw: true,
  searchIncludeNsfw: true,
  authDebugAggressiveRefresh: __DEV__,
  uploadAnonymousDefault: false,
  clipboardUploadAskMetadata: true,
  clipboardUploadSaveToDevice: true,
  hydrate: async () => {
    const [
      storedAutoPlayVideos,
      storedAutoPlayFeedVideos,
      storedAutoSwipeFeedVideos,
      storedResetFeedVideoOnSwipe,
      storedFeedHoldFastForwardSpeed,
      storedFeedPreserveAspectRatio,
      storedFeedIncludeNsfw,
      storedSearchIncludeNsfw,
      storedAuthDebugAggressiveRefresh,
      storedUploadAnonymousDefault,
      storedClipboardUploadAskMetadata,
      storedClipboardUploadSaveToDevice,
    ] = await Promise.all([
      LocalStorage.getAutoPlayVideos(),
      LocalStorage.getAutoPlayFeedVideos(),
      LocalStorage.getAutoSwipeFeedVideos(),
      LocalStorage.getResetFeedVideoOnSwipe(),
      LocalStorage.getFeedHoldFastForwardRate(),
      LocalStorage.getFeedPreserveAspectRatio(),
      LocalStorage.getFeedIncludeNsfw(),
      LocalStorage.getSearchIncludeNsfw(),
      LocalStorage.getAuthDebugAggressiveRefresh(),
      LocalStorage.getUploadAnonymousDefault(),
      LocalStorage.getClipboardUploadAskMetadata(),
      LocalStorage.getClipboardUploadSaveToDevice(),
    ]);

    const resolvedFeedIncludeNsfw = storedFeedIncludeNsfw ?? true;
    const resolvedSearchIncludeNsfw = storedSearchIncludeNsfw ?? resolvedFeedIncludeNsfw;

    if (storedSearchIncludeNsfw === null) {
      await LocalStorage.setSearchIncludeNsfw(resolvedSearchIncludeNsfw);
    }

    set({
      autoPlayVideos: storedAutoPlayVideos ?? false,
      autoPlayFeedVideos: storedAutoPlayFeedVideos ?? true,
      autoSwipeFeedVideos: storedAutoSwipeFeedVideos ?? true,
      resetFeedVideoOnSwipe: storedResetFeedVideoOnSwipe ?? true,
      feedHoldFastForwardSpeed: storedFeedHoldFastForwardSpeed ?? 1.5,
      feedPreserveAspectRatio: storedFeedPreserveAspectRatio ?? true,
      feedIncludeNsfw: resolvedFeedIncludeNsfw,
      searchIncludeNsfw: resolvedSearchIncludeNsfw,
      authDebugAggressiveRefresh: __DEV__ ? (storedAuthDebugAggressiveRefresh ?? true) : false,
      uploadAnonymousDefault: storedUploadAnonymousDefault ?? false,
      clipboardUploadAskMetadata: storedClipboardUploadAskMetadata ?? true,
      clipboardUploadSaveToDevice: storedClipboardUploadSaveToDevice ?? true,
    });
  },
  setAutoPlayVideos: async (enabled) => {
    await LocalStorage.setAutoPlayVideos(enabled);
    set({ autoPlayVideos: enabled });
  },
  setAutoPlayFeedVideos: async (enabled) => {
    await LocalStorage.setAutoPlayFeedVideos(enabled);
    set({ autoPlayFeedVideos: enabled });
  },
  setAutoSwipeFeedVideos: async (enabled) => {
    await LocalStorage.setAutoSwipeFeedVideos(enabled);
    set({ autoSwipeFeedVideos: enabled });
  },
  setResetFeedVideoOnSwipe: async (enabled) => {
    await LocalStorage.setResetFeedVideoOnSwipe(enabled);
    set({ resetFeedVideoOnSwipe: enabled });
  },
  setFeedHoldFastForwardSpeed: async (speed) => {
    await LocalStorage.setFeedHoldFastForwardRate(speed);
    set({ feedHoldFastForwardSpeed: speed });
  },
  setFeedPreserveAspectRatio: async (enabled) => {
    await LocalStorage.setFeedPreserveAspectRatio(enabled);
    set({ feedPreserveAspectRatio: enabled });
  },
  setFeedIncludeNsfw: async (enabled) => {
    await LocalStorage.setFeedIncludeNsfw(enabled);
    set({ feedIncludeNsfw: enabled });
  },
  setSearchIncludeNsfw: async (enabled) => {
    await LocalStorage.setSearchIncludeNsfw(enabled);
    set({ searchIncludeNsfw: enabled });
  },
  setAuthDebugAggressiveRefresh: async (enabled) => {
    const value = __DEV__ ? enabled : false;
    await LocalStorage.setAuthDebugAggressiveRefresh(value);
    set({ authDebugAggressiveRefresh: value });
  },
  setUploadAnonymousDefault: async (enabled) => {
    await LocalStorage.setUploadAnonymousDefault(enabled);
    set({ uploadAnonymousDefault: enabled });
  },
  setClipboardUploadAskMetadata: async (enabled) => {
    await LocalStorage.setClipboardUploadAskMetadata(enabled);
    set({ clipboardUploadAskMetadata: enabled });
  },
  setClipboardUploadSaveToDevice: async (enabled) => {
    await LocalStorage.setClipboardUploadSaveToDevice(enabled);
    set({ clipboardUploadSaveToDevice: enabled });
  },
}));
