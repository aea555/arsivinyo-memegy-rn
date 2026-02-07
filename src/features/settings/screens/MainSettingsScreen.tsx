import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '@/src/shared/components/layout/Screen';
import { Card } from '@/src/shared/components/ui/Card';
import { SettingsRow } from '@/src/shared/components/ui/SettingsRow';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function MainSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();

  return (
    <Screen title={t('settings.title')} contentStyle={styles.container}>
      <Card style={styles.listCard}>
        <SettingsRow
          title={t('settings.profile')}
          subtitle={t('settings.profileSubtitle')}
          icon={<Ionicons name="person" size={18} color={palette.text.primary} />}
          onPress={() => router.push('/settings/profile')}
        />
        <SettingsRow
          title={t('settings.appSettings')}
          subtitle={t('settings.appSettingsSubtitle')}
          icon={<Ionicons name="options-outline" size={18} color={palette.text.primary} />}
          onPress={() => router.push('/settings/app')}
        />
        <SettingsRow
          title={t('settings.themeStudio')}
          subtitle={t('settings.themeStudioSubtitle')}
          icon={<Ionicons name="sparkles" size={18} color={palette.accent} />}
          onPress={() => router.push('/settings/theme-studio' as never)}
          isLast
        />
        {/*
        <SettingsRow
          title={t('settings.advancedSettings')}
          subtitle={t('settings.advancedSettingsSubtitle')}
          icon={<Ionicons name="alert-circle" size={18} color={palette.warning} />}
          onPress={() => router.push('/settings/advanced')}
          isLast
        />
        */}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
});
