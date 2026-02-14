import { useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/src/shared/components/ui/Input';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import {
  deleteAccount,
  updateMyUsername,
  UpdateUsernameError,
} from '@/src/features/profile/api/profileApi';
import { useAuthStore } from '@/src/store/authStore';
import {
  DEFAULT_USERNAME_RULES,
  normalizeUsernameDraft,
  validateUsername,
} from '@/src/shared/utils/usernameValidation';
import { useToastStore } from '@/src/store/toastStore';

export function ProfileDetailsScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { palette } = useTheme();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  React.useEffect(() => {
    setUsernameDraft(normalizeUsernameDraft(profile?.username ?? ''));
  }, [profile?.username]);

  const currentUsername = normalizeUsernameDraft(profile?.username ?? '');
  const usernameValidation = validateUsername(usernameDraft, DEFAULT_USERNAME_RULES);
  const isUsernameChanged = usernameValidation.normalized !== currentUsername;
  const localValidationError =
    usernameDraft.length > 0 && !usernameValidation.isValid
      ? t('settings.usernameInvalid')
      : null;
  const canSaveUsername =
    isUsernameChanged && usernameValidation.isValid && !savingUsername;

  const handleSaveUsername = async () => {
    if (!canSaveUsername) return;
    setSavingUsername(true);
    setUsernameError(null);

    const idempotencyKey = `username-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    try {
      const updatedUser = await updateMyUsername(
        { username: usernameValidation.normalized },
        { idempotencyKey }
      );
      setUser(updatedUser);
      queryClient.setQueryData(['me'], updatedUser);
      setUsernameDraft(normalizeUsernameDraft(updatedUser.username));
      showToast(t('settings.usernameUpdated'), 'success');
    } catch (error) {
      if (error instanceof UpdateUsernameError) {
        if (error.code === 'invalid_username') {
          setUsernameError(t('settings.usernameInvalid'));
        } else if (error.code === 'username_taken') {
          setUsernameError(t('settings.usernameTaken'));
        } else if (error.code === 'idempotency_mismatch') {
          setUsernameError(t('settings.usernameConflictRetry'));
        } else if (error.code === 'rate_limited') {
          setUsernameError(t('settings.usernameRateLimited'));
          showToast(t('settings.usernameRateLimited'), 'error');
        } else {
          setUsernameError(t('settings.usernameUpdateFailed'));
        }
      } else {
        setUsernameError(t('settings.usernameUpdateFailed'));
      }
    } finally {
      setSavingUsername(false);
    }
  };

  return (
    <Screen title={t('settings.profile')} showBack contentStyle={styles.container}>
      <ProfileSummaryCard
        username={profile?.username}
        email={profile?.email}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <Card style={styles.sectionCard}>
        <AppText variant="bodyBold">{t('settings.usernameLabel')}</AppText>
        <Input
          placeholder={t('auth.usernamePlaceholder')}
          value={usernameDraft}
          onChangeText={(value) => {
            setUsernameDraft(normalizeUsernameDraft(value));
            setUsernameError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={DEFAULT_USERNAME_RULES.max_length}
        />
        <AppText variant="caption" style={styles.usernameHint}>
          {t('auth.usernameRulesHint', {
            min: DEFAULT_USERNAME_RULES.min_length,
            max: DEFAULT_USERNAME_RULES.max_length,
          })}
        </AppText>
        {usernameError ? (
          <AppText variant="caption" style={{ color: palette.error }}>
            {usernameError}
          </AppText>
        ) : localValidationError ? (
          <AppText variant="caption" style={{ color: palette.error }}>
            {localValidationError}
          </AppText>
        ) : null}
        <Button
          label={
            savingUsername
              ? t('settings.usernameSaving')
              : t('common.save')
          }
          onPress={handleSaveUsername}
          disabled={!canSaveUsername}
        />
        <AppText variant="caption" style={styles.usernameHint}>
          {t('settings.usernamePropagationHint')}
        </AppText>
      </Card>
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
  usernameHint: {
    opacity: 0.75,
  },
  dangerTitle: {},
  dangerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
