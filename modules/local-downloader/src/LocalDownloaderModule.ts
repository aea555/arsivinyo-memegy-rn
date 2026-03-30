import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type {
  LocalCookieProfile,
  LocalDownloadStartInput,
  LocalDownloadStartResult,
  LocalPlatform,
  LocalTaskStatusResult,
} from './LocalDownloader.types';

type LocalDownloaderNativeModule = {
  startDownload(input: LocalDownloadStartInput): Promise<LocalDownloadStartResult>;
  getTaskStatus(taskId: string): Promise<LocalTaskStatusResult>;
  cancelTask(taskId: string): Promise<{ success: boolean }>;
  importCookie(input: { platform: LocalPlatform; uri: string; profileName: string }): Promise<{ profileName: string; path: string }>;
  listCookieProfiles(platform: LocalPlatform): Promise<LocalCookieProfile[]>;
  setCookieDefault(input: { platform: LocalPlatform; profileName: string }): Promise<{ success: boolean }>;
  deleteCookieProfile(input: { platform: LocalPlatform; profileName: string }): Promise<{ success: boolean }>;
  getCookieDefaults(): Promise<Record<LocalPlatform, string | null>>;
};

const unsupported = (): never => {
  throw new Error('Local downloader native module is available on Android builds only.');
};

let nativeModule: LocalDownloaderNativeModule | null = null;
if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule<LocalDownloaderNativeModule>('LocalDownloader');
  } catch {
    nativeModule = null;
  }
}

export const isLocalDownloaderRuntimeAvailable = Platform.OS === 'android' && nativeModule !== null;

const NativeLocalDownloader: LocalDownloaderNativeModule = nativeModule
  ? nativeModule
  : {
      startDownload: async () => unsupported(),
      getTaskStatus: async () => unsupported(),
      cancelTask: async () => unsupported(),
      importCookie: async () => unsupported(),
      listCookieProfiles: async () => unsupported(),
      setCookieDefault: async () => unsupported(),
      deleteCookieProfile: async () => unsupported(),
      getCookieDefaults: async () => unsupported(),
    };

export default NativeLocalDownloader;
