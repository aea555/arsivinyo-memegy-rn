import { create } from 'zustand/react';

import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

type AppSettingsState = {
  autoPlayVideos: boolean;
  hydrate: () => Promise<void>;
  setAutoPlayVideos: (enabled: boolean) => Promise<void>;
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  autoPlayVideos: false,
  hydrate: async () => {
    const stored = await LocalStorage.getAutoPlayVideos();
    if (stored === null) {
      set({ autoPlayVideos: false });
      return;
    }
    set({ autoPlayVideos: stored });
  },
  setAutoPlayVideos: async (enabled) => {
    await LocalStorage.setAutoPlayVideos(enabled);
    set({ autoPlayVideos: enabled });
  },
}));
