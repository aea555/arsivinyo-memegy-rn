import { create } from 'zustand/react';
import axios, { isAxiosError } from 'axios';

import { getMaintenanceStatus } from '@/src/features/settings/api/systemApi';
import { apiClient } from '@/src/shared/services/api/apiClient';
import { setLogoutHandler } from '@/src/shared/services/api/authEvents';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { UsernameRulesDto, UserDto } from '@/src/shared/types/api';
import { API_BASE_URL } from '@/src/shared/utils/env';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AuthMode = 'normal' | 'onboarding_required' | 'maintenance';

type PendingSignup = {
  signupTicket: string;
  suggestedUsername: string;
  requiredTermsVersion: string;
  termsUrl?: string | null;
  rules: UsernameRulesDto;
  createdAt: number;
};

type AuthState = {
  status: AuthStatus;
  mode: AuthMode;
  user: UserDto | null;
  pendingSignup: PendingSignup | null;
  hydrate: () => Promise<void>;
  refreshModeStatus: (force?: boolean) => Promise<void>;
  setAuthenticated: (user: UserDto) => void;
  setUser: (user: UserDto | null) => void;
  setPendingSignup: (payload: PendingSignup) => void;
  clearPendingSignup: () => void;
  logout: () => Promise<void>;
};

function hasCompletedOnboarding(user: UserDto | null) {
  if (!user) return false;
  return Boolean(user.age_confirmed && user.terms_accepted);
}

function modeForUser(user: UserDto | null, maintenanceEnabled: boolean): AuthMode {
  if (maintenanceEnabled) return 'maintenance';
  if (!hasCompletedOnboarding(user)) return 'onboarding_required';
  return 'normal';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  mode: 'normal',
  user: null,
  pendingSignup: null,
  hydrate: async () => {
    await authSessionManager.bootstrapFromStorage();
    const accessToken = authSessionManager.getAccessToken();
    if (!accessToken) {
      set({ status: 'unauthenticated', mode: 'normal', user: null, pendingSignup: null });
      return;
    }

    let maintenanceEnabled = false;
    try {
      const mode = await getMaintenanceStatus();
      maintenanceEnabled = Boolean(mode.enabled);
    } catch {
      // Maintenance check is best-effort before profile fetch.
    }

    try {
      const response = await apiClient.get<UserDto>('/users/me');
      set({
        status: 'authenticated',
        mode: modeForUser(response.data, maintenanceEnabled),
        user: response.data,
        pendingSignup: null,
      });
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
        set({ status: 'unauthenticated', mode: 'normal', user: null, pendingSignup: null });
        return;
      }

      // Preserve session on transient backend/auth-refresh outages.
      set({
        status: 'authenticated',
        mode: maintenanceEnabled ? 'maintenance' : 'normal',
        user: null,
        pendingSignup: null,
      });
    }
  },
  refreshModeStatus: async (force = false) => {
    const snapshot = get();
    if (snapshot.status !== 'authenticated') {
      return;
    }

    try {
      const mode = await getMaintenanceStatus(force);
      set((state) => ({
        mode: modeForUser(state.user, Boolean(mode.enabled)),
      }));
    } catch {
      // Keep previous mode on transient failure.
    }
  },
  setAuthenticated: (user) =>
    set({
      status: 'authenticated',
      mode: modeForUser(user, false),
      user,
      pendingSignup: null,
    }),
  setUser: (user) => set((state) => ({ user, mode: modeForUser(user, state.mode === 'maintenance') })),
  setPendingSignup: (payload) => set({ pendingSignup: payload }),
  clearPendingSignup: () => set({ pendingSignup: null }),
  logout: async () => {
    await authSessionManager.bootstrapFromStorage();
    const accessToken = authSessionManager.getAccessToken();

    // Always transition app state to logged-out, regardless of server response.
    await authSessionManager.clearSession();
    queryClient.clear();
    set({ status: 'unauthenticated', mode: 'normal', user: null, pendingSignup: null });

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
