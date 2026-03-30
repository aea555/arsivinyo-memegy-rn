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
import { isLocalDownloaderRuntimeAvailable } from '@/src/native/localDownloader';

export function MainSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const showLocalDownloaderSettings = isLocalDownloaderRuntimeAvailable;

  return (
    <Screen contentStyle={styles.container}>
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
          title={t('settings.preferences')}
          subtitle={t('settings.preferencesSubtitle')}
          icon={<Ionicons name="settings-outline" size={18} color={palette.text.primary} />}
          onPress={() => router.push('/settings/preferences' as never)}
        />
        <SettingsRow
          title={t('settings.feedSettings')}
          subtitle={t('settings.feedSettingsSubtitle')}
          icon={<Ionicons name="play-circle-outline" size={18} color={palette.text.primary} />}
          onPress={() => router.push('/settings/feed')}
        />
        <SettingsRow
          title={t('settings.termsTitle')}
          subtitle={t('settings.termsSubtitle')}
          icon={<Ionicons name="document-text-outline" size={18} color={palette.text.primary} />}
          onPress={() => router.push('/settings/terms' as never)}
        />
        <SettingsRow
          title={t('reports.myReportsTitle')}
          subtitle={t('reports.myReportsSubtitle')}
          icon={<Ionicons name="flag-outline" size={18} color={palette.warning} />}
          onPress={() => router.push('/settings/reports' as never)}
        />
        <SettingsRow
          title={t('settings.themeStudio')}
          subtitle={t('settings.themeStudioSubtitle')}
          icon={<Ionicons name="sparkles" size={18} color={palette.accent} />}
          onPress={() => router.push('/settings/theme-studio' as never)}
          isLast={!showLocalDownloaderSettings}
        />
        {showLocalDownloaderSettings ? (
          <>
            <SettingsRow
              title={t('settings.quickDownloader')}
              subtitle={t('settings.quickDownloaderSubtitle')}
              icon={<Ionicons name="notifications-outline" size={18} color={palette.text.primary} />}
              onPress={() => router.push('/settings/quick-downloader' as never)}
            />
            <SettingsRow
              title={t('settings.downloaderCookies')}
              subtitle={t('settings.downloaderCookiesSubtitle')}
              icon={<Ionicons name="download-outline" size={18} color={palette.text.primary} />}
              onPress={() => router.push('/settings/downloader-cookies' as never)}
              isLast
            />
          </>
        ) : null}
        {/*
        <SettingsRow
          title={t('settings.advancedSettings')}
          subtitle={t('settings.advancedSettingsSubtitle')}
          icon={<Ionicons name="alert-circle" size={18} color={palette.warning} />}
          onPress={() => router.push('/settings/advanced')}
          isLast
        />
        */}
        {/* <>
          <AppText style={styles.otaUpdatesText} variant="bodyBold">OTA Updates ON</AppText>
          <AppText style={styles.otaUpdatesText} variant="caption">Version: dev110</AppText>
        </> */}
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
  otaUpdatesText: {
    textAlign: 'center',
    padding: spacing.lg,
  },
});
