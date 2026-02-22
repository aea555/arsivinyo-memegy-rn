import { apiClient } from '@/src/shared/services/api/apiClient';
import i18n from '@/src/shared/locales/i18n';
import {
  LocalizedTermsResponse,
  ModeStatusResponse,
  TermsBundleResponse,
  TermsLocale,
} from '@/src/shared/types/api';

const STATUS_CACHE_TTL_MS = 30_000;
let maintenanceCache: { atMs: number; value: ModeStatusResponse } | null = null;
let readOnlyCache: { atMs: number; value: ModeStatusResponse } | null = null;

function isFresh(cache: { atMs: number } | null) {
  return Boolean(cache && Date.now() - cache.atMs < STATUS_CACHE_TTL_MS);
}

export function resolveTermsLocale(language?: string | null): TermsLocale {
  const normalized = (language ?? '').trim().toLowerCase();
  return normalized.startsWith('tr') ? 'tr' : 'en';
}

export async function getTermsBundle() {
  const response = await apiClient.get<TermsBundleResponse>('/system/terms');
  return response.data;
}

export async function getTermsByLocale(locale: TermsLocale) {
  const response = await apiClient.get<LocalizedTermsResponse>(`/system/terms/${locale}`);
  return response.data;
}

export async function getTerms() {
  return getTermsByLocale(resolveTermsLocale(i18n.resolvedLanguage ?? i18n.language));
}

export async function getMaintenanceStatus(force = false) {
  if (!force && isFresh(maintenanceCache)) {
    return maintenanceCache!.value;
  }
  const response = await apiClient.get<ModeStatusResponse>('/system/maintenance');
  maintenanceCache = { atMs: Date.now(), value: response.data };
  return response.data;
}

export async function getReadOnlyStatus(force = false) {
  if (!force && isFresh(readOnlyCache)) {
    return readOnlyCache!.value;
  }
  const response = await apiClient.get<ModeStatusResponse>('/system/read-only');
  readOnlyCache = { atMs: Date.now(), value: response.data };
  return response.data;
}

export function clearSystemModeCache() {
  maintenanceCache = null;
  readOnlyCache = null;
}
