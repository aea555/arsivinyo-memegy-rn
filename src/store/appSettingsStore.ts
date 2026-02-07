import { create } from 'zustand/react';

import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

type AppSettingsState = {
  autoPlayVideos: boolean;
  autoPlayFeedVideos: boolean;
  feedPreserveAspectRatio: boolean;
  authDebugAggressiveRefresh: boolean;
  hydrate: () => Promise<void>;
  setAutoPlayVideos: (enabled: boolean) => Promise<void>;
  setAutoPlayFeedVideos: (enabled: boolean) => Promise<void>;
  setFeedPreserveAspectRatio: (enabled: boolean) => Promise<void>;
  setAuthDebugAggressiveRefresh: (enabled: boolean) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  autoPlayVideos: false,
  autoPlayFeedVideos: true,
  feedPreserveAspectRatio: true,
  authDebugAggressiveRefresh: __DEV__,
  hydrate: async () => {
    const [
      storedAutoPlayVideos,
      storedAutoPlayFeedVideos,
      storedFeedPreserveAspectRatio,
      storedAuthDebugAggressiveRefresh,
    ] = await Promise.all([
      LocalStorage.getAutoPlayVideos(),
      LocalStorage.getAutoPlayFeedVideos(),
      LocalStorage.getFeedPreserveAspectRatio(),
      LocalStorage.getAuthDebugAggressiveRefresh(),
    ]);

    set({
      autoPlayVideos: storedAutoPlayVideos ?? false,
      autoPlayFeedVideos: storedAutoPlayFeedVideos ?? true,
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
