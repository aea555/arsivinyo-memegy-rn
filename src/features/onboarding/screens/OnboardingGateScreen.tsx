import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { completeOnboarding, getOnboardingStatus } from '@/src/features/auth/api/onboardingApi';
import { getTerms } from '@/src/features/settings/api/systemApi';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/authStore';
import { useToastStore } from '@/src/store/toastStore';

export function OnboardingGateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const hydrateAuth = useAuthStore((state) => state.hydrate);

  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVersion, setTermsVersion] = useState('v1');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [status, terms] = await Promise.all([getOnboardingStatus(), getTerms()]);
        if (cancelled) return;
        setAgeConfirmed(status.age_confirmed);
        setTermsVersion(status.required_terms_version || terms.version || 'v1');
      } catch {
        if (!cancelled) {
          showToast(t('onboarding.statusUnavailable'), 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast, t]);

  const handleComplete = async () => {
    if (!ageConfirmed) {
      showToast(t('auth.ageConfirmationRequired'), 'error');
      return;
    }
    if (!termsAccepted) {
      showToast(t('auth.termsConsentRequired'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        age_confirmed: true,
        terms_version: termsVersion,
      });
      await hydrateAuth();
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.response?.data?.message;
      showToast(typeof message === 'string' ? message : t('onboarding.completeFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.container}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="heading2">{t('onboarding.title')}</AppText>
          <AppText variant="caption">{t('onboarding.subtitle')}</AppText>
        </View>

        <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
          <View style={styles.toggleText}>
            <AppText variant="bodyBold">{t('auth.ageConfirmLabel')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('auth.ageConfirmHint')}
            </AppText>
          </View>
          <Switch
            value={ageConfirmed}
            onValueChange={setAgeConfirmed}
            trackColor={{ true: palette.accent, false: palette.border }}
            disabled={submitting}
          />
        </View>

        <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
          <View style={styles.toggleText}>
            <AppText variant="bodyBold">{t('auth.termsConsentLabel', { version: termsVersion })}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('auth.termsConsentHint')}
            </AppText>
          </View>
          <Switch
            value={termsAccepted}
            onValueChange={setTermsAccepted}
            trackColor={{ true: palette.accent, false: palette.border }}
            disabled={submitting}
          />
        </View>

        <Button
          label={t('auth.readTerms')}
          variant="secondary"
          onPress={() => router.push('/(onboarding)/terms' as never)}
          disabled={submitting}
        />

        <Button
          label={submitting ? t('onboarding.submitting') : t('onboarding.continue')}
          onPress={handleComplete}
          disabled={submitting || !ageConfirmed || !termsAccepted}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  card: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
});
