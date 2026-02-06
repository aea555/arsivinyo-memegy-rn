import { create } from 'zustand/react';

import { apiClient } from '@/src/shared/services/api/apiClient';
import { setLogoutHandler } from '@/src/shared/services/api/authEvents';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { UserDto } from '@/src/shared/types/api';

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
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout failures
    }
    await SecureStorage.clearTokens();
    queryClient.clear();
    set({ status: 'unauthenticated', user: null });
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
