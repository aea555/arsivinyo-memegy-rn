import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { shadows } from '@/src/shared/theme/shadows';

function UploadTabButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  style,
  onLongPress,
  testID,
}: BottomTabBarButtonProps) {
  const router = useRouter();
  const { palette } = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/upload-modal')}
      onLongPress={onLongPress}
      style={({ pressed }) => [style, styles.uploadButton, pressed ? styles.uploadPressed : null]}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? 'Upload video'}
      accessibilityState={accessibilityState}
      testID={testID}
    >
      <View style={[styles.uploadInner, { backgroundColor: palette.accent }]}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.text.secondary,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          ...shadows.subtle,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.myVideos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: t('tabs.feed'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: t('tabs.upload'),
          tabBarButton: (props) => <UploadTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    top: -12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  uploadPressed: {
    transform: [{ scale: 0.96 }],
  },
  uploadInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.strong,
  },
});
