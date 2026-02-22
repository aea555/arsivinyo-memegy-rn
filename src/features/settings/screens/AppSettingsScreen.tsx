import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n from '@/src/shared/locales/i18n';
import { Screen } from '@/src/shared/components/layout/Screen';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { Card } from '@/src/shared/components/ui/Card';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

export function AppSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const setAutoPlayVideos = useAppSettingsStore((state) => state.setAutoPlayVideos);
  const authDebugAggressiveRefresh = useAppSettingsStore((state) => state.authDebugAggressiveRefresh);
  const setAuthDebugAggressiveRefresh = useAppSettingsStore((state) => state.setAuthDebugAggressiveRefresh);

  const updateLanguage = async (language: 'en' | 'tr') => {
    await i18n.changeLanguage(language);
    await LocalStorage.setLanguage(language);
    await queryClient.invalidateQueries({ queryKey: ['system', 'terms'] });
  };

  return (
    <Screen title={t('settings.appSettings')} showBack contentStyle={styles.container}>
      <Card style={styles.sectionCard}>
        <AppText variant="bodyBold">{t('settings.language')}</AppText>
        <View style={styles.row}>
          <Button
            label={t('settings.languageEn')}
            onPress={() => updateLanguage('en')}
            variant={i18n.language === 'en' ? 'primary' : 'secondary'}
          />
          <Button
            label={t('settings.languageTr')}
            onPress={() => updateLanguage('tr')}
            variant={i18n.language === 'tr' ? 'primary' : 'secondary'}
          />
        </View>
      </Card>
      <Card style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="bodyBold">{t('settings.autoPlayVideos')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('settings.autoPlayVideosHint')}
            </AppText>
          </View>
          <Switch
            value={autoPlayVideos}
            onValueChange={(value) => {
              void setAutoPlayVideos(value);
            }}
            trackColor={{ true: palette.accent, false: palette.border }}
            thumbColor={autoPlayVideos ? palette.switchThumb : palette.surface}
          />
        </View>

        {__DEV__ ? (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <AppText variant="bodyBold">{t('settings.authDebugAggressiveRefresh')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('settings.authDebugAggressiveRefreshHint')}
              </AppText>
            </View>
            <Switch
              value={authDebugAggressiveRefresh}
              onValueChange={(value) => {
                void setAuthDebugAggressiveRefresh(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
              thumbColor={authDebugAggressiveRefresh ? palette.switchThumb : palette.surface}
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionCard: {
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
});
