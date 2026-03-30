import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { SettingsRow } from '@/src/shared/components/ui/SettingsRow';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useToastStore } from '@/src/store/toastStore';
import {
  deleteCookieProfile,
  getDefaultCookieProfile,
  importCookieProfile,
  listCookieProfiles,
  LOCAL_COOKIE_PLATFORMS,
  setDefaultCookieProfile,
  type CookiePlatform,
  type CookieProfile,
} from '@/src/features/upload/services/downloaderCookies';
import { isLocalDownloaderRuntimeAvailable } from '@/src/native/localDownloader';

type SelectorMode = 'default' | 'delete' | null;

function getPlatformIcon(platform: CookiePlatform): keyof typeof Ionicons.glyphMap {
  if (platform === 'youtube') return 'logo-youtube';
  if (platform === 'instagram') return 'logo-instagram';
  if (platform === 'facebook') return 'logo-facebook';
  if (platform === 'twitter') return 'logo-twitter';
  if (platform === 'reddit') return 'logo-reddit';
  return 'musical-notes-outline';
}

export function DownloaderCookiesSettingsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);

  const [loading, setLoading] = useState(false);
  const [cookieSummary, setCookieSummary] = useState<Record<CookiePlatform, { count: number; defaultProfile: string | null }>>(
    Object.fromEntries(
      LOCAL_COOKIE_PLATFORMS.map((platform) => [platform, { count: 0, defaultProfile: null }])
    ) as Record<CookiePlatform, { count: number; defaultProfile: string | null }>
  );

  const [actionPlatform, setActionPlatform] = useState<CookiePlatform | null>(null);
  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorPlatform, setSelectorPlatform] = useState<CookiePlatform | null>(null);
  const [selectorProfiles, setSelectorProfiles] = useState<CookieProfile[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ platform: CookiePlatform; profileName: string } | null>(null);

  const refreshCookieData = useCallback(async () => {
    if (!isLocalDownloaderRuntimeAvailable) return;

    setLoading(true);
    try {
      const summaryEntries = await Promise.all(
        LOCAL_COOKIE_PLATFORMS.map(async (platform) => {
          const [profiles, defaultProfile] = await Promise.all([
            listCookieProfiles(platform),
            getDefaultCookieProfile(platform),
          ]);
          return [platform, { count: profiles.length, defaultProfile }] as const;
        })
      );

      setCookieSummary(
        Object.fromEntries(summaryEntries) as Record<CookiePlatform, { count: number; defaultProfile: string | null }>
      );
    } catch (error) {
      if (__DEV__) {
        console.debug('[settings.cookies] refresh_failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      showToast(t('settings.cookieOperationFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void refreshCookieData();
  }, [refreshCookieData]);

  const closeSelector = useCallback(() => {
    setSelectorMode(null);
    setSelectorPlatform(null);
    setSelectorProfiles([]);
  }, []);

  const handleImport = useCallback(async (platform: CookiePlatform) => {
    try {
      const result = await importCookieProfile(platform);
      if (!result.imported) return;

      if (result.profileName) {
        await setDefaultCookieProfile(platform, result.profileName);
      }

      await refreshCookieData();
      showToast(
        t('settings.cookieImportSuccess', {
          platform: t(`settings.cookiePlatform.${platform}`),
          profile: result.profileName ?? 'default',
        }),
        'success'
      );
    } catch (error) {
      if (__DEV__) {
        console.debug('[settings.cookies] import_failed', {
          platform,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [refreshCookieData, showToast, t]);

  const openSelector = useCallback(async (platform: CookiePlatform, mode: Exclude<SelectorMode, null>) => {
    try {
      const profiles = await listCookieProfiles(platform);
      if (profiles.length === 0) {
        showToast(t('settings.noCookieProfiles'), 'error');
        return;
      }

      setSelectorPlatform(platform);
      setSelectorMode(mode);
      setSelectorProfiles(profiles);
    } catch {
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [showToast, t]);

  const handleSelectorSelect = useCallback(async (profileName: string) => {
    if (!selectorMode || !selectorPlatform) return;

    if (selectorMode === 'delete') {
      setPendingDelete({ platform: selectorPlatform, profileName });
      return;
    }

    try {
      await setDefaultCookieProfile(selectorPlatform, profileName);
      await refreshCookieData();
      closeSelector();
      showToast(t('settings.cookieDefaultUpdated'), 'success');
    } catch {
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [closeSelector, refreshCookieData, selectorMode, selectorPlatform, showToast, t]);

  const handleDeleteProfile = useCallback(async () => {
    if (!pendingDelete) return;

    const { platform, profileName } = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteCookieProfile(platform, profileName);
      await refreshCookieData();
      closeSelector();
      showToast(t('settings.cookieDeleteSuccess'), 'success');
    } catch {
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [closeSelector, pendingDelete, refreshCookieData, showToast, t]);

  const subtitleByPlatform = useMemo(() => {
    return Object.fromEntries(
      LOCAL_COOKIE_PLATFORMS.map((platform) => {
        const summary = cookieSummary[platform];
        const defaultText = summary.defaultProfile ?? t('settings.noDefaultCookie');
        return [
          platform,
          t('settings.cookiePlatformHint', {
            count: summary.count,
            defaultProfile: defaultText,
          }),
        ];
      })
    ) as Record<CookiePlatform, string>;
  }, [cookieSummary, t]);

  if (!isLocalDownloaderRuntimeAvailable) {
    return (
      <Screen title={t('settings.downloaderCookies')} showBack contentStyle={styles.container}>
        <Card>
          <AppText style={{ color: palette.text.secondary }}>{t('settings.cookieAndroidOnly')}</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Screen title={t('settings.downloaderCookies')} showBack contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.listCard}>
            {LOCAL_COOKIE_PLATFORMS.map((platform, index) => (
              <SettingsRow
                key={platform}
                title={t(`settings.cookiePlatform.${platform}`)}
                subtitle={subtitleByPlatform[platform]}
                icon={<Ionicons name={getPlatformIcon(platform)} size={18} color={palette.text.primary} />}
                onPress={() => setActionPlatform(platform)}
                isLast={index === LOCAL_COOKIE_PLATFORMS.length - 1}
              />
            ))}
          </Card>
          {loading ? (
            <AppText variant="caption" style={{ color: palette.text.secondary, textAlign: 'center' }}>
              {t('common.loading')}
            </AppText>
          ) : null}
        </ScrollView>
      </Screen>

      <Modal
        visible={Boolean(actionPlatform)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionPlatform(null)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
          onPress={() => setActionPlatform(null)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="bodyBold" style={styles.modalTitle}>
              {actionPlatform ? t(`settings.cookiePlatform.${actionPlatform}`) : ''}
            </AppText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  if (!actionPlatform) return;
                  const selected = actionPlatform;
                  setActionPlatform(null);
                  void handleImport(selected);
                }}
              >
                <AppText>{t('settings.importCookieAction')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  if (!actionPlatform) return;
                  const selected = actionPlatform;
                  setActionPlatform(null);
                  void openSelector(selected, 'default');
                }}
              >
                <AppText>{t('settings.selectDefaultCookieAction')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  if (!actionPlatform) return;
                  const selected = actionPlatform;
                  setActionPlatform(null);
                  void openSelector(selected, 'delete');
                }}
              >
                <AppText style={{ color: palette.error }}>{t('settings.deleteCookieProfileAction')}</AppText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(selectorPlatform && selectorMode)}
        transparent
        animationType="fade"
        onRequestClose={closeSelector}
      >
        <Pressable style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]} onPress={closeSelector}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="bodyBold" style={styles.modalTitle}>
              {selectorMode === 'default'
                ? t('settings.selectDefaultCookieAction')
                : t('settings.deleteCookieProfileAction')}
            </AppText>
            <ScrollView style={styles.selectorList}>
              {selectorProfiles.map((profile) => (
                <Pressable
                  key={profile.profileName}
                  style={[styles.modalAction, { borderColor: palette.border }]}
                  onPress={() => {
                    void handleSelectorSelect(profile.profileName);
                  }}
                >
                  <AppText style={selectorMode === 'delete' ? { color: palette.error } : undefined}>
                    {profile.profileName}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={Boolean(pendingDelete)}
        title={t('settings.deleteCookieProfileConfirmTitle')}
        body={t('settings.deleteCookieProfileConfirmMessage', { profile: pendingDelete?.profileName ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void handleDeleteProfile();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 420,
  },
  modalTitle: {
    textAlign: 'center',
  },
  modalActions: {
    gap: spacing.sm,
  },
  modalAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  selectorList: {
    maxHeight: 260,
  },
});
