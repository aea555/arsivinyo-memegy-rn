import type { LocalPlatform } from '@/src/native/localDownloader';

export const SUPPORTED_DOWNLOADER_PLATFORM_HOSTS: Record<LocalPlatform, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.watch'],
  twitter: ['twitter.com', 'x.com'],
  reddit: ['reddit.com', 'v.redd.it'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
};

const ALL_SUPPORTED_HOSTS = Object.values(SUPPORTED_DOWNLOADER_PLATFORM_HOSTS).flat();

function normalizeHostname(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function parseWithFallback(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidates = trimmed.includes('://') ? [trimmed] : [trimmed, `https://${trimmed}`];
  for (const candidate of candidates) {
    try {
      return new URL(candidate);
    } catch {
      // no-op
    }
  }

  return null;
}

export function isSupportedDownloaderUrl(url: string): boolean {
  const parsed = parseWithFallback(url);
  if (!parsed) return false;

  const host = normalizeHostname(parsed.hostname);
  return ALL_SUPPORTED_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

export function getDownloaderPlatformFromUrl(url: string): LocalPlatform | null {
  const parsed = parseWithFallback(url);
  if (!parsed) return null;

  const host = normalizeHostname(parsed.hostname);
  for (const [platform, hosts] of Object.entries(SUPPORTED_DOWNLOADER_PLATFORM_HOSTS)) {
    if (hosts.some((known) => host === known || host.endsWith(`.${known}`))) {
      return platform as LocalPlatform;
    }
  }

  return null;
}
