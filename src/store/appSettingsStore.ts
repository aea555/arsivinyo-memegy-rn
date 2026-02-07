import { create } from 'zustand/react';

import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

type AppSettingsState = {
  autoPlayVideos: boolean;
  autoPlayFeedVideos: boolean;
  hydrate: () => Promise<void>;
  setAutoPlayVideos: (enabled: boolean) => Promise<void>;
  setAutoPlayFeedVideos: (enabled: boolean) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  autoPlayVideos: false,
  autoPlayFeedVideos: true,
  hydrate: async () => {
    const [storedAutoPlayVideos, storedAutoPlayFeedVideos] = await Promise.all([
      LocalStorage.getAutoPlayVideos(),
      LocalStorage.getAutoPlayFeedVideos(),
    ]);

    set({
      autoPlayVideos: storedAutoPlayVideos ?? false,
      autoPlayFeedVideos: storedAutoPlayFeedVideos ?? true,
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
}));
