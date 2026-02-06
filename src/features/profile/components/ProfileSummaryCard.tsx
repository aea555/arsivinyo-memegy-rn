import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

type ProfileSummaryCardProps = {
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export function ProfileSummaryCard({ username, email, avatarUrl }: ProfileSummaryCardProps) {
  const { palette } = useTheme();
  const initials = username?.trim().charAt(0).toUpperCase() ?? 'U';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: palette.border }]} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: palette.accent }]}>
            <AppText variant="bodyBold" style={styles.initials}>
              {initials}
            </AppText>
          </View>
        )}
        <View style={styles.info}>
          <AppText variant="bodyBold">{username ?? 'User'}</AppText>
          {email ? (
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {email}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    gap: spacing.xs,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  placeholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
  },
});
