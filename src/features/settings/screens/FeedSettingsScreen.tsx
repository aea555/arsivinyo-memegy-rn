import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/shared/components/layout/Screen';
import { Card } from '@/src/shared/components/ui/Card';
import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

export function FeedSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const autoPlayFeedVideos = useAppSettingsStore((state) => state.autoPlayFeedVideos);
  const setAutoPlayFeedVideos = useAppSettingsStore((state) => state.setAutoPlayFeedVideos);
  const autoSwipeFeedVideos = useAppSettingsStore((state) => state.autoSwipeFeedVideos);
  const setAutoSwipeFeedVideos = useAppSettingsStore((state) => state.setAutoSwipeFeedVideos);
  const feedPreserveAspectRatio = useAppSettingsStore((state) => state.feedPreserveAspectRatio);
  const setFeedPreserveAspectRatio = useAppSettingsStore((state) => state.setFeedPreserveAspectRatio);

  return (
    <Screen title={t('settings.feedSettings')} showBack contentStyle={styles.container}>
      <Card style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="bodyBold">{t('settings.autoPlayFeedVideos')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('settings.autoPlayFeedVideosHint')}
            </AppText>
          </View>
          <Switch
            value={autoPlayFeedVideos}
            onValueChange={(value) => {
              void setAutoPlayFeedVideos(value);
            }}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </View>
      </Card>
      <Card style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="bodyBold">{t('settings.autoSwipeFeedVideos')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('settings.autoSwipeFeedVideosHint')}
            </AppText>
          </View>
          <Switch
            value={autoSwipeFeedVideos}
            onValueChange={(value) => {
              void setAutoSwipeFeedVideos(value);
            }}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </View>
      </Card>
      <Card style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="bodyBold">{t('settings.preserveFeedAspectRatio')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('settings.preserveFeedAspectRatioHint')}
            </AppText>
          </View>
          <Switch
            value={feedPreserveAspectRatio}
            onValueChange={(value) => {
              void setFeedPreserveAspectRatio(value);
            }}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
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
