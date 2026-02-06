import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  THEME: 'theme_mode',
  LANGUAGE: 'language',
  AUTO_PLAY_VIDEOS: 'auto_play_videos',
} as const;

export const LocalStorage = {
  async setTheme(theme: string) {
    await AsyncStorage.setItem(KEYS.THEME, theme);
  },
  async getTheme() {
    return AsyncStorage.getItem(KEYS.THEME);
  },
  async setLanguage(language: string) {
    await AsyncStorage.setItem(KEYS.LANGUAGE, language);
  },
  async getLanguage() {
    return AsyncStorage.getItem(KEYS.LANGUAGE);
  },
  async setAutoPlayVideos(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.AUTO_PLAY_VIDEOS, enabled ? '1' : '0');
  },
  async getAutoPlayVideos() {
    const value = await AsyncStorage.getItem(KEYS.AUTO_PLAY_VIDEOS);
    if (value === null) return null;
    return value === '1';
  },
};
