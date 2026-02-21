import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { spacing } from '@/src/shared/theme/spacing';
import { useAuthStore } from '@/src/store/authStore';

export function MaintenanceScreen() {
  const { t } = useTranslation();
  const refreshModeStatus = useAuthStore((state) => state.refreshModeStatus);
  const logout = useAuthStore((state) => state.logout);
  const [checking, setChecking] = useState(false);

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.content}>
        <AppText variant="heading2">{t('maintenance.title')}</AppText>
        <AppText variant="body">{t('maintenance.body')}</AppText>
        <View style={styles.actions}>
          <Button
            label={checking ? t('common.loading') : t('maintenance.retry')}
            onPress={() => {
              setChecking(true);
              void refreshModeStatus(true).finally(() => setChecking(false));
            }}
            disabled={checking}
          />
          <Button
            label={t('settings.logout')}
            variant="secondary"
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
