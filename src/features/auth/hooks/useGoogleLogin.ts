import { makeRedirectUri, type AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';

import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { API_BASE_URL } from '@/src/shared/utils/env';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_SCHEME = 'memegy';

let inMemoryPkce: { state: string; verifier: string } | null = null;

export function getInMemoryPkceState() {
  return inMemoryPkce?.state ?? null;
}

export function getInMemoryPkceVerifier(state?: string | null) {
  if (!state || !inMemoryPkce) return null;
  return inMemoryPkce.state === state ? inMemoryPkce.verifier : null;
}

export function clearInMemoryPkce() {
  inMemoryPkce = null;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlFromBase64(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}


export function useGoogleLogin() {
  const start = async () => {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const codeVerifier = toHex(randomBytes);
    await SecureStorage.setPkceVerifier(codeVerifier);

    const stateBytes = await Crypto.getRandomBytesAsync(16);
    const oauthState = toHex(stateBytes);
    await SecureStorage.setOauthState(oauthState);
    await SecureStorage.setPkceState(oauthState, codeVerifier);
    inMemoryPkce = { state: oauthState, verifier: codeVerifier };

    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    const codeChallenge = base64UrlFromBase64(digest);

    const redirectUri = makeRedirectUri({
      scheme: REDIRECT_SCHEME,
      path: 'auth/callback',
    });

    const authUrl =
      `${API_BASE_URL}/auth/google/login?source=mobile` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256` +
      `&state=${oauthState}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    if (__DEV__) {
      console.debug('[auth] start login', {
        redirectUri,
        authUrl,
        state: oauthState,
        codeVerifier,
        codeChallenge,
      });
    }

    const startedAt = Date.now();
    let didResolve = false;

    const urlListener = __DEV__
      ? Linking.addEventListener('url', (event) => {
          console.debug('[auth] linking url event', event);
        })
      : null;

    if (__DEV__) {
      setTimeout(() => {
        if (!didResolve) {
          console.debug('[auth] auth session still pending after 15s', {
            redirectUri,
          });
        }
      }, 15000);
    }

    let result: AuthSessionResult;
    try {
      result = (await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)) as AuthSessionResult;
      didResolve = true;
    } finally {
      urlListener?.remove();
      if (__DEV__) {
        console.debug('[auth] auth session finished', {
          elapsedMs: Date.now() - startedAt,
        });
      }
    }

    if (__DEV__) {
      console.debug('[auth] auth session result', result);
    }
    if (result.type !== 'success') {
      return { type: result.type } as AuthSessionResult;
    }

    const parsed = Linking.parse(result.url);
    const queryParams = parsed.queryParams ?? {};
    const params = Object.fromEntries(
      Object.entries(queryParams)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)])
    );

    const errorCode = typeof params.error === 'string' ? params.error : null;
    if (errorCode) {
      return {
        type: 'error',
        error: null,
        errorCode,
        params,
        authentication: null,
        url: result.url,
      };
    }

    if (__DEV__) {
      console.debug('[auth] auth session success', {
        url: result.url,
        params,
      });
    }

    return {
      type: 'success',
      error: null,
      errorCode: null,
      params,
      authentication: null,
      url: result.url,
    };
  };

  return { start };
}
