import { apiClient } from '@/src/shared/services/api/apiClient';
import { AuthResponse } from '@/src/shared/types/api';

export async function exchangeOtc(
  code: string,
  codeVerifier?: string | null,
  state?: string | null
) {
  const payload: { code: string; code_verifier?: string; state?: string } = { code };
  if (codeVerifier) {
    payload.code_verifier = codeVerifier;
  }
  if (state) {
    payload.state = state;
  }
  if (__DEV__) {
    console.debug('[auth] exchange otc payload', payload);
  }
  const response = await apiClient.post<AuthResponse>('/auth/exchange-otc', payload);
  return response.data;
}
