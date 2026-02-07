import * as SecureStore from 'expo-secure-store';

const KEYS = {
  AUTH_SESSION: 'auth_session_v1',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

type AuthSessionRecord = {
  accessToken: string;
  refreshToken: string;
};

function isValidSessionRecord(value: unknown): value is AuthSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const typed = value as Partial<AuthSessionRecord>;
  return typeof typed.accessToken === 'string' && typeof typed.refreshToken === 'string';
}

async function clearLegacyTokenKeys() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
  ]);
}

export const SecureStorage = {
  async setSession(session: AuthSessionRecord) {
    await SecureStore.setItemAsync(KEYS.AUTH_SESSION, JSON.stringify(session));
  },
  async getSession(): Promise<AuthSessionRecord | null> {
    const rawSession = await SecureStore.getItemAsync(KEYS.AUTH_SESSION);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as unknown;
        if (isValidSessionRecord(parsed)) {
          return parsed;
        }
      } catch {
        // fall through to legacy migration
      }
    }

    const [legacyAccessToken, legacyRefreshToken] = await Promise.all([
      SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
    ]);

    if (!legacyAccessToken || !legacyRefreshToken) {
      return null;
    }

    const migrated = {
      accessToken: legacyAccessToken,
      refreshToken: legacyRefreshToken,
    };
    await SecureStore.setItemAsync(KEYS.AUTH_SESSION, JSON.stringify(migrated));
    await clearLegacyTokenKeys();
    return migrated;
  },
  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.AUTH_SESSION),
      clearLegacyTokenKeys(),
    ]);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(
      KEYS.AUTH_SESSION,
      JSON.stringify({ accessToken, refreshToken } satisfies AuthSessionRecord)
    );
  },
  async getAccessToken() {
    const session = await SecureStorage.getSession();
    return session?.accessToken ?? null;
  },
  async getRefreshToken() {
    const session = await SecureStorage.getSession();
    return session?.refreshToken ?? null;
  },
  async clearTokens() {
    await SecureStorage.clearSession();
  },
};
