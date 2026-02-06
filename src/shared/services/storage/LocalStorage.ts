import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  THEME: 'theme_mode',
  LANGUAGE: 'language',
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
};
