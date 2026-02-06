import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { useGoogleLogin } from '@/src/features/auth/hooks/useGoogleLogin';
import { Button } from '@/src/shared/components/ui/Button';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const { start } = useGoogleLogin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await start();
      if (result.type === 'success') {
        const params = result.params as Record<string, string>;
        const codeParam = params.code ?? params.otc;
        const stateParam = params.state;
        if (__DEV__) {
          console.debug('[auth] login redirect params', {
            code: codeParam,
            state: stateParam,
            params,
          });
        }
        if (codeParam) {
          router.replace({ pathname: '/(auth)/callback', params: { code: codeParam, state: stateParam } });
        } else {
          setError(t('auth.authFailed'));
        }
      } else {
        if (__DEV__) {
          console.debug('[auth] login result', { type: result.type });
        }
      }
    } catch {
      if (__DEV__) {
        console.debug('[auth] login error');
      }
      setError(t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.content}>
        <AppText variant="heading1" style={styles.title}>
          {t('auth.loginTitle')}
        </AppText>
        <AppText style={{ color: palette.text.secondary }}>{t('auth.loginSubtitle')}</AppText>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
      </View>
      <View style={styles.footer}>
        <Button label={loading ? t('auth.loggingIn') : t('auth.loginWithGoogle')} onPress={handleLogin} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  content: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  footer: {
    marginBottom: spacing.xl,
  },
  error: {
    marginTop: spacing.sm,
  },
});
