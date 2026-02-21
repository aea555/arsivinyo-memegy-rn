import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createDefaultThemeSettings,
  DEFAULT_ACCENT_ID,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
} from '@/src/shared/theme/presets';
import { ThemeSettingsState } from '@/src/shared/theme/types';

const KEYS = {
  THEME: 'theme_mode',
  THEME_SETTINGS: 'theme_settings_v1',
  LANGUAGE: 'language',
  AUTO_PLAY_VIDEOS: 'auto_play_videos',
  AUTO_PLAY_FEED_VIDEOS: 'auto_play_feed_videos',
  AUTO_SWIPE_FEED_VIDEOS: 'auto_swipe_feed_videos',
  RESET_FEED_VIDEO_ON_SWIPE: 'reset_feed_video_on_swipe',
  FEED_HOLD_FAST_FORWARD_RATE: 'feed_hold_fast_forward_rate',
  FEED_PRESERVE_ASPECT_RATIO: 'feed_preserve_aspect_ratio',
  FEED_INCLUDE_NSFW: 'feed_include_nsfw',
  SEARCH_INCLUDE_NSFW: 'search_include_nsfw',
  AUTH_DEBUG_AGGRESSIVE_REFRESH: 'auth_debug_aggressive_refresh',
  OTA_SUCCESS_MODAL_DISMISSED: 'ota_success_modal_dismissed',
  UPLOAD_ANONYMOUS_DEFAULT: 'upload_anonymous_default',
  CLIPBOARD_UPLOAD_ASK_METADATA: 'clipboard_upload_ask_metadata',
  CLIPBOARD_UPLOAD_SAVE_TO_DEVICE: 'clipboard_upload_save_to_device',
} as const;

function isThemeSettingsShape(value: unknown): value is ThemeSettingsState {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ThemeSettingsState>;
  return (
    item.version === 1 &&
    (item.mode === 'auto' || item.mode === 'light' || item.mode === 'dark') &&
    typeof item.lightThemeId === 'string' &&
    typeof item.darkThemeId === 'string' &&
    typeof item.accentId === 'string' &&
    Array.isArray(item.customThemes) &&
    Array.isArray(item.customAccents)
  );
}

function ensureThemeSettings(value: ThemeSettingsState): ThemeSettingsState {
  return {
    version: 1,
    mode: value.mode,
    lightThemeId: value.lightThemeId || DEFAULT_LIGHT_THEME_ID,
    darkThemeId: value.darkThemeId || DEFAULT_DARK_THEME_ID,
    accentId: value.accentId || DEFAULT_ACCENT_ID,
    customThemes: value.customThemes ?? [],
    customAccents: value.customAccents ?? [],
  };
}

export const LocalStorage = {
  async setTheme(theme: string) {
    await AsyncStorage.setItem(KEYS.THEME, theme);
  },
  async getTheme() {
    return AsyncStorage.getItem(KEYS.THEME);
  },
  async setThemeSettings(settings: ThemeSettingsState) {
    await AsyncStorage.setItem(KEYS.THEME_SETTINGS, JSON.stringify(settings));
    await AsyncStorage.setItem(KEYS.THEME, settings.mode);
  },
  async getThemeSettings() {
    const raw = await AsyncStorage.getItem(KEYS.THEME_SETTINGS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (isThemeSettingsShape(parsed)) {
          return ensureThemeSettings(parsed);
        }
      } catch {
        // ignore malformed value and migrate from legacy key
      }
    }

    const legacyTheme = await AsyncStorage.getItem(KEYS.THEME);
    const legacyMode = legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'auto' ? legacyTheme : 'auto';
    const migrated = createDefaultThemeSettings(legacyMode);
    await AsyncStorage.setItem(KEYS.THEME_SETTINGS, JSON.stringify(migrated));
    return migrated;
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
  async setAutoPlayFeedVideos(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.AUTO_PLAY_FEED_VIDEOS, enabled ? '1' : '0');
  },
  async getAutoPlayFeedVideos() {
    const value = await AsyncStorage.getItem(KEYS.AUTO_PLAY_FEED_VIDEOS);
    if (value === null) return null;
    return value === '1';
  },
  async setAutoSwipeFeedVideos(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.AUTO_SWIPE_FEED_VIDEOS, enabled ? '1' : '0');
  },
  async getAutoSwipeFeedVideos() {
    const value = await AsyncStorage.getItem(KEYS.AUTO_SWIPE_FEED_VIDEOS);
    if (value === null) return null;
    return value === '1';
  },
  async setResetFeedVideoOnSwipe(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.RESET_FEED_VIDEO_ON_SWIPE, enabled ? '1' : '0');
  },
  async getResetFeedVideoOnSwipe() {
    const value = await AsyncStorage.getItem(KEYS.RESET_FEED_VIDEO_ON_SWIPE);
    if (value === null) return null;
    return value === '1';
  },
  async setFeedHoldFastForwardRate(rate: number) {
    await AsyncStorage.setItem(KEYS.FEED_HOLD_FAST_FORWARD_RATE, String(rate));
  },
  async getFeedHoldFastForwardRate(): Promise<1.5 | 2 | 2.5 | 3 | null> {
    const value = await AsyncStorage.getItem(KEYS.FEED_HOLD_FAST_FORWARD_RATE);
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed !== 1.5 && parsed !== 2 && parsed !== 2.5 && parsed !== 3) return null;
    return parsed;
  },
  async setFeedPreserveAspectRatio(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.FEED_PRESERVE_ASPECT_RATIO, enabled ? '1' : '0');
  },
  async getFeedPreserveAspectRatio() {
    const value = await AsyncStorage.getItem(KEYS.FEED_PRESERVE_ASPECT_RATIO);
    if (value === null) return null;
    return value === '1';
  },
  async setFeedIncludeNsfw(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.FEED_INCLUDE_NSFW, enabled ? '1' : '0');
  },
  async getFeedIncludeNsfw() {
    const value = await AsyncStorage.getItem(KEYS.FEED_INCLUDE_NSFW);
    if (value === null) return null;
    return value === '1';
  },
  async setSearchIncludeNsfw(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.SEARCH_INCLUDE_NSFW, enabled ? '1' : '0');
  },
  async getSearchIncludeNsfw() {
    const value = await AsyncStorage.getItem(KEYS.SEARCH_INCLUDE_NSFW);
    if (value === null) return null;
    return value === '1';
  },
  async setAuthDebugAggressiveRefresh(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.AUTH_DEBUG_AGGRESSIVE_REFRESH, enabled ? '1' : '0');
  },
  async getAuthDebugAggressiveRefresh() {
    const value = await AsyncStorage.getItem(KEYS.AUTH_DEBUG_AGGRESSIVE_REFRESH);
    if (value === null) return null;
    return value === '1';
  },
  async setOtaSuccessModalDismissed(dismissed: boolean) {
    await AsyncStorage.setItem(KEYS.OTA_SUCCESS_MODAL_DISMISSED, dismissed ? '1' : '0');
  },
  async getOtaSuccessModalDismissed() {
    const value = await AsyncStorage.getItem(KEYS.OTA_SUCCESS_MODAL_DISMISSED);
    if (value === null) return null;
    return value === '1';
  },
  async setUploadAnonymousDefault(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.UPLOAD_ANONYMOUS_DEFAULT, enabled ? '1' : '0');
  },
  async getUploadAnonymousDefault() {
    const value = await AsyncStorage.getItem(KEYS.UPLOAD_ANONYMOUS_DEFAULT);
    if (value === null) return null;
    return value === '1';
  },
  async setClipboardUploadAskMetadata(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.CLIPBOARD_UPLOAD_ASK_METADATA, enabled ? '1' : '0');
  },
  async getClipboardUploadAskMetadata() {
    const value = await AsyncStorage.getItem(KEYS.CLIPBOARD_UPLOAD_ASK_METADATA);
    if (value === null) return null;
    return value === '1';
  },
  async setClipboardUploadSaveToDevice(enabled: boolean) {
    await AsyncStorage.setItem(KEYS.CLIPBOARD_UPLOAD_SAVE_TO_DEVICE, enabled ? '1' : '0');
  },
  async getClipboardUploadSaveToDevice() {
    const value = await AsyncStorage.getItem(KEYS.CLIPBOARD_UPLOAD_SAVE_TO_DEVICE);
    if (value === null) return null;
    return value === '1';
  },
};
