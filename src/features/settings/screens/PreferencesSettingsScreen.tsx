import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/shared/components/layout/Screen';
import { Card } from '@/src/shared/components/ui/Card';
import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

export function PreferencesSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const feedIncludeNsfw = useAppSettingsStore((state) => state.feedIncludeNsfw);
  const setFeedIncludeNsfw = useAppSettingsStore((state) => state.setFeedIncludeNsfw);
  const searchIncludeNsfw = useAppSettingsStore((state) => state.searchIncludeNsfw);
  const setSearchIncludeNsfw = useAppSettingsStore((state) => state.setSearchIncludeNsfw);

  return (
    <Screen title={t('settings.preferences')} showBack contentStyle={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <Card style={styles.sectionCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <AppText variant="bodyBold">{t('settings.includeNsfwFeed')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('settings.includeNsfwFeedHint')}
              </AppText>
            </View>
            <Switch
              value={feedIncludeNsfw}
              onValueChange={(value) => {
                void setFeedIncludeNsfw(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
            />
          </View>
          <View style={styles.dividerWrap}>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <AppText variant="bodyBold">{t('settings.includeNsfwSearch')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('settings.includeNsfwSearchHint')}
              </AppText>
            </View>
            <Switch
              value={searchIncludeNsfw}
              onValueChange={(value) => {
                void setSearchIncludeNsfw(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
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
  dividerWrap: {
    paddingHorizontal: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
});
