import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { Screen } from '@/src/shared/components/layout/Screen';
import { ProfileSummaryCard } from '@/src/features/profile/components/ProfileSummaryCard';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const { data: profile } = useProfile();

  return (
    <Screen
      title={t('profile.title')}
      contentStyle={styles.container}
      rightAction={
        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settingsButton, pressed ? styles.settingsPressed : null]}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          <Ionicons name="settings-outline" size={20} color={palette.text.primary} />
        </Pressable>
      }
    >
      <ProfileSummaryCard
        username={profile?.username}
        email={profile?.email}
        avatarUrl={profile?.avatar_url ?? null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {},
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPressed: {
    transform: [{ scale: 0.96 }],
  },
});
