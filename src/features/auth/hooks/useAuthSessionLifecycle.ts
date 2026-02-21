import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { notifyLogout } from '@/src/shared/services/api/authEvents';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';
import { useAuthStore } from '@/src/store/authStore';

const RESUME_TOKEN_SKEW_MS = 90_000;
const DEBUG_INTERVAL_REFRESH_MS = 15_000;

export function useAuthSessionLifecycle() {
  const status = useAuthStore((state) => state.status);
  const refreshModeStatus = useAuthStore((state) => state.refreshModeStatus);
  const authDebugAggressiveRefresh = useAppSettingsStore((state) => state.authDebugAggressiveRefresh);
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
          if (__DEV__) {
            console.debug('[auth.lifecycle] resume refresh start', {
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }

          await authSessionManager.ensureFreshToken({
            force: false,
            minValidityMs: RESUME_TOKEN_SKEW_MS,
            reason: 'app_resume',
          });
          await refreshModeStatus();

          if (__DEV__) {
            console.debug('[auth.lifecycle] resume refresh success', {
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }
        } catch (error) {
          if (authSessionManager.shouldClearSessionAfterRefreshFailure(error)) {
            await authSessionManager.clearSession();
            await notifyLogout();
          } else if (__DEV__) {
            console.debug('[auth.lifecycle] resume refresh failed (session preserved)', {
              retryable: authSessionManager.isRetryableRefreshFailure(error),
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshModeStatus]);

  useEffect(() => {
    if (!__DEV__) return;
    if (status !== 'authenticated') return;

    if (!authDebugAggressiveRefresh) {
      if (__DEV__) {
        console.debug('[auth.lifecycle] aggressive debug refresh disabled', {
          snapshot: authSessionManager.getDebugSnapshot(),
        });
      }
      return;
    }

    if (__DEV__) {
      console.debug('[auth.lifecycle] aggressive debug refresh enabled', {
        intervalMs: DEBUG_INTERVAL_REFRESH_MS,
        snapshot: authSessionManager.getDebugSnapshot(),
      });
    }

    const interval = setInterval(() => {
      if (statusRef.current !== 'authenticated') return;
      if (appStateRef.current !== 'active') return;

      void (async () => {
        try {
          if (__DEV__) {
            console.debug('[auth.lifecycle] debug interval refresh start', {
              intervalMs: DEBUG_INTERVAL_REFRESH_MS,
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }

          await authSessionManager.ensureFreshToken({
            force: true,
            minValidityMs: 0,
            reason: 'debug_interval',
          });

          if (__DEV__) {
            console.debug('[auth.lifecycle] debug interval refresh success', {
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }
        } catch (error) {
          if (__DEV__) {
            console.debug('[auth.lifecycle] debug interval refresh failed', {
              retryable: authSessionManager.isRetryableRefreshFailure(error),
              clearSession: authSessionManager.shouldClearSessionAfterRefreshFailure(error),
              terminal: authSessionManager.isTerminalRefreshFailure(error),
              snapshot: authSessionManager.getDebugSnapshot(),
            });
          }

          if (authSessionManager.shouldClearSessionAfterRefreshFailure(error)) {
            await authSessionManager.clearSession();
            await notifyLogout();
          }
        }
      })();
    }, DEBUG_INTERVAL_REFRESH_MS);

    return () => {
      clearInterval(interval);
    };
  }, [authDebugAggressiveRefresh, status]);
}
