import { EventEmitter, type EventSubscription, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type {
  LocalBackgroundPermissionResult,
  LocalBackgroundState,
  LocalBackgroundStateEvent,
  LocalCookieProfile,
  LocalCustomCookieImportInput,
  LocalCustomCookieImportResult,
  LocalCustomDomainProfile,
  LocalCustomDomainSummary,
  LocalDownloadEvent,
  LocalDownloadStartInput,
  LocalDownloadStartResult,
  LocalPendingQuickMetadataRequest,
  LocalPendingQuickUpload,
  LocalPlatform,
  LocalQuickDownloadResult,
  LocalQuickUploadSettings,
  LocalTaskStatusResult,
} from './LocalDownloader.types';

type LocalDownloaderNativeModule = {
  startDownload(input: LocalDownloadStartInput): Promise<LocalDownloadStartResult>;
  getTaskStatus(taskId: string): Promise<LocalTaskStatusResult>;
  cancelTask(taskId: string): Promise<{ success: boolean }>;
  getBackgroundState(): Promise<LocalBackgroundState>;
  ensureBackgroundPermission(): Promise<LocalBackgroundPermissionResult>;
  startQuickDownloadFromClipboard(): Promise<LocalQuickDownloadResult>;
  startQuickDownloadWithUrl(input: { url: string }): Promise<LocalQuickDownloadResult>;
  startQuickDownloadWithMetadata(input: {
    url: string;
    title?: string | null;
    description?: string | null;
  }): Promise<LocalQuickDownloadResult>;
  setQuickUploadSettings(input: LocalQuickUploadSettings): Promise<LocalQuickUploadSettings>;
  getQuickUploadSettings(): Promise<LocalQuickUploadSettings>;
  listPendingQuickUploads(): Promise<LocalPendingQuickUpload[]>;
  ackPendingQuickUpload(input: { taskId: string }): Promise<{ success: boolean }>;
  consumePendingQuickMetadataRequest(): Promise<LocalPendingQuickMetadataRequest | null>;
  importCookie(input: { platform: LocalPlatform; uri: string; profileName: string }): Promise<{ profileName: string; path: string }>;
  listCookieProfiles(platform: LocalPlatform): Promise<LocalCookieProfile[]>;
  setCookieDefault(input: { platform: LocalPlatform; profileName: string }): Promise<{ success: boolean }>;
  deleteCookieProfile(input: { platform: LocalPlatform; profileName: string }): Promise<{ success: boolean }>;
  getCookieDefaults(): Promise<Record<LocalPlatform, string | null>>;
  importCustomCookie(input: LocalCustomCookieImportInput): Promise<LocalCustomCookieImportResult>;
  listCustomDomains(): Promise<LocalCustomDomainSummary[]>;
  listCustomDomainProfiles(domain: string): Promise<LocalCustomDomainProfile[]>;
  setCustomDomainDefault(input: { domain: string; profileName: string }): Promise<{ success: boolean }>;
  deleteCustomDomainProfile(input: { domain: string; profileName: string }): Promise<{ success: boolean }>;
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
      getBackgroundState: async () => unsupported(),
      ensureBackgroundPermission: async () => unsupported(),
      startQuickDownloadFromClipboard: async () => unsupported(),
      startQuickDownloadWithUrl: async () => unsupported(),
      startQuickDownloadWithMetadata: async () => unsupported(),
      setQuickUploadSettings: async () => unsupported(),
      getQuickUploadSettings: async () => unsupported(),
      listPendingQuickUploads: async () => unsupported(),
      ackPendingQuickUpload: async () => unsupported(),
      consumePendingQuickMetadataRequest: async () => unsupported(),
      importCookie: async () => unsupported(),
      listCookieProfiles: async () => unsupported(),
      setCookieDefault: async () => unsupported(),
      deleteCookieProfile: async () => unsupported(),
      getCookieDefaults: async () => unsupported(),
      importCustomCookie: async () => unsupported(),
      listCustomDomains: async () => unsupported(),
      listCustomDomainProfiles: async () => unsupported(),
      setCustomDomainDefault: async () => unsupported(),
      deleteCustomDomainProfile: async () => unsupported(),
    };

const emitter: any = isLocalDownloaderRuntimeAvailable
  ? new EventEmitter(NativeLocalDownloader as never)
  : null;

export function addDownloadProgressListener(
  listener: (event: LocalDownloadEvent) => void
): EventSubscription {
  if (!emitter) {
    return { remove: () => undefined };
  }
  return emitter.addListener('downloadProgress', listener);
}

export function addBackgroundStateListener(
  listener: (event: LocalBackgroundStateEvent) => void
): EventSubscription {
  if (!emitter) {
    return { remove: () => undefined };
  }
  return emitter.addListener('backgroundStateChanged', listener);
}

export default NativeLocalDownloader;
