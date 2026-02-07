import { create } from 'zustand/react';
import axios from 'axios';

import { apiClient } from '@/src/shared/services/api/apiClient';
import { setLogoutHandler } from '@/src/shared/services/api/authEvents';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { UserDto } from '@/src/shared/types/api';
import { API_BASE_URL } from '@/src/shared/utils/env';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: UserDto | null;
  hydrate: () => Promise<void>;
  setAuthenticated: (user: UserDto) => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  hydrate: async () => {
    const accessToken = await SecureStorage.getAccessToken();
    if (!accessToken) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const response = await apiClient.get<UserDto>('/users/me');
      set({ status: 'authenticated', user: response.data });
    } catch {
      await SecureStorage.clearTokens();
      set({ status: 'unauthenticated', user: null });
    }
  },
  setAuthenticated: (user) => set({ status: 'authenticated', user }),
  logout: async () => {
    const accessToken = await SecureStorage.getAccessToken();

    // Always transition app state to logged-out, regardless of server response.
    await SecureStorage.clearTokens();
    queryClient.clear();
    set({ status: 'unauthenticated', user: null });

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
