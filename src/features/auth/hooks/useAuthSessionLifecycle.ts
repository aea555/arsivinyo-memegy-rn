import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { notifyLogout } from '@/src/shared/services/api/authEvents';
import { useAuthStore } from '@/src/store/authStore';

const RESUME_TOKEN_SKEW_MS = 90_000;

export function useAuthSessionLifecycle() {
  const status = useAuthStore((state) => state.status);
  const statusRef = useRef(status);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    void authSessionManager.bootstrapFromStorage();
  }, [status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (statusRef.current !== 'authenticated') return;
      if (nextState !== 'active' || previousState === 'active') return;

      void (async () => {
        try {
          await authSessionManager.ensureFreshToken({
            force: false,
            minValidityMs: RESUME_TOKEN_SKEW_MS,
            reason: 'app_resume',
          });
        } catch {
          if (!authSessionManager.hasValidAccessToken()) {
            await authSessionManager.clearSession();
            await notifyLogout();
          }
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
