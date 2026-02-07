import { create } from 'zustand/react';
import axios, { isAxiosError } from 'axios';

import { apiClient } from '@/src/shared/services/api/apiClient';
import { setLogoutHandler } from '@/src/shared/services/api/authEvents';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { UsernameRulesDto, UserDto } from '@/src/shared/types/api';
import { API_BASE_URL } from '@/src/shared/utils/env';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type PendingSignup = {
  signupTicket: string;
  suggestedUsername: string;
  rules: UsernameRulesDto;
  createdAt: number;
};

type AuthState = {
  status: AuthStatus;
  user: UserDto | null;
  pendingSignup: PendingSignup | null;
  hydrate: () => Promise<void>;
  setAuthenticated: (user: UserDto) => void;
  setUser: (user: UserDto | null) => void;
  setPendingSignup: (payload: PendingSignup) => void;
  clearPendingSignup: () => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  pendingSignup: null,
  hydrate: async () => {
    await authSessionManager.bootstrapFromStorage();
    const accessToken = authSessionManager.getAccessToken();
    if (!accessToken) {
      set({ status: 'unauthenticated', user: null, pendingSignup: null });
      return;
    }

    try {
      const response = await apiClient.get<UserDto>('/users/me');
      set({ status: 'authenticated', user: response.data, pendingSignup: null });
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const shouldForceLogout =
        authSessionManager.shouldClearSessionAfterRefreshFailure(error) ||
        status === 401 ||
        status === 403;

      if (__DEV__) {
        console.debug('[auth.hydrate] /users/me failed', {
          status: status ?? null,
          shouldForceLogout,
          retryable: authSessionManager.isRetryableRefreshFailure(error),
          terminal: authSessionManager.isTerminalRefreshFailure(error),
          snapshot: authSessionManager.getDebugSnapshot(),
        });
      }

      if (shouldForceLogout) {
        await authSessionManager.clearSession();
        set({ status: 'unauthenticated', user: null, pendingSignup: null });
        return;
      }

      // Preserve session on transient backend/auth-refresh outages.
      // This avoids random logout loops when refresh endpoint is flaky.
      set({ status: 'authenticated', user: null, pendingSignup: null });
    }
  },
  setAuthenticated: (user) => set({ status: 'authenticated', user, pendingSignup: null }),
  setUser: (user) => set({ user }),
  setPendingSignup: (payload) => set({ pendingSignup: payload }),
  clearPendingSignup: () => set({ pendingSignup: null }),
  logout: async () => {
    await authSessionManager.bootstrapFromStorage();
    const accessToken = authSessionManager.getAccessToken();

    // Always transition app state to logged-out, regardless of server response.
    await authSessionManager.clearSession();
    queryClient.clear();
    set({ status: 'unauthenticated', user: null, pendingSignup: null });

    if (!accessToken) {
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        {},
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch {
      // Ignore logout failures
    }
  },
}));

setLogoutHandler(async () => {
  const { status, logout } = getAuthSnapshot();
  if (status === 'authenticated') {
    await logout();
  }
});

function getAuthSnapshot() {
  return useAuthStore.getState();
}
