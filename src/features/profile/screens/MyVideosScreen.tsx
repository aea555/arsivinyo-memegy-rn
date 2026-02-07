import { useIsFocused } from '@react-navigation/native';
import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { retryVideoProcessing } from '@/src/features/profile/api/profileApi';
import { useDeleteVideo } from '@/src/features/profile/hooks/useDeleteVideo';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { FloatingSearchControls } from '@/src/shared/components/ui/FloatingSearchControls';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { useFloatingSearchControls } from '@/src/shared/hooks/useFloatingSearchControls';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { MyVideoItem, VideoFeedItem } from '@/src/shared/types/api';
import { extractApiErrorMessage } from '@/src/shared/utils/errorParser';
import { formatDate } from '@/src/shared/utils/formatters';
import {
  clampSearchQueryDraft,
  normalizeSearchQuery,
  SEARCH_MAX_QUERY_CHARS,
} from '@/src/shared/utils/inputLimits';
import { useToastStore } from '@/src/store/toastStore';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};
const LIST_INITIAL_RENDER_COUNT = 3;
const LIST_BATCH_RENDER_COUNT = 3;
const LIST_WINDOW_SIZE = 4;
const LIST_BATCH_UPDATE_MS = 32;
const DEFAULT_CONTROLS_HEIGHT = 138;

export function MyVideosScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteVideo();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyVideos();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'date_desc' | 'title_asc'>('date_desc');
  const [controlsHeight, setControlsHeight] = useState(DEFAULT_CONTROLS_HEIGHT);
  const searchInputRef = useRef<TextInput>(null);
  const {
    mode: controlsMode,
    onScroll: onControlsScroll,
    onScrollBeginDrag: onControlsScrollBeginDrag,
    onScrollEndDrag: onControlsScrollEndDrag,
    onMomentumScrollBegin: onControlsMomentumBegin,
    onMomentumScrollEnd: onControlsMomentumEnd,
    onInputFocus: onControlsInputFocus,
    onInputBlur: onControlsInputBlur,
    expand: expandControls,
    expandedAnimatedStyle,
    collapsedAnimatedStyle,
  } = useFloatingSearchControls();
  const listRef = useRef<FlatList<MyVideoItem>>(null);
  const browseOffsetRef = useRef(0);
  const wasSearchingRef = useRef(false);
  const debouncedQuery = useDebounce(query, 200);
  const handleQueryChange = useCallback((text: string) => {
    setQuery(clampSearchQueryDraft(text));
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    expandControls();
  }, [expandControls, isFocused]);
  const normalizedQuery = useMemo(
    () => normalizeSearchQuery(debouncedQuery).toLocaleLowerCase(),
    [debouncedQuery]
  );
  const isSearching = normalizedQuery.length > 0;

  const retryMutation = useMutation({
    mutationFn: async (videoId: string) => retryVideoProcessing(videoId),
    onMutate: async (videoId: string) => {
      await queryClient.cancelQueries({ queryKey: ['myVideos'] });
      const previous = queryClient.getQueryData<InfiniteData<MyVideoItem[]>>(['myVideos']);

      queryClient.setQueryData<InfiniteData<MyVideoItem[]>>(['myVideos'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((item) =>
              item.id === videoId
                ? {
                    ...item,
                    status: 'PROCESSING',
                    updated_at: new Date().toISOString(),
                    processing_error_code: null,
                    processing_error_message: null,
                  }
                : item
            )
          ),
        };
      });

      return { previous };
    },
    onSuccess: () => {
      showToast(t('profile.retryStarted'), 'success');
    },
    onError: (_error, _videoId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['myVideos'], context.previous);
      }
      const backendMessage = extractApiErrorMessage(_error);
      showToast(backendMessage ?? t('profile.retryFailed'), 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['myVideos'] });
    },
  });

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);
  const indexedVideos = useMemo(
    () =>
      videos.map((item) => {
        const title = (item.title ?? '').toLocaleLowerCase();
        const description = (item.description ?? '').toLocaleLowerCase();
        return {
          item,
          searchText: `${title} ${description}`.trim(),
        };
      }),
    [videos]
  );

  const displayVideos = useMemo(() => {
    const filtered = !isSearching
      ? indexedVideos.map((entry) => entry.item)
      : indexedVideos
        .filter((entry) => entry.searchText.includes(normalizedQuery))
        .map((entry) => entry.item);

    const sorted = [...filtered];
    if (sortMode === 'title_asc') {
      sorted.sort((a, b) => {
        const titleA = (a.title ?? t('video.untitled')).trim();
        const titleB = (b.title ?? t('video.untitled')).trim();
        return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
      });
      return sorted;
    }

    sorted.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return sorted;
  }, [indexedVideos, isSearching, normalizedQuery, sortMode, t]);

  const isPlayable = useCallback(
    (item: MyVideoItem) => item.status === 'PUBLISHED' && typeof item.url === 'string' && item.url.length > 0,
    []
  );

  const toFeedItem = useCallback(
    (item: MyVideoItem): VideoFeedItem => ({
      id: item.id,
      title: item.title,
      description: item.description,
      url: item.url as string,
      like_count: item.like_count,
      created_at: item.created_at,
      is_liked: item.is_liked,
      uploader: item.uploader,
    }),
    []
  );

  const handleRequestDelete = useCallback(
    (videoId: string) => {
      if (deleteMutation.isPending) return;
      setPendingDeleteId(videoId);
    },
    [deleteMutation.isPending]
  );

  const renderDeleteAction = useCallback(
    (videoId: string) => {
      const isDeletingThisVideo =
        deleteMutation.isPending && deleteMutation.variables === videoId;

      return (
        <Pressable
          onPress={() => handleRequestDelete(videoId)}
          disabled={deleteMutation.isPending}
          style={({ pressed }) => [
            styles.deleteAction,
            {
              borderColor: withAlpha(palette.error, 0.52),
              backgroundColor: withAlpha(palette.error, 0.13),
              opacity: deleteMutation.isPending && !isDeletingThisVideo ? 0.55 : 1,
            },
            pressed && !deleteMutation.isPending ? styles.pressedAction : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons
            name={isDeletingThisVideo ? 'time-outline' : 'trash-outline'}
            size={20}
            color={palette.error}
          />
        </Pressable>
      );
    },
    [
      deleteMutation.isPending,
      deleteMutation.variables,
      handleRequestDelete,
      palette.error,
      t,
    ]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const firstPlayable = viewableItems
        .map((token) => token.item as MyVideoItem | undefined)
        .find((item) => item && isPlayable(item));
      if (!firstPlayable) return;
      setActiveId((prev) => (prev === firstPlayable.id ? prev : firstPlayable.id));
    }
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: MyVideoItem }) => {
      if (isPlayable(item)) {
        return (
          <VideoCard
            video={toFeedItem(item)}
            isActive={activeId === item.id}
            isScreenActive={isFocused}
            showUploader={false}
            showAnonymousBadge={item.is_anonymous}
            renderExtraAction={renderDeleteAction}
          />
        );
      }

      const statusIcon: keyof typeof Ionicons.glyphMap =
        item.status === 'DRAFT'
          ? 'document-text-outline'
          : item.status === 'PROCESSING'
            ? 'time-outline'
            : item.status === 'FAILED'
              ? 'alert-circle-outline'
              : 'videocam-off-outline';

      const statusText =
        item.status === 'DRAFT'
          ? t('profile.videoStatusDraft')
          : item.status === 'PROCESSING'
            ? t('profile.videoStatusProcessing')
            : item.status === 'FAILED'
              ? t('profile.videoStatusFailed')
              : t('profile.videoStatusUnavailable');
      const failureDetail = item.processing_error_message ?? item.processing_error_code;

      return (
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleRow}>
              <AppText variant="bodyBold" style={styles.statusTitleText}>
                {item.title ?? t('video.untitled')}
              </AppText>
            </View>
            <Ionicons name={statusIcon} size={18} color={item.status === 'FAILED' ? palette.error : palette.text.secondary} />
          </View>
          <AppText variant="caption">{formatDate(item.created_at)}</AppText>
          {item.is_anonymous ? (
            <View
              style={[
                styles.anonymousBadge,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                },
              ]}
            >
              <AppText variant="caption" style={styles.anonymousBadgeText}>
                {t('video.anonymous')}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" style={styles.statusText}>
            {statusText}
          </AppText>
          {item.status === 'FAILED' && failureDetail ? (
            <AppText variant="caption" style={[styles.statusText, { color: palette.error }]}>
              {failureDetail}
            </AppText>
          ) : null}
          {item.status === 'FAILED' ? (
            <Button
              label={
                retryMutation.isPending && retryMutation.variables === item.id
                  ? t('profile.retrying')
                  : t('common.retry')
              }
              variant="outline"
              onPress={() => retryMutation.mutate(item.id)}
              disabled={retryMutation.isPending && retryMutation.variables === item.id}
              style={styles.retryButton}
            />
          ) : null}
          {renderDeleteAction(item.id)}
        </Card>
      );
    },
    [
      activeId,
      isFocused,
      isPlayable,
      palette.background,
      palette.border,
      palette.error,
      palette.text.secondary,
      retryMutation,
      renderDeleteAction,
      t,
      toFeedItem,
    ]
  );

  useEffect(() => {
    if (!isFocused) {
      setActiveId(null);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!activeId) return;
    const exists = displayVideos.some((item) => item.id === activeId);
    if (!exists) {
      setActiveId(null);
    }
  }, [activeId, displayVideos]);

  useEffect(() => {
    const wasSearching = wasSearchingRef.current;
    if (wasSearching && !isSearching) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: browseOffsetRef.current, animated: false });
      });
    }
    wasSearchingRef.current = isSearching;
  }, [isSearching]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isSearching) return;
      browseOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    [isSearching]
  );
  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onControlsScroll(event);
      handleScroll(event);
    },
    [handleScroll, onControlsScroll]
  );
  const handleListTouchStart = useCallback(() => {
    if (searchInputRef.current?.isFocused()) {
      searchInputRef.current.blur();
    }
  }, []);

  const handleEndReached = () => {
    if (isSearching) return;
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const collapsedTriggerLabel = isSearching
    ? t('profile.searchResultsForCompact', { query: debouncedQuery.trim() })
    : t('profile.searchOpenControls');

  const listTopInset = controlsHeight + layoutConfig.list.headerBottomMargin;

  const expandedControls = (
    <View style={styles.controlsWrap}>
      <Card style={styles.controlsCard}>
        <Input
          ref={searchInputRef}
          placeholder={t('profile.searchPlaceholder')}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          returnKeyType="search"
          maxLength={SEARCH_MAX_QUERY_CHARS}
          onFocus={onControlsInputFocus}
          onBlur={onControlsInputBlur}
        />
        <SegmentedControl
          value={sortMode}
          onChange={(value) => setSortMode(value as 'date_desc' | 'title_asc')}
          options={[
            { label: t('profile.sortDate'), value: 'date_desc' },
            { label: t('profile.sortAlphabetical'), value: 'title_asc' },
          ]}
        />
        <View style={styles.metaRow}>
          <View style={styles.metaLabelWrap}>
            <AppText variant="caption" style={styles.metaLabel}>
              {isSearching
                ? t('profile.searchResultsFor', { query: debouncedQuery.trim() })
                : t('profile.allUploads')}
            </AppText>
            <AppText variant="caption" style={styles.metaCount}>
              {t('profile.resultCount', { count: displayVideos.length })}
            </AppText>
          </View>
          {isSearching ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <AppText variant="caption" style={[styles.clearSearch, { color: palette.accent }]}>
                {t('profile.searchClear')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </View>
  );

  const collapsedControls = (
    <Pressable
      onPress={() => {
        expandControls();
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }}
      style={({ pressed }) => [
        styles.collapsedTrigger,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        pressed ? styles.pressedAction : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('profile.searchOpenControlsA11y')}
    >
      <Ionicons name="search" size={16} color={palette.text.primary} />
      <AppText numberOfLines={1} style={styles.collapsedTriggerText}>
        {collapsedTriggerLabel}
      </AppText>
    </Pressable>
  );

  return (
    <Screen contentStyle={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.listHost}>
          <FloatingSearchControls
            mode={controlsMode}
            expandedContent={expandedControls}
            collapsedContent={collapsedControls}
            expandedAnimatedStyle={expandedAnimatedStyle}
            collapsedAnimatedStyle={collapsedAnimatedStyle}
            onMeasureHeight={(nextHeight) => {
              if (nextHeight !== controlsHeight) {
                setControlsHeight(nextHeight);
              }
            }}
            containerStyle={styles.controlsOverlay}
          />
        <FlatList
          ref={listRef}
          data={displayVideos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onScroll={handleListScroll}
          onTouchStart={handleListTouchStart}
          onScrollBeginDrag={onControlsScrollBeginDrag}
          onScrollEndDrag={onControlsScrollEndDrag}
          onMomentumScrollBegin={onControlsMomentumBegin}
          onMomentumScrollEnd={onControlsMomentumEnd}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={LIST_INITIAL_RENDER_COUNT}
          maxToRenderPerBatch={LIST_BATCH_RENDER_COUNT}
          windowSize={LIST_WINDOW_SIZE}
          updateCellsBatchingPeriod={LIST_BATCH_UPDATE_MS}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <AppText>{isSearching ? t('profile.searchNoResults') : t('profile.noVideos')}</AppText>
              </View>
            )
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: listTopInset },
            displayVideos.length === 0 ? styles.listEmptyContainer : null,
          ]}
        />
        </View>
      </KeyboardAvoidingView>
      <ConfirmModal
        visible={Boolean(pendingDeleteId)}
        title={t('profile.deleteVideoConfirmTitle')}
        body={t('profile.deleteVideoConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => {
          if (deleteMutation.isPending) return;
          setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (!pendingDeleteId || deleteMutation.isPending) return;
          const targetVideoId = pendingDeleteId;
          setPendingDeleteId(null);
          deleteMutation.mutate(targetVideoId);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: layoutConfig.list.headerGap,
  },
  keyboardContainer: {
    flex: 1,
    gap: layoutConfig.list.headerGap,
  },
  listHost: {
    flex: 1,
  },
  controlsOverlay: {
    left: 0,
    right: 0,
  },
  controlsWrap: {
    gap: layoutConfig.list.headerGap,
  },
  controlsCard: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 20,
  },
  metaLabelWrap: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    opacity: 0.8,
  },
  metaCount: {
    opacity: 0.65,
  },
  clearSearch: {
    fontSize: 12,
  },
  statusCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  statusTitleText: {
    flexShrink: 1,
  },
  anonymousBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  anonymousBadgeText: {
    fontSize: 11,
  },
  statusText: {
    opacity: 0.85,
  },
  retryButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  deleteAction: {
    height: 38,
    width: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pressedAction: {
    transform: [{ scale: 0.98 }],
  },
  collapsedTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  collapsedTriggerText: {
    maxWidth: 230,
    opacity: 0.9,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  listEmptyContainer: {
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
  },
});
