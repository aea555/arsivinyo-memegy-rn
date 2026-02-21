import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getTerms } from '@/src/features/settings/api/systemApi';
import { MarkdownDocument } from '@/src/features/settings/components/MarkdownDocument';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { spacing } from '@/src/shared/theme/spacing';

type TermsScreenProps = {
  showBack?: boolean;
};

export function TermsScreen({ showBack = true }: TermsScreenProps) {
  const { t } = useTranslation();
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['system', 'terms'],
    queryFn: getTerms,
  });

  return (
    <Screen title={t('settings.termsTitle')} showBack={showBack} contentStyle={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Card style={styles.metaCard}>
          <AppText variant="bodyBold">{t('settings.termsVersion', { version: data?.version ?? '-' })}</AppText>
          {data?.effective_at ? (
            <AppText variant="caption">{t('settings.termsEffectiveAt', { date: data.effective_at })}</AppText>
          ) : null}
          {data?.jurisdictions?.length ? (
            <AppText variant="caption">{t('settings.termsJurisdictions', { list: data.jurisdictions.join(', ') })}</AppText>
          ) : null}
          <View style={styles.actionsRow}>
            <Button
              label={isRefetching ? t('common.loading') : t('common.retry')}
              variant="secondary"
              onPress={() => {
                void refetch();
              }}
              disabled={isRefetching}
            />
            {data?.url ? (
              <Button
                label={t('settings.openTermsUrl')}
                variant="secondary"
                onPress={() => {
                  void Linking.openURL(data.url as string);
                }}
              />
            ) : null}
          </View>
        </Card>

        <Card style={styles.bodyCard}>
          {isLoading ? <AppText>{t('common.loading')}</AppText> : null}
          {!isLoading && data?.content ? <MarkdownDocument content={data.content} /> : null}
          {!isLoading && !data?.content && !data?.url ? (
            <AppText>{t('settings.termsUnavailable')}</AppText>
          ) : null}
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  metaCard: {
    gap: spacing.xs,
  },
  bodyCard: {
    minHeight: 220,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
