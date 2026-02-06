import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { deleteAccount } from '@/src/features/profile/api/profileApi';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { useAuthStore } from '@/src/store/authStore';
import { VideoFeedItem } from '@/src/shared/types/api';

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useMyVideos();
  const logout = useAuthStore((state) => state.logout);

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <VideoCard video={item} isActive={false} onPress={() => router.push(`/video/${item.id}`)} />
    ),
    [router]
  );

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteAccount();
          await logout();
        },
      },
    ]);
  };

  return (
    <Screen style={styles.container}>
      <AppText variant="heading2">{t('profile.title')}</AppText>
      <Card style={styles.profileCard}>
        <AppText variant="bodyBold">{profile?.username ?? 'User'}</AppText>
        <AppText variant="caption">{profile?.email ?? ''}</AppText>
      </Card>
      <View style={styles.actions}>
        <Button label={t('profile.settings')} onPress={() => router.push('/settings')} variant="secondary" />
        <Button label={t('profile.logout')} onPress={logout} variant="secondary" />
        <Button label={t('profile.deleteAccount')} onPress={handleDeleteAccount} variant="danger" />
      </View>
      <AppText variant="heading2" style={styles.sectionTitle}>
        {t('profile.myVideos')}
      </AppText>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  profileCard: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
});
