import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useSearch } from '@/src/features/search/hooks/useSearch';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { FloatingSearchControls } from '@/src/shared/components/ui/FloatingSearchControls';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { useFloatingSearchControls } from '@/src/shared/hooks/useFloatingSearchControls';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import {
  clampSearchQueryDraft,
  normalizeSearchQuery,
  SEARCH_MAX_QUERY_CHARS,
} from '@/src/shared/utils/inputLimits';

const GRID_COLUMNS = 2;
const LIST_INITIAL_RENDER_COUNT = 12;
const LIST_BATCH_RENDER_COUNT = 8;
const LIST_WINDOW_SIZE = 5;
const LIST_BATCH_UPDATE_MS = 40;
const DEFAULT_CONTROLS_HEIGHT = 128;

export function ExploreScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'popular'>('relevance');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
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

  const handleQueryChange = useCallback((text: string) => {
    setQuery(clampSearchQueryDraft(text));
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    expandControls();
  }, [expandControls, isFocused]);

  const debouncedQuery = useDebounce(query, 300);
  const normalizedQuery = useMemo(() => normalizeSearchQuery(debouncedQuery), [debouncedQuery]);
  const isSearching = normalizedQuery.length > 0;

  const {
    data: searchData,
    fetchNextPage: fetchNextSearch,
    hasNextPage: hasNextSearch,
    isFetchingNextPage: isFetchingSearch,
    isLoading: isLoadingSearch,
  } = useSearch(normalizedQuery, sort);

  const videos = useMemo(
    () => (isSearching ? searchData?.pages.flatMap((page) => page) ?? [] : []),
    [isSearching, searchData]
  );
  const isLoading = isSearching ? isLoadingSearch : false;
  const isFetchingNextPage = isSearching ? isFetchingSearch : false;
  const hasNextPage = isSearching ? hasNextSearch : false;

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [selectedVideoId, videos]
  );

  useEffect(() => {
    if (!selectedVideoId) return;
    const stillExists = videos.some((item) => item.id === selectedVideoId);
    if (!stillExists) {
      setSelectedVideoId(null);
    }
  }, [selectedVideoId, videos]);

  const listTopInset = controlsHeight + layoutConfig.list.headerBottomMargin;

  const collapsedTriggerLabel = isSearching
    ? t('search.resultsForCompact', { query: normalizedQuery })
    : t('search.openControls');

  const expandedControls = (
    <View style={styles.controlsWrap}>
      <View style={styles.controlsCard}>
        <Input
          ref={searchInputRef}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          maxLength={SEARCH_MAX_QUERY_CHARS}
          onFocus={onControlsInputFocus}
          onBlur={onControlsInputBlur}
        />
        <SegmentedControl
          value={sort}
          onChange={(value) => setSort(value as 'relevance' | 'recent' | 'popular')}
          options={[
            { label: t('search.sortRelevance'), value: 'relevance' },
            { label: t('search.sortRecent'), value: 'recent' },
            { label: t('search.sortPopular'), value: 'popular' },
          ]}
        />
        <View style={styles.metaRow}>
          <View style={styles.metaLabelWrap}>
            <AppText variant="caption" style={styles.metaLabel}>
              {isSearching ? t('search.resultsFor', { query: normalizedQuery }) : t('search.hint')}
            </AppText>
            <AppText variant="caption" style={styles.metaCount}>
              {isSearching ? t('profile.resultCount', { count: videos.length }) : ''}
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
      </View>
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
      accessibilityLabel={t('search.openControlsA11y')}
    >
      <Ionicons name="search" size={16} color={palette.text.primary} />
      <AppText numberOfLines={1} style={styles.collapsedTriggerText}>
        {collapsedTriggerLabel}
      </AppText>
    </Pressable>
  );

  const renderGridItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => {
      const isAnonymous = !item.uploader;

      return (
        <View style={styles.gridCell}>
          <Pressable
            onPress={() => {
              setSelectedVideoId(item.id);
            }}
            style={({ pressed }) => [
              styles.gridTile,
              {
                backgroundColor: withAlpha(palette.overlay, 0.82),
                borderColor: withAlpha(palette.border, 0.72),
              },
              pressed ? styles.pressedAction : null,
            ]}
          >
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={styles.gridThumb}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            ) : null}
            <View style={styles.gridMedia}>
              <Ionicons name="play-circle-outline" size={42} color={withAlpha('#FFFFFF', 0.94)} />
            </View>
          </Pressable>
          <View
            style={[
              styles.gridMetaCard,
              {
                borderColor: withAlpha(palette.border, 0.75),
                backgroundColor: withAlpha(palette.surface, 0.9),
              },
            ]}
          >
            <AppText variant="caption" style={styles.gridMetaTitle} numberOfLines={1}>
              {item.title?.trim() || t('video.untitled')}
            </AppText>
            {item.is_nsfw ? (
              <View
                style={[
                  styles.gridNsfwBadge,
                  {
                    borderColor: withAlpha(palette.warning, 0.82),
                    backgroundColor: withAlpha(palette.warning, 0.14),
                  },
                ]}
              >
                <AppText variant="caption" style={{ color: palette.warning }}>
                  {t('video.nsfw')}
                </AppText>
              </View>
            ) : null}
            {isAnonymous ? (
              <View
                style={[
                  styles.gridAnonymousBadge,
                  {
                    borderColor: withAlpha(palette.border, 0.85),
                    backgroundColor: withAlpha(palette.overlay, 0.9),
                  },
                ]}
              >
                <AppText variant="caption" style={styles.gridAnonymousText}>
                  {t('video.anonymous')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [palette.border, palette.overlay, palette.surface, palette.warning, t]
  );

  const renderModalCloseAction = useCallback(() => {
    return (
      <Pressable
        onPress={() => setSelectedVideoId(null)}
        style={({ pressed }) => [
          styles.inlineCloseAction,
          {
            borderColor: withAlpha(palette.border, 0.85),
            backgroundColor: withAlpha(palette.overlay, 0.9),
          },
          pressed ? styles.pressedAction : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Ionicons name="close" size={20} color={palette.text.primary} />
      </Pressable>
    );
  }, [palette.border, palette.overlay, palette.text.primary, t]);

  const handleEndReached = useCallback(() => {
    if (!isSearching) return;
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextSearch();
    }
  }, [fetchNextSearch, hasNextPage, isFetchingNextPage, isSearching]);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onControlsScroll(event);
    },
    [onControlsScroll]
  );

  const handleListTouchStart = useCallback(() => {
    if (searchInputRef.current?.isFocused()) {
      searchInputRef.current.blur();
    }
  }, []);

  const isEmpty = !isLoading && videos.length === 0;

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
            data={videos}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            numColumns={GRID_COLUMNS}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.65}
            onScroll={handleListScroll}
            onTouchStart={handleListTouchStart}
            onScrollBeginDrag={onControlsScrollBeginDrag}
            onScrollEndDrag={onControlsScrollEndDrag}
            onMomentumScrollBegin={onControlsMomentumBegin}
            onMomentumScrollEnd={onControlsMomentumEnd}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={LIST_INITIAL_RENDER_COUNT}
            maxToRenderPerBatch={LIST_BATCH_RENDER_COUNT}
            windowSize={LIST_WINDOW_SIZE}
            updateCellsBatchingPeriod={LIST_BATCH_UPDATE_MS}
            ListEmptyComponent={
              isLoading ? null : (
                <View style={styles.empty}>
                  <AppText>{isSearching ? t('search.empty') : t('search.hint')}</AppText>
                </View>
              )
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: listTopInset },
              isEmpty ? styles.listEmptyContainer : null,
            ]}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(selectedVideo)}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedVideoId(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: withAlpha('#000000', 0.86) }]}>
          <View style={styles.modalContent}>
            {selectedVideo ? (
              <VideoCard
                video={selectedVideo}
                isActive={isFocused}
                isScreenActive={isFocused}
                renderFarRightAction={renderModalCloseAction}
              />
            ) : null}
          </View>
        </View>
      </Modal>
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
  gridCell: {
    width: `${100 / GRID_COLUMNS}%`,
    padding: 4,
  },
  gridTile: {
    aspectRatio: 1,
    borderWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  gridThumb: {
    ...StyleSheet.absoluteFillObject,
  },
  gridMedia: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridMetaCard: {
    marginTop: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  gridMetaTitle: {
    fontSize: 12,
    lineHeight: 15,
  },
  gridNsfwBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  gridAnonymousBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  gridAnonymousText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  inlineCloseAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedAction: {
    transform: [{ scale: 0.98 }],
  },
});
