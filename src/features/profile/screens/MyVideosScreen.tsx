import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import {
  EditVideoMetadataModal,
  EditVideoMetadataValues,
} from '@/src/features/profile/components/EditVideoMetadataModal';
import { retryVideoProcessing } from '@/src/features/profile/api/profileApi';
import { useDeleteVideo } from '@/src/features/profile/hooks/useDeleteVideo';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { useUpdateVideoMetadata } from '@/src/features/profile/hooks/useUpdateVideoMetadata';
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
  clampUtf8Bytes,
  clampSearchQueryDraft,
  normalizeSearchQuery,
  SEARCH_MAX_QUERY_CHARS,
  VIDEO_DESCRIPTION_MAX_BYTES,
  VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';
import { useToastStore } from '@/src/store/toastStore';

const GRID_COLUMNS = 2;
const LIST_INITIAL_RENDER_COUNT = 12;
const LIST_BATCH_RENDER_COUNT = 8;
const LIST_WINDOW_SIZE = 5;
const LIST_BATCH_UPDATE_MS = 40;
const DEFAULT_CONTROLS_HEIGHT = 138;

function isPlayableVideo(item: MyVideoItem) {
  return item.status === 'PUBLISHED' && typeof item.url === 'string' && item.url.length > 0;
}

function getVideoStatusMeta(
  item: MyVideoItem,
  t: (key: string) => string
): {
  icon: keyof typeof Ionicons.glyphMap;
  statusText: string;
  failureDetail: string | null;
} {
  const icon: keyof typeof Ionicons.glyphMap =
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

  return {
    icon,
    statusText,
    failureDetail: item.processing_error_message ?? item.processing_error_code ?? null,
  };
}

function toFeedItem(item: MyVideoItem): VideoFeedItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url ?? '',
    like_count: item.like_count,
    created_at: item.created_at,
    is_liked: Boolean(item.is_liked),
    is_nsfw: item.is_nsfw === false ? false : true,
    uploader: item.uploader ?? null,
    thumbnail_url: item.thumbnail_url ?? null,
  };
}

export function MyVideosScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteVideo();
  const updateMetadataMutation = useUpdateVideoMetadata();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyVideos();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'date_desc' | 'title_asc'>('date_desc');
  const [controlsHeight, setControlsHeight] = useState(DEFAULT_CONTROLS_HEIGHT);

  const searchInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<MyVideoItem>>(null);
  const browseOffsetRef = useRef(0);
  const wasSearchingRef = useRef(false);
  const loggedThumbnailTileIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!__DEV__) return;

    displayVideos.slice(0, 2).forEach((video, index) => {
      if (loggedThumbnailTileIdsRef.current.has(video.id)) return;
      loggedThumbnailTileIdsRef.current.add(video.id);
      if (loggedThumbnailTileIdsRef.current.size > 80) {
        loggedThumbnailTileIdsRef.current.clear();
      }

      console.debug('[myVideos.thumb] tile thumbnail source', {
        tile: index + 1,
        videoId: video.id,
        status: video.status,
        source: video.thumbnail_source ?? 'unknown',
        receivedFromBackend: video.thumbnail_source === 'backend',
        derivedFallback: Boolean(video.thumbnail_source && video.thumbnail_source !== 'backend'),
        hasThumbnailUrl: Boolean(video.thumbnail_url),
      });
    });
  }, [displayVideos]);

  useEffect(() => {
    if (!selectedVideoId) return;
    const stillExists = displayVideos.some((item) => item.id === selectedVideoId);
    if (!stillExists) {
      setSelectedVideoId(null);
    }
  }, [displayVideos, selectedVideoId]);

  useEffect(() => {
    if (!editingVideoId) return;
    const stillExists = displayVideos.some((item) => item.id === editingVideoId);
    if (!stillExists) {
      setEditingVideoId(null);
    }
  }, [displayVideos, editingVideoId]);

  useEffect(() => {
    const wasSearching = wasSearchingRef.current;
    if (wasSearching && !isSearching) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: browseOffsetRef.current, animated: false });
      });
    }
    wasSearchingRef.current = isSearching;
  }, [isSearching]);

  const selectedVideo = useMemo(
    () => displayVideos.find((item) => item.id === selectedVideoId) ?? null,
    [displayVideos, selectedVideoId]
  );
  const editingVideo = useMemo(
    () => displayVideos.find((item) => item.id === editingVideoId) ?? null,
    [displayVideos, editingVideoId]
  );

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

  const handleEndReached = useCallback(() => {
    if (isSearching) return;
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isSearching]);

  const handleRequestDelete = useCallback(
    (videoId: string) => {
      if (deleteMutation.isPending) return;
      setPendingDeleteId(videoId);
    },
    [deleteMutation.isPending]
  );

  const handleOpenEdit = useCallback((videoId: string) => {
    setEditingVideoId(videoId);
  }, []);

  const handleSaveMetadata = useCallback(
    (values: EditVideoMetadataValues) => {
      if (!editingVideo) return;

      const nextTitle = clampUtf8Bytes(values.title ?? '', VIDEO_TITLE_MAX_BYTES);
      const nextDescription = clampUtf8Bytes(values.description ?? '', VIDEO_DESCRIPTION_MAX_BYTES);
      const nextIsAnonymous = Boolean(values.isAnonymous);
      const nextIsNsfw = Boolean(values.isNsfw);

      const originalTitle = editingVideo.title ?? '';
      const originalDescription = editingVideo.description ?? '';
      const originalIsAnonymous = Boolean(editingVideo.is_anonymous);
      const originalIsNsfw = editingVideo.is_nsfw === false ? false : true;

      const payload: {
        title?: string;
        description?: string;
        is_anonymous?: boolean;
        is_nsfw?: boolean;
      } = {};
      const changedFields: ('title' | 'description' | 'is_anonymous' | 'is_nsfw')[] = [];

      if (nextTitle !== originalTitle) {
        payload.title = nextTitle;
        changedFields.push('title');
      }

      if (nextDescription !== originalDescription) {
        payload.description = nextDescription;
        changedFields.push('description');
      }

      if (nextIsAnonymous !== originalIsAnonymous) {
        payload.is_anonymous = nextIsAnonymous;
        changedFields.push('is_anonymous');
      }

      if (nextIsNsfw !== originalIsNsfw) {
        payload.is_nsfw = nextIsNsfw;
        changedFields.push('is_nsfw');
      }

      if (changedFields.length === 0) {
        setEditingVideoId(null);
        return;
      }

      updateMetadataMutation.mutate(
        {
          videoId: editingVideo.id,
          payload,
          changedFields,
        },
        {
          onSuccess: () => {
            setEditingVideoId(null);
          },
        }
      );
    },
    [editingVideo, updateMetadataMutation]
  );

  const renderDeleteAction = useCallback(
    (videoId: string) => {
      const isDeletingThisVideo = deleteMutation.isPending && deleteMutation.variables === videoId;

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

  const renderEditAction = useCallback(
    (videoId: string) => {
      const isBusy = updateMetadataMutation.isPending || deleteMutation.isPending;
      const isEditingThisVideo = editingVideoId === videoId && updateMetadataMutation.isPending;

      return (
        <Pressable
          onPress={() => handleOpenEdit(videoId)}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.editAction,
            {
              borderColor: withAlpha(palette.accent, 0.45),
              backgroundColor: withAlpha(palette.accent, 0.15),
              opacity: isBusy && !isEditingThisVideo ? 0.55 : 1,
            },
            pressed && !isBusy ? styles.pressedAction : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editMetadataAction')}
        >
          <Ionicons
            name={isEditingThisVideo ? 'time-outline' : 'create-outline'}
            size={20}
            color={palette.accent}
          />
        </Pressable>
      );
    },
    [
      deleteMutation.isPending,
      editingVideoId,
      handleOpenEdit,
      palette.accent,
      t,
      updateMetadataMutation.isPending,
    ]
  );

  const renderCardExtraActions = useCallback(
    (videoId: string) => (
      <>
        {renderEditAction(videoId)}
        {renderDeleteAction(videoId)}
      </>
    ),
    [renderDeleteAction, renderEditAction]
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

  const collapsedTriggerLabel = isSearching
    ? t('profile.searchResultsForCompact', { query: debouncedQuery.trim() })
    : t('profile.searchOpenControls');

  const listTopInset = controlsHeight + layoutConfig.list.headerBottomMargin;

  const expandedControls = (
    <View style={styles.controlsWrap}>
      <View style={styles.controlsCard}>
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
      accessibilityLabel={t('profile.searchOpenControlsA11y')}
    >
      <Ionicons name="search" size={16} color={palette.text.primary} />
      <AppText numberOfLines={1} style={styles.collapsedTriggerText}>
        {collapsedTriggerLabel}
      </AppText>
    </Pressable>
  );

  const renderGridItem = useCallback(
    ({ item }: { item: MyVideoItem }) => {
      const playable = isPlayableVideo(item);
      const statusMeta = getVideoStatusMeta(item, t);
      const statusColor = item.status === 'FAILED' ? palette.error : palette.text.secondary;

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
            {playable && item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={styles.gridThumb}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            ) : null}
            <View style={styles.gridMedia}>
              <Ionicons
                name={playable ? 'play-circle-outline' : statusMeta.icon}
                size={playable ? 42 : 34}
                color={playable ? withAlpha('#FFFFFF', 0.94) : statusColor}
              />
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
            {(item.is_nsfw === false ? false : true) || item.is_anonymous ? (
              <View style={styles.gridBadgesRow}>
                {(item.is_nsfw === false ? false : true) ? (
                  <View
                    style={[
                      styles.gridMetaBadge,
                      {
                        borderColor: withAlpha(palette.warning, 0.82),
                        backgroundColor: withAlpha(palette.warning, 0.14),
                      },
                    ]}
                  >
                    <AppText variant="caption" style={[styles.gridMetaBadgeText, { color: palette.warning }]}>
                      {t('video.nsfw')}
                    </AppText>
                  </View>
                ) : null}
                {item.is_anonymous ? (
                  <View
                    style={[
                      styles.gridMetaBadge,
                      {
                        borderColor: withAlpha(palette.border, 0.85),
                        backgroundColor: withAlpha(palette.overlay, 0.9),
                      },
                    ]}
                  >
                    <AppText variant="caption" style={[styles.gridMetaBadgeText, { color: '#FFFFFF' }]}>
                      {t('video.anonymous')}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [palette.border, palette.error, palette.overlay, palette.surface, palette.text.secondary, palette.warning, t]
  );

  const renderSelectedContent = useMemo(() => {
    if (!selectedVideo) return null;

    if (isPlayableVideo(selectedVideo)) {
      return (
        <VideoCard
          video={toFeedItem(selectedVideo)}
          isActive={isFocused}
          isScreenActive={isFocused}
          showUploader={false}
          showAnonymousBadge={selectedVideo.is_anonymous}
          renderExtraAction={renderCardExtraActions}
          renderFarRightAction={renderModalCloseAction}
        />
      );
    }

    const statusMeta = getVideoStatusMeta(selectedVideo, t);

    return (
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusTitleRow}>
            <AppText variant="bodyBold" style={styles.statusTitleText}>
              {selectedVideo.title ?? t('video.untitled')}
            </AppText>
          </View>
          <Ionicons
            name={statusMeta.icon}
            size={18}
            color={selectedVideo.status === 'FAILED' ? palette.error : palette.text.secondary}
          />
        </View>
        <AppText variant="caption">{formatDate(selectedVideo.created_at)}</AppText>
        {selectedVideo.is_anonymous || (selectedVideo.is_nsfw === false ? false : true) ? (
          <View style={styles.statusBadgesRow}>
            {selectedVideo.is_anonymous ? (
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
            {(selectedVideo.is_nsfw === false ? false : true) ? (
              <View
                style={[
                  styles.nsfwBadge,
                  {
                    borderColor: withAlpha(palette.warning, 0.82),
                    backgroundColor: withAlpha(palette.warning, 0.14),
                  },
                ]}
              >
                <AppText variant="caption" style={[styles.anonymousBadgeText, { color: palette.warning }]}>
                  {t('video.nsfw')}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        <AppText variant="caption" style={styles.statusText}>
          {statusMeta.statusText}
        </AppText>
        {statusMeta.failureDetail ? (
          <AppText variant="caption" style={[styles.statusText, { color: palette.error }]}> 
            {statusMeta.failureDetail}
          </AppText>
        ) : null}
        {selectedVideo.status === 'FAILED' ? (
          <Button
            label={
              retryMutation.isPending && retryMutation.variables === selectedVideo.id
                ? t('profile.retrying')
                : t('common.retry')
            }
            variant="outline"
            onPress={() => retryMutation.mutate(selectedVideo.id)}
            disabled={retryMutation.isPending && retryMutation.variables === selectedVideo.id}
            style={styles.retryButton}
          />
        ) : null}
        <View style={styles.statusActionsRow}>
          <View style={styles.statusActionsLeft}>
            {renderEditAction(selectedVideo.id)}
            {renderDeleteAction(selectedVideo.id)}
          </View>
          {renderModalCloseAction()}
        </View>
      </Card>
    );
  }, [
    renderCardExtraActions,
    isFocused,
    palette.background,
    palette.border,
    palette.error,
    palette.text.secondary,
    palette.warning,
    renderDeleteAction,
    renderEditAction,
    renderModalCloseAction,
    retryMutation,
    selectedVideo,
    t,
  ]);

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

      <Modal
        visible={Boolean(selectedVideo)}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedVideoId(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: withAlpha('#000000', 0.86) }]}>
          <View style={styles.modalContent}>
            {renderSelectedContent}
          </View>
        </View>
      </Modal>

      <EditVideoMetadataModal
        visible={Boolean(editingVideo)}
        title={editingVideo?.title ?? ''}
        description={editingVideo?.description ?? ''}
        isAnonymous={Boolean(editingVideo?.is_anonymous)}
        isNsfw={editingVideo?.is_nsfw === false ? false : true}
        isSaving={updateMetadataMutation.isPending}
        onCancel={() => {
          if (updateMetadataMutation.isPending) return;
          setEditingVideoId(null);
        }}
        onSave={handleSaveMetadata}
      />

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
          if (selectedVideoId === targetVideoId) {
            setSelectedVideoId(null);
          }
          if (editingVideoId === targetVideoId) {
            setEditingVideoId(null);
          }
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
  gridBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  gridMetaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  gridMetaBadgeText: {
    fontSize: 10,
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
  statusCard: {
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusTitleText: {
    flexShrink: 1,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  anonymousBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  anonymousBadgeText: {
    fontSize: 11,
  },
  nsfwBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    opacity: 0.85,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  deleteAction: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAction: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusActionsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
