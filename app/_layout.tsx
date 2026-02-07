import { Comfortaa_300Light, Comfortaa_400Regular, Comfortaa_500Medium, Comfortaa_600SemiBold, Comfortaa_700Bold, useFonts } from '@expo-google-fonts/comfortaa';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashScreen as AppSplashScreen } from '@/src/features/auth/screens/SplashScreen';
import { useMyVideosRealtimeSync } from '@/src/features/profile/hooks/useMyVideosRealtimeSync';
import i18n from '@/src/shared/locales/i18n';
import { AppToastHost } from '@/src/shared/components/ui/AppToastHost';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/authStore';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { navigationTheme, effectiveMode } = useTheme();

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
  const { status, hydrate } = useAuthStore();
  const hydrateAppSettings = useAppSettingsStore((state) => state.hydrate);

  useMyVideosRealtimeSync();

  const [fontsLoaded] = useFonts({
    Comfortaa_300Light,
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

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
        console.debug('[auth] deep link received', { url, parsed });
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
    if (fontsLoaded && status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, status]);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)/feed');
    }
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [status, segments, router]);

  if (!fontsLoaded || status === 'loading') {
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
