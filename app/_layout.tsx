import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts, Comfortaa_300Light, Comfortaa_400Regular, Comfortaa_500Medium, Comfortaa_600SemiBold, Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';

import i18n from '@/src/shared/locales/i18n';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/authStore';
import { SplashScreen as AppSplashScreen } from '@/src/features/auth/screens/SplashScreen';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';

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
        <Stack.Screen name="upload" options={{ presentation: 'modal', title: 'Upload' }} />
        <Stack.Screen name="video/[id]" options={{ title: 'Video' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      <StatusBar style={effectiveMode === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { status, hydrate } = useAuthStore();

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
    const loadLanguage = async () => {
      const stored = await LocalStorage.getLanguage();
      if (stored === 'en' || stored === 'tr') {
        await i18n.changeLanguage(stored);
      }
    };
    void loadLanguage();
  }, []);

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
      <ThemeProvider>
        <AppSplashScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <RootNavigator />
        </I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
