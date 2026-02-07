import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { ProfileSummaryCard } from '@/src/features/profile/components/ProfileSummaryCard';
import { Card } from '@/src/shared/components/ui/Card';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { deleteAccount } from '@/src/features/profile/api/profileApi';
import { useAuthStore } from '@/src/store/authStore';

export function ProfileDetailsScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { palette } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  return (
    <Screen title={t('settings.profile')} showBack contentStyle={styles.container}>
      <ProfileSummaryCard
        username={profile?.username}
        email={profile?.email}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <Card style={styles.sectionCard}>
        <AppText variant="bodyBold" style={[styles.dangerTitle, { color: palette.error }]}>
          {t('settings.dangerZone')}
        </AppText>
        <View style={styles.dangerRow}>
          <Button label={t('settings.logout')} onPress={() => setLogoutVisible(true)} variant="secondary" />
          <Button label={t('settings.deleteAccount')} onPress={() => setDeleteVisible(true)} variant="danger" />
        </View>
      </Card>
      <ConfirmModal
        visible={logoutVisible}
        title={t('settings.logoutConfirmTitle')}
        body={t('settings.logoutConfirmBody')}
        confirmLabel={t('settings.logout')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          setLogoutVisible(false);
          await logout();
        }}
        onCancel={() => setLogoutVisible(false)}
      />
      <ConfirmModal
        visible={deleteVisible}
        title={t('settings.deleteConfirmTitle')}
        body={t('settings.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={async () => {
          setDeleteVisible(false);
          try {
            await deleteAccount();
          } finally {
            await logout();
          }
        }}
        onCancel={() => setDeleteVisible(false)}
      />
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
  dangerTitle: {},
  dangerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
