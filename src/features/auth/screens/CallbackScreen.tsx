import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { exchangeOtc } from '@/src/features/auth/api/authApi';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { spacing } from '@/src/shared/theme/spacing';
import { useAuthStore } from '@/src/store/authStore';

export function CallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const codeParam = Array.isArray(params.code) ? params.code[0] : params.code;
      const otcParam = Array.isArray(params.otc) ? params.otc[0] : params.otc;
      const code = (codeParam ?? otcParam) as string | undefined;

      if (__DEV__) {
        console.debug('[auth] callback params', {
          codeParam,
          otcParam,
        });
      }

      if (!code) {
        setError(t('auth.authFailed'));
        return;
      }

      try {
        const data = await exchangeOtc(code);
        await SecureStorage.setTokens(data.access_token, data.refresh_token);
        setAuthenticated(data.user);
        router.replace('/(tabs)/feed');
      } catch {
        setError(t('auth.authFailed'));
      }
    };

    void run();
  }, [params.code, params.otc, router, setAuthenticated, t]);

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.content}>
        <AppText variant="heading2">{t('auth.loggingIn')}</AppText>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
      </View>
      {error ? (
        <Button label={t('auth.loginWithGoogle')} onPress={() => router.replace('/(auth)/login')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
    alignItems: 'center',
  },
  error: {
    textAlign: 'center',
  },
});
