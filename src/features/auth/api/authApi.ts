import { apiClient } from '@/src/shared/services/api/apiClient';
import { AuthResponse } from '@/src/shared/types/api';

export async function exchangeOtc(code: string) {
  const payload = { code };
  if (__DEV__) {
    console.debug('[auth] exchange otc payload', payload);
  }
  const response = await apiClient.post<AuthResponse>('/auth/exchange-otc', payload);
  return response.data;
}
