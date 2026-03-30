import { File } from 'expo-file-system';

import LocalDownloaderModule, {
  isLocalDownloaderRuntimeAvailable,
  type LocalCookieProfile,
  type LocalCustomCookieImportResult,
  type LocalCustomDomainProfile,
  type LocalCustomDomainSummary,
  type LocalPlatform,
} from '@/src/native/localDownloader';

export const LOCAL_COOKIE_PLATFORMS: LocalPlatform[] = [
  'youtube',
  'instagram',
  'facebook',
  'twitter',
  'reddit',
  'tiktok',
];

export type CookiePlatform = LocalPlatform;
export type CookieProfile = LocalCookieProfile;
export type CustomDomainSummary = LocalCustomDomainSummary;
export type CustomDomainProfile = LocalCustomDomainProfile;

function ensureLocalDownloaderAvailable() {
  if (!isLocalDownloaderRuntimeAvailable) {
    throw new Error('DOWNLOADER_UNAVAILABLE');
  }
}

export async function listCookieProfiles(platform: CookiePlatform): Promise<LocalCookieProfile[]> {
  ensureLocalDownloaderAvailable();
  return LocalDownloaderModule.listCookieProfiles(platform);
}

export async function importCookieProfile(platform: CookiePlatform): Promise<{ imported: boolean; profileName?: string }> {
  ensureLocalDownloaderAvailable();

  let pickedUri: string | undefined;
  try {
    const fileApi = File as unknown as {
      pickFileAsync: (initialUri?: string, mimeType?: string) => Promise<{ uri: string }>;
    };
    const pickedFile = await fileApi.pickFileAsync(undefined, 'text/*');
    pickedUri = pickedFile?.uri;
  } catch {
    return { imported: false };
  }

  if (!pickedUri) {
    return { imported: false };
  }

  const inferredName =
    (pickedUri.split('/').pop() || `profile_${Date.now()}`)
      .replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_') || 'default';

  const imported = await LocalDownloaderModule.importCookie({
    platform,
    uri: pickedUri,
    profileName: inferredName,
  });

  return {
    imported: true,
    profileName: imported.profileName,
  };
}

export async function setDefaultCookieProfile(platform: CookiePlatform, profileName: string): Promise<void> {
  ensureLocalDownloaderAvailable();
  const result = await LocalDownloaderModule.setCookieDefault({ platform, profileName });
  if (!result.success) {
    throw new Error('INVALID_COOKIE_PROFILE');
  }
}

export async function deleteCookieProfile(platform: CookiePlatform, profileName: string): Promise<void> {
  ensureLocalDownloaderAvailable();
  const result = await LocalDownloaderModule.deleteCookieProfile({ platform, profileName });
  if (!result.success) {
    throw new Error('COOKIE_PROFILE_NOT_FOUND');
  }
}

export async function getDefaultCookieProfile(platform: CookiePlatform): Promise<string | null> {
  ensureLocalDownloaderAvailable();
  const defaults = await LocalDownloaderModule.getCookieDefaults();
  return defaults[platform] ?? null;
}

export async function importCustomCookieProfile(input: {
  domain?: string | null;
  profileName?: string;
} = {}): Promise<{ imported: boolean; result?: LocalCustomCookieImportResult }> {
  ensureLocalDownloaderAvailable();

  let pickedUri: string | undefined;
  try {
    const fileApi = File as unknown as {
      pickFileAsync: (initialUri?: string, mimeType?: string) => Promise<{ uri: string }>;
    };
    const pickedFile = await fileApi.pickFileAsync(undefined, 'text/*');
    pickedUri = pickedFile?.uri;
  } catch {
    return { imported: false };
  }

  if (!pickedUri) {
    return { imported: false };
  }

  const inferredName =
    input.profileName ||
    (pickedUri.split('/').pop() || `custom_${Date.now()}`)
      .replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_') ||
    'custom';

  const result = await LocalDownloaderModule.importCustomCookie({
    uri: pickedUri,
    domain: input.domain ?? null,
    profileName: inferredName,
  });

  return { imported: true, result };
}

export async function listCustomDomains(): Promise<LocalCustomDomainSummary[]> {
  ensureLocalDownloaderAvailable();
  return LocalDownloaderModule.listCustomDomains();
}

export async function listCustomDomainProfiles(domain: string): Promise<LocalCustomDomainProfile[]> {
  ensureLocalDownloaderAvailable();
  return LocalDownloaderModule.listCustomDomainProfiles(domain);
}

export async function setCustomDomainDefault(domain: string, profileName: string): Promise<void> {
  ensureLocalDownloaderAvailable();
  const result = await LocalDownloaderModule.setCustomDomainDefault({ domain, profileName });
  if (!result.success) {
    throw new Error('CUSTOM_COOKIE_PROFILE_NOT_FOUND');
  }
}

export async function deleteCustomDomainProfile(domain: string, profileName: string): Promise<void> {
  ensureLocalDownloaderAvailable();
  const result = await LocalDownloaderModule.deleteCustomDomainProfile({ domain, profileName });
  if (!result.success) {
    throw new Error('CUSTOM_COOKIE_PROFILE_NOT_FOUND');
  }
}
