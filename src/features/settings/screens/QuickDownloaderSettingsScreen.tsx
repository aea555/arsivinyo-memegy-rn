import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, PermissionsAndroid, Platform, StyleSheet } from 'react-native';

import {
  ensureBackgroundPermission,
  getBackgroundState,
  getQuickUploadSettings,
  setQuickUploadSettings,
} from '@/src/features/upload/api/downloaderApi';
import { isLocalDownloaderRuntimeAvailable } from '@/src/native/localDownloader';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { SettingsRow } from '@/src/shared/components/ui/SettingsRow';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useToastStore } from '@/src/store/toastStore';

type BackgroundStateSnapshot = Awaited<ReturnType<typeof getBackgroundState>> | null;

export function QuickDownloaderSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const [backgroundState, setBackgroundState] = useState<BackgroundStateSnapshot>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isRefreshingNotification, setIsRefreshingNotification] = useState(false);

  const refreshBackgroundState = useCallback(async () => {
    if (!isLocalDownloaderRuntimeAvailable) return;
    setIsLoading(true);
    try {
      const snapshot = await getBackgroundState();
      setBackgroundState(snapshot);
    } catch {
      showToast(t('settings.quickDownloaderStatusLoadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useFocusEffect(
    useCallback(() => {
      void refreshBackgroundState();
    }, [refreshBackgroundState])
  );

  const refreshStickyNotification = useCallback(async () => {
    if (!isLocalDownloaderRuntimeAvailable) return;
    setIsRefreshingNotification(true);
    try {
      const current = await getQuickUploadSettings();
      await setQuickUploadSettings(current);
      await refreshBackgroundState();
      showToast(t('settings.quickDownloaderNotificationRefreshed'), 'success');
    } catch {
      showToast(t('settings.quickDownloaderNotificationRefreshFailed'), 'error');
    } finally {
      setIsRefreshingNotification(false);
    }
  }, [refreshBackgroundState, showToast, t]);

  const requestNotificationPermission = useCallback(async () => {
    if (!isLocalDownloaderRuntimeAvailable) return;
    setIsRequestingPermission(true);
    try {
      const sdkInt = Platform.OS === 'android' ? Number(Platform.Version) : 0;
      let granted = false;
      let canAskAgain = true;

      if (sdkInt >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
        const alreadyGranted = await PermissionsAndroid.check(permission);
        if (alreadyGranted) {
          granted = true;
        } else {
          const result = await PermissionsAndroid.request(permission);
          granted = result === PermissionsAndroid.RESULTS.GRANTED;
          canAskAgain = result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
        }
      } else {
        const result = await ensureBackgroundPermission();
        granted = result.granted;
        canAskAgain = result.canAskAgain;
      }

      await refreshBackgroundState();
      if (granted) {
        showToast(t('settings.quickDownloaderPermissionGranted'), 'success');
        await refreshStickyNotification();
      } else {
        showToast(
          canAskAgain
            ? t('settings.quickDownloaderPermissionDenied')
            : t('settings.quickDownloaderPermissionDeniedSettingsHint'),
          'error'
        );
      }
    } catch {
      showToast(t('settings.quickDownloaderPermissionFailed'), 'error');
    } finally {
      setIsRequestingPermission(false);
    }
  }, [refreshBackgroundState, refreshStickyNotification, showToast, t]);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      showToast(t('settings.quickDownloaderOpenSettingsFailed'), 'error');
    }
  }, [showToast, t]);

  const permissionGranted = backgroundState?.notificationPermissionGranted ?? false;
  const permissionRequired = backgroundState?.notificationPermissionRequired ?? false;
  const queueText = useMemo(() => {
    const size = backgroundState?.queueSize ?? 0;
    const max = backgroundState?.maxQueueSize ?? 0;
    return `${size}/${max}`;
  }, [backgroundState?.maxQueueSize, backgroundState?.queueSize]);

  if (!isLocalDownloaderRuntimeAvailable) {
    return (
      <Screen title={t('settings.quickDownloader')} showBack contentStyle={styles.container}>
        <Card>
          <AppText style={{ color: palette.text.secondary }}>
            {t('settings.quickDownloaderAndroidOnly')}
          </AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('settings.quickDownloader')} showBack contentStyle={styles.container}>
      <Card style={styles.sectionCard}>
        <AppText variant="caption" style={{ color: palette.text.secondary }}>
          {t('settings.quickDownloaderDescription')}
        </AppText>
      </Card>

      <Card style={styles.listCard}>
        <SettingsRow
          title={t('settings.quickDownloaderPermissionStatus')}
          subtitle={
            permissionRequired
              ? permissionGranted
                ? t('settings.quickDownloaderPermissionStatusGranted')
                : t('settings.quickDownloaderPermissionStatusDenied')
              : t('settings.quickDownloaderPermissionNotRequired')
          }
          icon={<Ionicons name="notifications-outline" size={18} color={palette.text.primary} />}
          showChevron={false}
          right={
            isLoading ? (
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('common.loading')}
              </AppText>
            ) : null
          }
        />
        <SettingsRow
          title={t('settings.quickDownloaderServiceStatus')}
          subtitle={
            backgroundState?.serviceRunning
              ? t('settings.quickDownloaderServiceStatusRunning')
              : t('settings.quickDownloaderServiceStatusIdle')
          }
          icon={<Ionicons name="hardware-chip-outline" size={18} color={palette.text.primary} />}
          showChevron={false}
        />
        <SettingsRow
          title={t('settings.quickDownloaderQueueStatus')}
          subtitle={queueText}
          icon={<Ionicons name="list-outline" size={18} color={palette.text.primary} />}
          showChevron={false}
        />
        <SettingsRow
          title={t('settings.quickDownloaderPendingUploads')}
          subtitle={String(backgroundState?.pendingQuickUploadCount ?? 0)}
          icon={<Ionicons name="cloud-upload-outline" size={18} color={palette.text.primary} />}
          showChevron={false}
        />
        <SettingsRow
          title={t('settings.quickDownloaderPendingMetadata')}
          subtitle={String(backgroundState?.pendingQuickMetadataCount ?? 0)}
          icon={<Ionicons name="create-outline" size={18} color={palette.text.primary} />}
          showChevron={false}
          isLast
        />
      </Card>

      <Card style={styles.sectionCard}>
        <Button
          label={t('settings.quickDownloaderRequestPermission')}
          onPress={() => {
            void requestNotificationPermission();
          }}
          disabled={isRequestingPermission}
        />
        {!permissionGranted ? (
          <Button
            label={t('settings.quickDownloaderOpenSystemSettings')}
            variant="secondary"
            onPress={() => {
              void openSystemSettings();
            }}
          />
        ) : null}
        <Button
          label={t('settings.quickDownloaderRefreshNotification')}
          variant="outline"
          onPress={() => {
            void refreshStickyNotification();
          }}
          disabled={!permissionGranted || isRefreshingNotification}
        />
      </Card>
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
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
});
