import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  PKCE_VERIFIER: 'pkce_code_verifier',
  OAUTH_STATE: 'oauth_state',
  PKCE_STATE_MAP: 'pkce_state_map',
} as const;

export const SecureStorage = {
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },
  async getAccessToken() {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },
  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    ]);
  },
  async setPkceVerifier(verifier: string) {
    await SecureStore.setItemAsync(KEYS.PKCE_VERIFIER, verifier);
  },
  async getPkceVerifier() {
    return SecureStore.getItemAsync(KEYS.PKCE_VERIFIER);
  },
  async clearPkceVerifier() {
    await SecureStore.deleteItemAsync(KEYS.PKCE_VERIFIER);
  },
  async setOauthState(state: string) {
    await SecureStore.setItemAsync(KEYS.OAUTH_STATE, state);
  },
  async getOauthState() {
    return SecureStore.getItemAsync(KEYS.OAUTH_STATE);
  },
  async clearOauthState() {
    await SecureStore.deleteItemAsync(KEYS.OAUTH_STATE);
  },
  async setPkceState(state: string, verifier: string) {
    const existing = await SecureStore.getItemAsync(KEYS.PKCE_STATE_MAP);
    let map: Record<string, string> = {};
    if (existing) {
      try {
        map = JSON.parse(existing) as Record<string, string>;
      } catch {
        map = {};
      }
    }
    map[state] = verifier;
    await SecureStore.setItemAsync(KEYS.PKCE_STATE_MAP, JSON.stringify(map));
  },
  async getPkceVerifierForState(state: string) {
    const existing = await SecureStore.getItemAsync(KEYS.PKCE_STATE_MAP);
    if (!existing) return null;
    try {
      const map = JSON.parse(existing) as Record<string, string>;
      return map[state] ?? null;
    } catch {
      return null;
    }
  },
  async clearPkceState(state: string) {
    const existing = await SecureStore.getItemAsync(KEYS.PKCE_STATE_MAP);
    if (!existing) return;
    try {
      const map = JSON.parse(existing) as Record<string, string>;
      delete map[state];
      await SecureStore.setItemAsync(KEYS.PKCE_STATE_MAP, JSON.stringify(map));
    } catch {
      await SecureStore.deleteItemAsync(KEYS.PKCE_STATE_MAP);
    }
  },
};
