import { isAxiosError } from 'axios';

import { apiClient } from '@/src/shared/services/api/apiClient';
import {
  AuthResponse,
  ExchangeOtcResult,
  ExchangeOtcUsernameRequiredResponse,
  SignupCompleteRequest,
} from '@/src/shared/types/api';

export async function exchangeOtc(code: string) {
  const response = await apiClient.post<AuthResponse | ExchangeOtcUsernameRequiredResponse>(
    '/auth/exchange-otc',
    { code },
    {
      skipAuthRefresh: true,
      validateStatus: (status) => status === 200 || status === 409,
    }
  );

  if (response.status === 200) {
    return {
      kind: 'authenticated',
      data: response.data as AuthResponse,
    } as ExchangeOtcResult;
  }

  const data = response.data as Partial<ExchangeOtcUsernameRequiredResponse>;
  if (response.status === 409 && data.error === 'username_required' && typeof data.signup_ticket === 'string') {
    return {
      kind: 'username_required',
      data: data as ExchangeOtcUsernameRequiredResponse,
    } as ExchangeOtcResult;
  }

  throw new Error('invalid_exchange_otc_response');
}

export type SignupCompleteErrorCode =
  | 'invalid_username'
  | 'ticket_invalid'
  | 'username_taken'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class SignupCompleteError extends Error {
  constructor(
    public code: SignupCompleteErrorCode,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'SignupCompleteError';
  }
}

export function toSignupCompleteError(error: unknown) {
  if (!isAxiosError(error)) {
    return new SignupCompleteError('unknown', 'Unknown error');
  }

  if (!error.response) {
    return new SignupCompleteError('network', error.message || 'Network error');
  }

  const status = error.response.status;
  if (status === 400) {
    return new SignupCompleteError('invalid_username', 'Invalid username', status);
  }
  if (status === 401) {
    return new SignupCompleteError('ticket_invalid', 'Signup ticket is invalid or expired', status);
  }
  if (status === 409) {
    return new SignupCompleteError('username_taken', 'Username already taken', status);
  }
  if (status === 429) {
    return new SignupCompleteError('rate_limited', 'Rate limited', status);
  }

  return new SignupCompleteError('unknown', error.message || 'Unknown error', status);
}

export async function completeSignup(payload: SignupCompleteRequest) {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/signup/complete', payload, {
      skipAuthRefresh: true,
    });
    return response.data;
  } catch (error) {
    throw toSignupCompleteError(error);
  }
}
