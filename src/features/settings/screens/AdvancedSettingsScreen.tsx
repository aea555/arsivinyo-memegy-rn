import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { Card } from '@/src/shared/components/ui/Card';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { useAuthStore } from '@/src/store/authStore';
import { deleteAccount } from '@/src/features/profile/api/profileApi';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function AdvancedSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const [deleteVisible, setDeleteVisible] = useState(false);

  return (
    <Screen title={t('settings.advancedSettings')} showBack contentStyle={styles.container}>
      <Card style={styles.sectionCard}>
        <AppText variant="bodyBold" style={[styles.dangerTitle, { color: palette.error }]}>
          {t('settings.dangerZone')}
        </AppText>
        <View style={styles.dangerRow}>
          <Button label={t('settings.deleteAccount')} onPress={() => setDeleteVisible(true)} variant="danger" />
        </View>
      </Card>
      <ConfirmModal
        visible={deleteVisible}
        title={t('settings.deleteConfirmTitle')}
        body={t('settings.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={async () => {
          setDeleteVisible(false);
          await deleteAccount();
          await logout();
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
