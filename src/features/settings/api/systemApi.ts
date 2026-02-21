import { apiClient } from '@/src/shared/services/api/apiClient';
import { ModeStatusResponse, TermsResponse } from '@/src/shared/types/api';

const STATUS_CACHE_TTL_MS = 30_000;
let maintenanceCache: { atMs: number; value: ModeStatusResponse } | null = null;
let readOnlyCache: { atMs: number; value: ModeStatusResponse } | null = null;

function isFresh(cache: { atMs: number } | null) {
  return Boolean(cache && Date.now() - cache.atMs < STATUS_CACHE_TTL_MS);
}

export async function getTerms() {
  const response = await apiClient.get<TermsResponse>('/system/terms');
  return response.data;
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
