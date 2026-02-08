import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { notifyFeedRandomRefresh } from '@/src/features/feed/services/feedEvents';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { useShadows } from '@/src/shared/theme/shadows';
import { useAuthStore } from '@/src/store/authStore';

const FEED_RAPID_TAP_WINDOW_MS = 900;
const FEED_RAPID_TAP_RESET_COUNT = 3;

function TabItemButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  style,
  onPress,
  onLongPress,
  testID,
  children,
}: BottomTabBarButtonProps) {
  const { palette } = useTheme();
  const isActive = Boolean(accessibilityState?.selected);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        style,
        styles.tabItemButton,
        isActive ? { backgroundColor: palette.background } : null,
        pressed ? styles.tabItemPressed : null,
      ]}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

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
  const shadows = useShadows();

  return (
    <Pressable
      onPress={() => router.push('/upload-modal')}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        style,
        styles.uploadButton,
        { top: layoutConfig.tabBar.uploadTopOffset },
        pressed ? styles.uploadPressed : null,
      ]}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? 'Upload video'}
      accessibilityState={accessibilityState}
      testID={testID}
    >
      <View
        style={[
          styles.uploadShell,
          shadows.strong,
          {
            width: layoutConfig.tabBar.uploadShellSize,
            height: layoutConfig.tabBar.uploadShellSize,
            borderRadius: Math.round(layoutConfig.tabBar.uploadShellSize * 0.29),
            backgroundColor: palette.surface,
            borderColor: withAlpha(palette.border, 0.95),
          },
        ]}
      >
        <View
          style={[
            styles.uploadInner,
            {
              width: layoutConfig.tabBar.uploadInnerSize,
              height: layoutConfig.tabBar.uploadInnerSize,
              borderRadius: Math.round(layoutConfig.tabBar.uploadInnerSize * 0.26),
              backgroundColor: palette.accent,
              borderColor: withAlpha(palette.onAccent, 0.22),
            },
          ]}
        >
          <Ionicons name="add" size={30} color={palette.onAccent} />
        </View>
      </View>
    </Pressable>
  );
}

function TabIcon({
  name,
  focused,
  color,
  size,
  palette,
  shadows,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
  palette: ReturnType<typeof useTheme>['palette'];
  shadows: ReturnType<typeof useShadows>;
}) {
  const progress = useSharedValue(focused ? 1 : 0);
  const inactiveBg = withAlpha(palette.background, 0.76);
  const activeBg = palette.accent;
  const inactiveBorder = withAlpha(palette.border, 0.95);
  const activeBorder = withAlpha(palette.accent, 0.6);

  React.useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, progress]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.84, 1.1]) }],
  }));

  const shellStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.08]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -1]) },
    ],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveBg, activeBg]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveBorder, activeBorder]
    ),
  }));

  const activeStyle: ViewStyle = focused
    ? {
        ...shadows.strong,
      }
    : {
        ...shadows.medium,
      };

  return (
    <View style={styles.tabIconFrame}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIconGlow,
          glowStyle,
          {
            borderColor: withAlpha(palette.accent, 0.5),
            backgroundColor: withAlpha(palette.accent, 0.08),
          },
        ]}
      />
      <Animated.View style={[styles.tabIconWrap, activeStyle, shellStyle]}>
        <Ionicons name={name} size={size - 1} color={focused ? palette.onAccent : color} />
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const shadows = useShadows();
  const authStatus = useAuthStore((state) => state.status);
  const [showOtaSuccessModal, setShowOtaSuccessModal] = React.useState(false);
  const hasCheckedOtaSuccessModalRef = React.useRef(false);
  const feedRapidTapTimestampsRef = React.useRef<number[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    if (authStatus !== 'authenticated') {
      hasCheckedOtaSuccessModalRef.current = false;
      setShowOtaSuccessModal(false);
      return () => {
        cancelled = true;
      };
    }

    if (hasCheckedOtaSuccessModalRef.current) {
      return () => {
        cancelled = true;
      };
    }

    hasCheckedOtaSuccessModalRef.current = true;

    void (async () => {
      const dismissed = await LocalStorage.getOtaSuccessModalDismissed();
      if (cancelled) return;
      if (dismissed !== true) {
        setShowOtaSuccessModal(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.accent,
          tabBarInactiveTintColor: palette.text.secondary,
          tabBarButton: (props) => <TabItemButton {...props} />,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: withAlpha(palette.border, 0.9),
            borderTopWidth: 1,
            overflow: 'visible',
            height: layoutConfig.tabBar.height,
            paddingBottom: layoutConfig.tabBar.paddingBottom,
            paddingTop: layoutConfig.tabBar.paddingTop,
            paddingHorizontal: layoutConfig.tabBar.paddingHorizontal,
            ...shadows.medium,
          },
          tabBarItemStyle: {
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
          },
          tabBarIconStyle: {
            marginTop: 0,
            marginBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: 'Comfortaa_700Bold',
            lineHeight: 13,
            textShadowColor: withAlpha(palette.shadow, 0.22),
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.myVideos'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                name="albums"
                color={color}
                size={size}
                focused={focused}
                palette={palette}
                shadows={shadows}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: t('tabs.feed'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                name="home"
                color={color}
                size={size}
                focused={focused}
                palette={palette}
                shadows={shadows}
              />
            ),
          }}
          listeners={{
            tabPress: () => {
              const now = Date.now();
              const tapsInWindow = feedRapidTapTimestampsRef.current.filter(
                (timestamp) => now - timestamp <= FEED_RAPID_TAP_WINDOW_MS
              );
              tapsInWindow.push(now);
              feedRapidTapTimestampsRef.current = tapsInWindow;

              if (tapsInWindow.length < FEED_RAPID_TAP_RESET_COUNT) return;
              feedRapidTapTimestampsRef.current = [];
              notifyFeedRandomRefresh();
            },
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
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                name="search"
                color={color}
                size={size}
                focused={focused}
                palette={palette}
                shadows={shadows}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                name="settings"
                color={color}
                size={size}
                focused={focused}
                palette={palette}
                shadows={shadows}
              />
            ),
          }}
        />
      </Tabs>
      <ConfirmModal
        visible={showOtaSuccessModal}
        title={t('ota.successTitle')}
        body={t('ota.successBody')}
        confirmLabel={t('ota.dontShowAgain')}
        cancelLabel={t('common.ok')}
        onConfirm={() => {
          void LocalStorage.setOtaSuccessModalDismissed(true);
          setShowOtaSuccessModal(false);
        }}
        onCancel={() => {
          setShowOtaSuccessModal(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabItemButton: {
    borderRadius: 16,
    marginHorizontal: 3,
    top: layoutConfig.tabBar.itemTopOffset,
    paddingTop: 3,
    paddingBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemPressed: {
    transform: [{ scale: 0.98 }],
  },
  tabIconFrame: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconGlow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 2,
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  uploadPressed: {
    transform: [{ scale: 0.96 }],
  },
  uploadShell: {
    borderWidth: 1,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadInner: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
