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
import { Input } from '@/src/shared/components/ui/Input';
import { SettingsRow } from '@/src/shared/components/ui/SettingsRow';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useToastStore } from '@/src/store/toastStore';
import {
  deleteCookieProfile,
  deleteCustomDomainProfile,
  getDefaultCookieProfile,
  importCookieProfile,
  importCustomCookieProfile,
  listCookieProfiles,
  listCustomDomainProfiles,
  listCustomDomains,
  LOCAL_COOKIE_PLATFORMS,
  setDefaultCookieProfile,
  setCustomDomainDefault,
  type CookiePlatform,
  type CookieProfile,
  type CustomDomainProfile,
  type CustomDomainSummary,
} from '@/src/features/upload/services/downloaderCookies';
import { isLocalDownloaderRuntimeAvailable } from '@/src/native/localDownloader';

type SelectorMode = 'default' | 'delete' | null;
type CustomSelectorMode = 'default' | 'delete' | null;

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
  const [customDomains, setCustomDomains] = useState<CustomDomainSummary[]>([]);

  const [actionPlatform, setActionPlatform] = useState<CookiePlatform | null>(null);
  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorPlatform, setSelectorPlatform] = useState<CookiePlatform | null>(null);
  const [selectorProfiles, setSelectorProfiles] = useState<CookieProfile[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ platform: CookiePlatform; profileName: string } | null>(null);

  const [customActionDomain, setCustomActionDomain] = useState<string | null>(null);
  const [customSelectorMode, setCustomSelectorMode] = useState<CustomSelectorMode>(null);
  const [customSelectorDomain, setCustomSelectorDomain] = useState<string | null>(null);
  const [customSelectorProfiles, setCustomSelectorProfiles] = useState<CustomDomainProfile[]>([]);
  const [pendingCustomDelete, setPendingCustomDelete] = useState<{ domain: string; profileName: string } | null>(null);

  const [customImportVisible, setCustomImportVisible] = useState(false);
  const [customImportDomain, setCustomImportDomain] = useState('');
  const [customImportSubmitting, setCustomImportSubmitting] = useState(false);

  const refreshCookieData = useCallback(async () => {
    if (!isLocalDownloaderRuntimeAvailable) return;

    setLoading(true);
    try {
      const [summaryEntries, customDomainEntries] = await Promise.all([
        Promise.all(
          LOCAL_COOKIE_PLATFORMS.map(async (platform) => {
            const [profiles, defaultProfile] = await Promise.all([
              listCookieProfiles(platform),
              getDefaultCookieProfile(platform),
            ]);
            return [platform, { count: profiles.length, defaultProfile }] as const;
          })
        ),
        listCustomDomains(),
      ]);

      setCookieSummary(
        Object.fromEntries(summaryEntries) as Record<CookiePlatform, { count: number; defaultProfile: string | null }>
      );
      setCustomDomains(customDomainEntries);
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

  const closeCustomSelector = useCallback(() => {
    setCustomSelectorMode(null);
    setCustomSelectorDomain(null);
    setCustomSelectorProfiles([]);
  }, []);

  const openCustomImportModal = useCallback((presetDomain?: string) => {
    setCustomImportDomain(presetDomain ?? '');
    setCustomImportVisible(true);
  }, []);

  const closeCustomImportModal = useCallback(() => {
    setCustomImportVisible(false);
    setCustomImportDomain('');
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

  const handleImportCustomCookie = useCallback(async () => {
    setCustomImportSubmitting(true);
    try {
      const result = await importCustomCookieProfile({
        domain: customImportDomain.trim() || null,
      });
      if (!result.imported || !result.result) {
        return;
      }

      await refreshCookieData();
      closeCustomImportModal();
      showToast(
        t('settings.customCookieImportSuccess', {
          profile: result.result.profileName,
          domains: result.result.boundDomains.length,
        }),
        'success'
      );
    } catch (error) {
      if (__DEV__) {
        console.debug('[settings.cookies] custom_import_failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      showToast(t('settings.cookieOperationFailed'), 'error');
    } finally {
      setCustomImportSubmitting(false);
    }
  }, [closeCustomImportModal, customImportDomain, refreshCookieData, showToast, t]);

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

  const openCustomSelector = useCallback(async (domain: string, mode: Exclude<CustomSelectorMode, null>) => {
    try {
      const profiles = await listCustomDomainProfiles(domain);
      if (profiles.length === 0) {
        showToast(t('settings.noCustomDomainProfiles'), 'error');
        return;
      }

      setCustomSelectorDomain(domain);
      setCustomSelectorMode(mode);
      setCustomSelectorProfiles(profiles);
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

  const handleCustomSelectorSelect = useCallback(async (profileName: string) => {
    if (!customSelectorMode || !customSelectorDomain) return;

    if (customSelectorMode === 'delete') {
      setPendingCustomDelete({ domain: customSelectorDomain, profileName });
      return;
    }

    try {
      await setCustomDomainDefault(customSelectorDomain, profileName);
      await refreshCookieData();
      closeCustomSelector();
      showToast(t('settings.cookieDefaultUpdated'), 'success');
    } catch {
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [closeCustomSelector, customSelectorDomain, customSelectorMode, refreshCookieData, showToast, t]);

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

  const handleDeleteCustomProfile = useCallback(async () => {
    if (!pendingCustomDelete) return;

    const { domain, profileName } = pendingCustomDelete;
    setPendingCustomDelete(null);
    try {
      await deleteCustomDomainProfile(domain, profileName);
      await refreshCookieData();
      closeCustomSelector();
      showToast(t('settings.cookieDeleteSuccess'), 'success');
    } catch {
      showToast(t('settings.cookieOperationFailed'), 'error');
    }
  }, [closeCustomSelector, pendingCustomDelete, refreshCookieData, showToast, t]);

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
          <AppText variant="caption" style={[styles.sectionLabel, { color: palette.text.secondary }]}>
            {t('settings.downloaderCookies')}
          </AppText>
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

          <AppText variant="caption" style={[styles.sectionLabel, { color: palette.text.secondary }]}>
            {t('settings.customCookieDomains')}
          </AppText>
          <Card style={styles.listCard}>
            <SettingsRow
              title={t('settings.addCustomCookie')}
              subtitle={t('settings.customDomainOptionalHint')}
              icon={<Ionicons name="add-circle-outline" size={18} color={palette.accent} />}
              onPress={() => openCustomImportModal()}
              isLast={customDomains.length === 0}
            />
            {customDomains.map((entry, index) => (
              <SettingsRow
                key={entry.domain}
                title={entry.domain}
                subtitle={t('settings.customDomainHint', {
                  count: entry.profileCount,
                  defaultProfile: entry.defaultProfileName ?? t('settings.noDefaultCookie'),
                })}
                icon={<Ionicons name="globe-outline" size={18} color={palette.text.primary} />}
                onPress={() => setCustomActionDomain(entry.domain)}
                isLast={index === customDomains.length - 1}
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
        visible={Boolean(customActionDomain)}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomActionDomain(null)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
          onPress={() => setCustomActionDomain(null)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="bodyBold" style={styles.modalTitle}>
              {customActionDomain ?? ''}
            </AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary, textAlign: 'center' }}>
              {t('settings.customDomainActionPrompt')}
            </AppText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  const selected = customActionDomain;
                  setCustomActionDomain(null);
                  if (!selected) return;
                  openCustomImportModal(selected);
                }}
              >
                <AppText>{t('settings.importCustomCookieAction')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  if (!customActionDomain) return;
                  const selected = customActionDomain;
                  setCustomActionDomain(null);
                  void openCustomSelector(selected, 'default');
                }}
              >
                <AppText>{t('settings.selectCustomDefaultAction')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, { borderColor: palette.border }]}
                onPress={() => {
                  if (!customActionDomain) return;
                  const selected = customActionDomain;
                  setCustomActionDomain(null);
                  void openCustomSelector(selected, 'delete');
                }}
              >
                <AppText style={{ color: palette.error }}>{t('settings.deleteCustomProfileAction')}</AppText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={customImportVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCustomImportModal}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
          onPress={closeCustomImportModal}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="bodyBold" style={styles.modalTitle}>
              {t('settings.addCustomCookie')}
            </AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('settings.customDomainOptionalHint')}
            </AppText>
            <Input
              placeholder={t('settings.customDomainPlaceholder')}
              value={customImportDomain}
              onChangeText={setCustomImportDomain}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActionsRow}>
              <Pressable
                style={[styles.modalAction, styles.modalActionHalf, { borderColor: palette.border }]}
                onPress={closeCustomImportModal}
              >
                <AppText>{t('common.cancel')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, styles.modalActionHalf, { borderColor: palette.border }]}
                onPress={() => {
                  void handleImportCustomCookie();
                }}
                disabled={customImportSubmitting}
              >
                <AppText>{t('settings.importCustomCookieAction')}</AppText>
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

      <Modal
        visible={Boolean(customSelectorDomain && customSelectorMode)}
        transparent
        animationType="fade"
        onRequestClose={closeCustomSelector}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
          onPress={closeCustomSelector}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="bodyBold" style={styles.modalTitle}>
              {customSelectorDomain && customSelectorMode === 'default'
                ? t('settings.selectDefaultForDomain', { domain: customSelectorDomain })
                : customSelectorDomain
                  ? t('settings.selectDeleteProfileForDomain', { domain: customSelectorDomain })
                  : ''}
            </AppText>
            <ScrollView style={styles.selectorList}>
              {customSelectorProfiles.map((profile) => (
                <Pressable
                  key={`${profile.profileId}-${profile.profileName}`}
                  style={[styles.modalAction, { borderColor: palette.border }]}
                  onPress={() => {
                    void handleCustomSelectorSelect(profile.profileName);
                  }}
                >
                  <AppText style={customSelectorMode === 'delete' ? { color: palette.error } : undefined}>
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

      <ConfirmModal
        visible={Boolean(pendingCustomDelete)}
        title={t('settings.deleteCustomProfileConfirmTitle')}
        body={t('settings.deleteCustomProfileConfirmMessage', { profile: pendingCustomDelete?.profileName ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPendingCustomDelete(null)}
        onConfirm={() => {
          void handleDeleteCustomProfile();
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
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
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
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modalActionHalf: {
    flex: 1,
    alignItems: 'center',
  },
  selectorList: {
    maxHeight: 260,
  },
});
