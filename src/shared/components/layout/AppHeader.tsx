import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppText } from '@/src/shared/components/ui/AppText';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { spacing } from '@/src/shared/theme/spacing';
import { useShadows } from '@/src/shared/theme/shadows';

type AppHeaderProps = {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
};

export function AppHeader({ title, showBack = false, rightAction }: AppHeaderProps) {
  const router = useRouter();
  const { palette } = useTheme();
  const shadows = useShadows();

  return (
    <View
      style={[
        styles.container,
        shadows.subtle,
        { borderBottomColor: palette.border, backgroundColor: palette.background },
      ]}
    >
      <View style={styles.left}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={palette.text.primary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        <AppText variant="heading2">{title}</AppText>
      </View>
      <View style={styles.right}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backPressed: {
    transform: [{ scale: 0.96 }],
  },
});
