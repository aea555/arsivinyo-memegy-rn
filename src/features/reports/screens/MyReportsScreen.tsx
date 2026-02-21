import { useInfiniteQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMyReports } from '@/src/features/reports/api/reportsApi';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { spacing } from '@/src/shared/theme/spacing';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

const PAGE_SIZE = 20;

export function MyReportsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['myReports'],
    queryFn: ({ pageParam = null }: { pageParam: number | null }) => getMyReports(PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: null,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const localizeReason = (reason: string) => {
    return t(`reports.reason.${reason}`, { defaultValue: reason });
  };

  const localizeReportStatus = (status: string) => {
    const normalized = status.trim().toLowerCase();
    return t(`reports.status.${normalized}`, { defaultValue: status });
  };

  const localizeModerationState = (state: string) => {
    const normalized = state.trim().toUpperCase();
    return t(`reports.moderation.${normalized}`, { defaultValue: state });
  };

  const reportStatusColor = (status: string) => {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'resolved') return palette.success;
    if (normalized === 'rejected') return palette.text.secondary;
    if (normalized === 'under_review') return palette.accent;
    if (normalized === 'auto_quarantined') return palette.error;
    return palette.warning;
  };

  const visibilityColor = (visibility: string) => {
    const normalized = visibility.trim().toUpperCase();
    if (normalized === 'VISIBLE') return palette.success;
    if (normalized === 'REMOVED') return palette.error;
    if (normalized === 'QUARANTINED') return palette.warning;
    return palette.text.secondary;
  };

  const badgeColorStyle = (color: string) => ({
    borderColor: withAlpha(color, 0.56),
    borderLeftColor: color,
    backgroundColor: withAlpha(color, 0.2),
  });

  return (
    <Screen title={t('reports.myReportsTitle')} showBack contentStyle={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.report.id}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          isLoading ? (
            <AppText>{t('common.loading')}</AppText>
          ) : (
            <AppText>{t('reports.empty')}</AppText>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <AppText variant="bodyBold" numberOfLines={2} style={styles.titleText}>
              {item.video_title || t('video.untitled')}
            </AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {new Date(item.report.created_at).toLocaleString()}
            </AppText>
            <View style={styles.statusStack}>
              <View
                style={[
                  styles.statusBadge,
                  badgeColorStyle(reportStatusColor(item.report.status)),
                ]}
              >
                <AppText variant="caption" numberOfLines={1} style={styles.statusText}>
                  {t('reports.reportStatusLabel', { status: localizeReportStatus(item.report.status) })}
                </AppText>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  badgeColorStyle(palette.accent),
                ]}
              >
                <AppText variant="caption" style={styles.statusText}>
                  {t('reports.categoryLabel', {
                    category: item.report.reason_codes.map(localizeReason).join(', '),
                  })}
                </AppText>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  badgeColorStyle(visibilityColor(item.video_moderation_state ?? 'UNKNOWN')),
                ]}
              >
                <AppText variant="caption" style={styles.statusText}>
                  {t('reports.visibilityLabel', {
                    visibility: localizeModerationState(item.video_moderation_state ?? 'UNKNOWN'),
                  })}
                </AppText>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  titleText: {
    flexShrink: 1,
  },
  statusStack: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
  },
  statusText: {
    flexShrink: 1,
    lineHeight: 18,
  },
});
