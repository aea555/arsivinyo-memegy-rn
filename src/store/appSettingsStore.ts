import { create } from 'zustand/react';

import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

type AppSettingsState = {
  autoPlayVideos: boolean;
  autoPlayFeedVideos: boolean;
  autoSwipeFeedVideos: boolean;
  feedPreserveAspectRatio: boolean;
  authDebugAggressiveRefresh: boolean;
  hydrate: () => Promise<void>;
  setAutoPlayVideos: (enabled: boolean) => Promise<void>;
  setAutoPlayFeedVideos: (enabled: boolean) => Promise<void>;
  setAutoSwipeFeedVideos: (enabled: boolean) => Promise<void>;
  setFeedPreserveAspectRatio: (enabled: boolean) => Promise<void>;
  setAuthDebugAggressiveRefresh: (enabled: boolean) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  autoPlayVideos: false,
  autoPlayFeedVideos: true,
  autoSwipeFeedVideos: true,
  feedPreserveAspectRatio: true,
  authDebugAggressiveRefresh: __DEV__,
  hydrate: async () => {
    const [
      storedAutoPlayVideos,
      storedAutoPlayFeedVideos,
      storedAutoSwipeFeedVideos,
      storedFeedPreserveAspectRatio,
      storedAuthDebugAggressiveRefresh,
    ] = await Promise.all([
      LocalStorage.getAutoPlayVideos(),
      LocalStorage.getAutoPlayFeedVideos(),
      LocalStorage.getAutoSwipeFeedVideos(),
      LocalStorage.getFeedPreserveAspectRatio(),
      LocalStorage.getAuthDebugAggressiveRefresh(),
    ]);

    set({
      autoPlayVideos: storedAutoPlayVideos ?? false,
      autoPlayFeedVideos: storedAutoPlayFeedVideos ?? true,
      autoSwipeFeedVideos: storedAutoSwipeFeedVideos ?? true,
      feedPreserveAspectRatio: storedFeedPreserveAspectRatio ?? true,
      authDebugAggressiveRefresh: __DEV__ ? (storedAuthDebugAggressiveRefresh ?? true) : false,
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
  setFeedPreserveAspectRatio: async (enabled) => {
    await LocalStorage.setFeedPreserveAspectRatio(enabled);
    set({ feedPreserveAspectRatio: enabled });
  },
  setAuthDebugAggressiveRefresh: async (enabled) => {
    const value = __DEV__ ? enabled : false;
    await LocalStorage.setAuthDebugAggressiveRefresh(value);
    set({ authDebugAggressiveRefresh: value });
  },
}));
