import { Comfortaa_300Light, Comfortaa_400Regular, Comfortaa_500Medium, Comfortaa_600SemiBold, Comfortaa_700Bold, useFonts } from '@expo-google-fonts/comfortaa';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashScreen as AppSplashScreen } from '@/src/features/auth/screens/SplashScreen';
import { useAuthSessionLifecycle } from '@/src/features/auth/hooks/useAuthSessionLifecycle';
import { useMyVideosRealtimeSync } from '@/src/features/profile/hooks/useMyVideosRealtimeSync';
import { useQuickUploadCoordinator } from '@/src/features/upload/hooks/useQuickUploadCoordinator';
import i18n from '@/src/shared/locales/i18n';
import { AppToastHost } from '@/src/shared/components/ui/AppToastHost';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { configureConsoleForEnvironment } from '@/src/shared/utils/logging';
import { useAuthStore } from '@/src/store/authStore';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

configureConsoleForEnvironment();

SplashScreen.preventAutoHideAsync();
const MIN_ANIMATED_SPLASH_MS = 1200;
const OTA_UPDATE_CHECK_TIMEOUT_MS = 10000;
const OTA_UPDATE_FETCH_TIMEOUT_MS = 20000;

export const unstable_settings = {
  anchor: '(tabs)',
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`timeout_after_${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function RootNavigator() {
  const { navigationTheme, effectiveMode } = useTheme();

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(maintenance)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="upload-modal" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={effectiveMode === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { status, mode, hydrate } = useAuthStore();
  const hydrateAppSettings = useAppSettingsStore((state) => state.hydrate);

  useMyVideosRealtimeSync();
  useAuthSessionLifecycle();
  useQuickUploadCoordinator();

  const [fontsLoaded] = useFonts({
    Comfortaa_300Light,
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });
  const splashStartedAtRef = useRef(Date.now());
  const [isNativeSplashHidden, setIsNativeSplashHidden] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [isOtaReady, setIsOtaReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyLaunchUpdate = async () => {
      if (__DEV__ || Platform.OS === 'web') {
        if (!cancelled) setIsOtaReady(true);
        return;
      }

      if (!Updates.isEnabled) {
        if (!cancelled) setIsOtaReady(true);
        return;
      }

      try {
        const checkResult = await withTimeout(
          Updates.checkForUpdateAsync(),
          OTA_UPDATE_CHECK_TIMEOUT_MS
        );

        if (checkResult.isAvailable) {
          const fetchResult = await withTimeout(
            Updates.fetchUpdateAsync(),
            OTA_UPDATE_FETCH_TIMEOUT_MS
          );

          if (fetchResult.isNew) {
            await Updates.reloadAsync();
            return;
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.debug('[ota] launch update check failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!cancelled) {
        setIsOtaReady(true);
      }
    };

    void applyLaunchUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void hydrateAppSettings();
  }, [hydrateAppSettings]);

  useEffect(() => {
    const loadLanguage = async () => {
      const stored = await LocalStorage.getLanguage();
      if (stored === 'en' || stored === 'tr') {
        await i18n.changeLanguage(stored);
      }
    };
    void loadLanguage();
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (parsed.path !== 'auth/callback') return;
      const query = parsed.queryParams ?? {};
      const code = query.code ?? query.otc;
      if (!code) return;
      const codeValue = Array.isArray(code) ? code[0] : String(code);
      if (__DEV__) {
        console.debug('[auth] deep link received', { path: parsed.path });
      }
      router.replace({ pathname: '/(auth)/callback', params: { code: codeValue } });
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {
        // no-op
      });

    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!fontsLoaded || isNativeSplashHidden) return;
    SplashScreen.hideAsync()
      .catch(() => {
        // no-op
      })
      .finally(() => {
        setIsNativeSplashHidden(true);
      });
  }, [fontsLoaded, isNativeSplashHidden]);

  useEffect(() => {
    if (!isNativeSplashHidden || !fontsLoaded || status === 'loading') return;

    const elapsed = Date.now() - splashStartedAtRef.current;
    const remaining = Math.max(0, MIN_ANIMATED_SPLASH_MS - elapsed);
    const timer = setTimeout(() => {
      setShowAnimatedSplash(false);
    }, remaining);

    return () => {
      clearTimeout(timer);
    };
  }, [fontsLoaded, isNativeSplashHidden, status]);

  useEffect(() => {
    if (status === 'loading') return;
    const topSegment = segments[0] as string | undefined;
    const inAuthGroup = topSegment === '(auth)';
    const inOnboardingGroup = topSegment === '(onboarding)';
    const inMaintenanceGroup = topSegment === '(maintenance)';

    if (status === 'authenticated') {
      if (mode === 'maintenance') {
        if (!inMaintenanceGroup) {
          router.replace('/(maintenance)' as never);
        }
        return;
      }
      if (mode === 'onboarding_required') {
        if (!inOnboardingGroup) {
          router.replace('/(onboarding)' as never);
        }
        return;
      }

      if (inAuthGroup || inOnboardingGroup || inMaintenanceGroup) {
        router.replace('/(tabs)/feed');
      }
      return;
    }

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [mode, status, segments, router]);

  if (showAnimatedSplash || !fontsLoaded || status === 'loading' || !isOtaReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppSplashScreen />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <>
              <RootNavigator />
              <AppToastHost />
            </>
          </I18nextProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
