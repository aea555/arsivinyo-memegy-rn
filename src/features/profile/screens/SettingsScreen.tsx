import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n from '@/src/shared/locales/i18n';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Screen } from '@/src/shared/components/layout/Screen';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { spacing } from '@/src/shared/theme/spacing';
import { ThemeMode, useTheme } from '@/src/shared/theme/ThemeProvider';

export function SettingsScreen() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  const updateTheme = async (nextMode: ThemeMode) => {
    await setMode(nextMode);
  };

  const updateLanguage = async (language: 'en' | 'tr') => {
    await i18n.changeLanguage(language);
    await LocalStorage.setLanguage(language);
  };

  return (
    <Screen style={styles.container}>
      <AppText variant="heading2">{t('settings.title')}</AppText>
      <View style={styles.section}>
        <AppText variant="bodyBold">{t('settings.theme')}</AppText>
        <View style={styles.row}>
          <Button
            label={t('settings.themeAuto')}
            onPress={() => updateTheme('auto')}
            variant={mode === 'auto' ? 'primary' : 'secondary'}
          />
          <Button
            label={t('settings.themeLight')}
            onPress={() => updateTheme('light')}
            variant={mode === 'light' ? 'primary' : 'secondary'}
          />
          <Button
            label={t('settings.themeDark')}
            onPress={() => updateTheme('dark')}
            variant={mode === 'dark' ? 'primary' : 'secondary'}
          />
        </View>
      </View>
      <View style={styles.section}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
