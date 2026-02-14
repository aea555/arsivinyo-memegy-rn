import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { DownloaderApiError } from '@/src/features/upload/api/downloaderApi';
import { saveVideoUriToLibrary } from '@/src/features/download/services/videoDownloadService';
import { pickVideo, uploadVideo } from '@/src/features/upload/hooks/useVideoUpload';
import { downloadFromClipboardToNormalizedAsset } from '@/src/features/upload/services/downloaderUploadBridge';
import { cleanupNormalizedVideoAsset, normalizePickedVideoAsset } from '@/src/features/upload/services/videoAssetNormalizer';
import { NormalizedVideoAsset, UploadValidationError } from '@/src/features/upload/types/uploadTypes';
import { ClipboardUrlError } from '@/src/features/upload/utils/clipboardDownloader';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { useShadows } from '@/src/shared/theme/shadows';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { extractApiErrorMessage } from '@/src/shared/utils/errorParser';
import { isDownloaderConfigured } from '@/src/shared/utils/env';
import {
  clampUtf8Bytes,
  UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES,
  UPLOAD_VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';
import { useToastStore } from '@/src/store/toastStore';

type UploadMode = 'manual' | 'clipboard';
type ClipboardUploadState =
  | 'idle'
  | 'starting'
  | 'polling'
  | 'fetching'
  | 'saving'
  | 'metadata'
  | 'uploading'
  | 'error';

type PreviewProps = {
  player: ReturnType<typeof useVideoPlayer>;
  isMuted: boolean;
  isPlaying: boolean;
  isLooping: boolean;
  isFullscreen?: boolean;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onToggleLoop: () => void;
};

const UploadVideoPreview = React.memo(function UploadVideoPreview({
  player,
  isMuted,
  isPlaying,
  isLooping,
  isFullscreen = false,
  onTogglePlay,
  onToggleFullscreen,
  onToggleLoop
}: PreviewProps) {
  const { palette } = useTheme();

  React.useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  React.useEffect(() => {
    player.loop = isLooping;
  }, [isLooping, player]);

  React.useEffect(() => {
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player]);

  return (
    <View
      style={[
        isFullscreen ? styles.previewFullscreen : styles.preview,
        {
          borderColor: palette.border,
          backgroundColor: palette.mediaBackground,
          aspectRatio: isFullscreen ? undefined : 16 / 9,
        },
      ]}
    >
      <VideoView
        style={styles.previewVideo}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
      <Pressable style={styles.previewOverlay} onPress={onTogglePlay} accessibilityRole="button">
        <View style={[styles.previewControl, { backgroundColor: palette.mediaControl }, isPlaying ? styles.previewHidden : null]}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={palette.mediaControlText} />
        </View>
      </Pressable>
      <View style={styles.previewControls}>
        <Pressable onPress={onToggleFullscreen} style={[styles.previewControlButton, { backgroundColor: palette.mediaControl }]} hitSlop={8}>
          <Ionicons name="expand" size={20} color={palette.mediaControlText} />
        </Pressable>
        <Pressable onPress={onToggleLoop} style={[styles.previewControlButton, { backgroundColor: palette.mediaControl }]} hitSlop={8}>
          <Ionicons name={isLooping ? "repeat" : "repeat-outline"} size={20} color={isLooping ? palette.success : palette.mediaControlText} />
        </Pressable>
      </View>
    </View>
  );
});

function filenameToFallbackTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim();
  return withoutExtension.length > 0 ? withoutExtension : 'downloaded_video';
}

function getClipboardStateMessage(t: (key: string) => string, state: ClipboardUploadState): string {
  if (state === 'starting') return t('upload.clipboardStarting');
  if (state === 'polling') return t('upload.clipboardProcessing');
  if (state === 'fetching') return t('upload.clipboardFetchingFile');
  if (state === 'saving') return t('upload.clipboardSavingToDevice');
  if (state === 'metadata') return t('upload.clipboardAwaitingMetadata');
  if (state === 'uploading') return t('upload.clipboardUploading');
  return '';
}

export function UploadScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const shadows = useShadows();
  const router = useRouter();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const isAnonymous = useAppSettingsStore((state) => state.uploadAnonymousDefault);
  const setUploadAnonymousDefault = useAppSettingsStore((state) => state.setUploadAnonymousDefault);
  const askMetadataAfterDownload = useAppSettingsStore((state) => state.clipboardUploadAskMetadata);
  const setClipboardUploadAskMetadata = useAppSettingsStore((state) => state.setClipboardUploadAskMetadata);
  const saveToDeviceAlso = useAppSettingsStore((state) => state.clipboardUploadSaveToDevice);
  const setClipboardUploadSaveToDevice = useAppSettingsStore((state) => state.setClipboardUploadSaveToDevice);

  const [mode, setMode] = useState<UploadMode>('manual');

  const [selectedVideo, setSelectedVideo] = useState<NormalizedVideoAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const [clipboardState, setClipboardState] = useState<ClipboardUploadState>('idle');
  const [clipboardStatusMessage, setClipboardStatusMessage] = useState('');
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [clipboardDownloadedAsset, setClipboardDownloadedAsset] = useState<NormalizedVideoAsset | null>(null);
  const [clipboardFallbackTitle, setClipboardFallbackTitle] = useState('');
  const [clipboardTitle, setClipboardTitle] = useState('');
  const [clipboardDescription, setClipboardDescription] = useState('');
  const clipboardCancelRef = useRef(false);

  const videoPlayer = useVideoPlayer(selectedVideo?.normalizedUri || '', (playerInstance) => {
    playerInstance.loop = isPreviewLooping;
    playerInstance.muted = isPreviewMuted;
  });

  const modeOptions = useMemo(() => {
    const options: { label: string; value: UploadMode }[] = [
      { label: t('upload.manualMode'), value: 'manual' },
    ];
    if (isDownloaderConfigured) {
      options.push({ label: t('upload.clipboardMode'), value: 'clipboard' });
    }
    return options;
  }, [t]);

  React.useEffect(() => {
    clipboardCancelRef.current = false;
    return () => {
      clipboardCancelRef.current = true;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      void cleanupNormalizedVideoAsset(selectedVideo);
    };
  }, [selectedVideo]);

  React.useEffect(() => {
    return () => {
      void cleanupNormalizedVideoAsset(clipboardDownloadedAsset);
    };
  }, [clipboardDownloadedAsset]);

  const getNormalizationErrorMessage = React.useCallback(
    (code: UploadValidationError['code']) => {
      switch (code) {
        case 'too_large':
          return t('upload.tooLarge');
        case 'empty_file':
          return t('upload.emptyFile');
        case 'unsupported_source':
          return t('upload.unsupportedSource');
        case 'file_unreadable':
        default:
          return t('upload.fileUnreadable');
      }
    },
    [t]
  );

  const getClipboardErrorMessage = React.useCallback(
    (error: unknown) => {
      if (error instanceof ClipboardUrlError) {
        if (error.code === 'CLIPBOARD_UNAVAILABLE') return t('upload.clipboardUnavailable');
        if (error.code === 'CLIPBOARD_EMPTY') return t('upload.clipboardEmpty');
        if (error.code === 'INVALID_URL') return t('upload.clipboardInvalidUrl');
        if (error.code === 'UNSUPPORTED_PLATFORM') return t('upload.clipboardUnsupportedPlatform');
      }

      if (error instanceof DownloaderApiError) {
        if (error.code === 'DOWNLOADER_NOT_CONFIGURED') return t('upload.clipboardDownloaderNotConfigured');
        if (error.code === 'FILE_TOO_LARGE') return t('upload.tooLarge');
        if (error.code === 'UNSUPPORTED_PLATFORM') return t('upload.clipboardUnsupportedPlatform');
        if (error.code === 'TOO_MANY_REQUESTS' || error.code === 'VOLUME_LIMIT_EXCEEDED') return t('upload.clipboardRateLimited');
        if (error.code === 'TASK_TIMEOUT') return t('upload.clipboardTimedOut');
        if (error.code === 'TASK_FAILED') return t('upload.clipboardTaskFailed');
        if (error.code === 'DOWNLOADER_FILE_FETCH_FAILED' || error.code === 'FILE_NOT_READY') return t('upload.clipboardFailed');
        if (error.code === 'DOWNLOAD_CANCELLED') return t('upload.clipboardCancelled');
      }

      return t('upload.clipboardFailed');
    },
    [t]
  );

  const handleTitleChange = React.useCallback((text: string) => {
    setTitle(clampUtf8Bytes(text, UPLOAD_VIDEO_TITLE_MAX_BYTES));
  }, []);

  const handleDescriptionChange = React.useCallback((text: string) => {
    setDescription(clampUtf8Bytes(text, UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES));
  }, []);

  const cleanupClipboardAssetState = React.useCallback(async () => {
    await cleanupNormalizedVideoAsset(clipboardDownloadedAsset);
    setClipboardDownloadedAsset(null);
  }, [clipboardDownloadedAsset]);

  const handleClipboardMetadataCancel = React.useCallback(async () => {
    setMetadataModalVisible(false);
    setClipboardState('idle');
    setClipboardStatusMessage('');
    setClipboardTitle('');
    setClipboardDescription('');
    await cleanupClipboardAssetState();
  }, [cleanupClipboardAssetState]);

  const uploadAssetToPlatform = React.useCallback(
    async (asset: NormalizedVideoAsset, options: { fallbackTitle: string; customTitle?: string; customDescription?: string }) => {
      setLoading(true);
      const resolvedTitle =
        clampUtf8Bytes((options.customTitle ?? '').trim(), UPLOAD_VIDEO_TITLE_MAX_BYTES) ||
        clampUtf8Bytes(options.fallbackTitle.trim(), UPLOAD_VIDEO_TITLE_MAX_BYTES) ||
        'downloaded_video';
      const resolvedDescription =
        clampUtf8Bytes((options.customDescription ?? '').trim(), UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES) || null;

      try {
        if (saveToDeviceAlso) {
          setClipboardState('saving');
          setClipboardStatusMessage(getClipboardStateMessage(t, 'saving'));
          try {
            await saveVideoUriToLibrary(asset.normalizedUri);
          } catch (saveError) {
            if (__DEV__) {
              console.debug('[clipboard.upload] save_to_device_failed', {
                error: saveError instanceof Error ? saveError.message : String(saveError),
              });
            }
            const normalizedMessage = saveError instanceof Error ? saveError.message.toLowerCase() : '';
            showToast(
              normalizedMessage.includes('permission')
                ? t('video.downloadPermissionDenied')
                : t('video.downloadFailed'),
              'error'
            );
          }
        }

        setClipboardState('uploading');
        setClipboardStatusMessage(getClipboardStateMessage(t, 'uploading'));

        if (__DEV__) {
          console.debug('[clipboard.upload] upload_start', {
            filename: asset.filename,
            sizeBytes: asset.sizeBytes,
            isAnonymous,
            saveToDeviceAlso,
            hasCustomTitle: Boolean(options.customTitle?.trim()),
            hasCustomDescription: Boolean(options.customDescription?.trim()),
          });
        }

        await uploadVideo({
          asset,
          isAnonymous,
          metadata: {
            title: resolvedTitle,
            description: resolvedDescription,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ['feed'] });
        await queryClient.invalidateQueries({ queryKey: ['myVideos'] });

        showToast(t('upload.success'), 'success');
        router.back();
      } catch (error: any) {
        if (error instanceof UploadValidationError) {
          showToast(getNormalizationErrorMessage(error.code), 'error');
        } else if (error?.message === 'too_large') {
          showToast(t('upload.tooLarge'), 'error');
        } else if (error?.response?.status === 400) {
          const backendMessage = extractApiErrorMessage(error);
          showToast(backendMessage ?? t('common.error'), 'error');
        } else if (error?.response?.status === 429) {
          showToast(t('upload.rateLimited'), 'error');
        } else {
          showToast(t('common.error'), 'error');
        }
      } finally {
        setLoading(false);
        setClipboardState('idle');
        setClipboardStatusMessage('');
        setMetadataModalVisible(false);
        await cleanupClipboardAssetState();
      }
    },
    [cleanupClipboardAssetState, getNormalizationErrorMessage, isAnonymous, router, saveToDeviceAlso, showToast, t]
  );

  const handleManualPick = async () => {
    try {
      const asset = await pickVideo();
      if (!asset) return;

      if (__DEV__) {
        console.debug('[upload.pick] selected', {
          sourceScheme: typeof asset.uri === 'string' ? asset.uri.split(':')[0] : null,
          mimeType: asset.mimeType ?? null,
          fileName: asset.fileName ?? null,
          fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
        });
      }

      const normalized = await normalizePickedVideoAsset(asset);
      setSelectedVideo(normalized);
      setIsPreviewPlaying(autoPlayVideos);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        showToast(getNormalizationErrorMessage(error.code), 'error');
        return;
      }
      showToast(t('upload.pickError'), 'error');
    }
  };

  const handleManualUpload = async () => {
    if (!selectedVideo) return;
    setLoading(true);

    try {
      await uploadVideo({
        asset: selectedVideo,
        isAnonymous,
          metadata: {
            title: clampUtf8Bytes(title.trim(), UPLOAD_VIDEO_TITLE_MAX_BYTES) || null,
            description: clampUtf8Bytes(description.trim(), UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES) || null,
          },
        });

      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['myVideos'] });

      showToast(t('upload.success'), 'success');
      router.back();
    } catch (error: any) {
      if (error instanceof UploadValidationError) {
        showToast(getNormalizationErrorMessage(error.code), 'error');
      } else if (error?.message === 'too_large') {
        showToast(t('upload.tooLarge'), 'error');
      } else if (error?.response?.status === 400) {
        const backendMessage = extractApiErrorMessage(error);
        showToast(backendMessage ?? t('common.error'), 'error');
      } else if (error?.response?.status === 429) {
        showToast(t('upload.rateLimited'), 'error');
      } else {
        showToast(t('common.error'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualRemove = () => {
    setSelectedVideo(null);
    setIsPreviewPlaying(false);
    setShowFullscreen(false);
    setTitle('');
    setDescription('');
  };

  const handleClipboardDownloadAndUpload = async () => {
    if (loading) return;
    if (!isDownloaderConfigured) {
      showToast(t('upload.clipboardDownloaderNotConfigured'), 'error');
      return;
    }

    setLoading(true);
    setClipboardState('starting');
    setClipboardStatusMessage(getClipboardStateMessage(t, 'starting'));

    try {
      if (__DEV__) {
        console.debug('[clipboard.upload] start');
      }

      const result = await downloadFromClipboardToNormalizedAsset({
        shouldCancel: () => clipboardCancelRef.current,
        onProgress: ({ state, taskId }) => {
          if (__DEV__) {
            console.debug('[clipboard.upload] progress', { state, taskId });
          }
          const mappedState =
            state === 'starting'
              ? 'starting'
              : state === 'polling'
                ? 'polling'
                : state === 'fetching'
                  ? 'fetching'
                  : 'metadata';
          setClipboardState(mappedState);
          setClipboardStatusMessage(getClipboardStateMessage(t, mappedState));
        },
      });

      const fallbackTitle = filenameToFallbackTitle(result.downloadedFilename || result.fallbackTitle);
      const clampedFallbackTitle = clampUtf8Bytes(fallbackTitle, UPLOAD_VIDEO_TITLE_MAX_BYTES);
      setClipboardDownloadedAsset(result.asset);
      setClipboardFallbackTitle(clampedFallbackTitle);
      setClipboardTitle(clampedFallbackTitle);
      setClipboardDescription('');

      if (askMetadataAfterDownload) {
        setClipboardState('metadata');
        setClipboardStatusMessage(getClipboardStateMessage(t, 'metadata'));
        setMetadataModalVisible(true);
        setLoading(false);
        return;
      }

      await uploadAssetToPlatform(result.asset, {
        fallbackTitle: clampedFallbackTitle,
        customTitle: '',
        customDescription: '',
      });
    } catch (error) {
      if (__DEV__) {
        console.debug('[clipboard.upload] done/error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const message = getClipboardErrorMessage(error);
      setClipboardState('error');
      setClipboardStatusMessage(message);
      showToast(message, 'error');
      setLoading(false);
    }
  };

  const clipboardActionInFlight =
    clipboardState === 'starting' ||
    clipboardState === 'polling' ||
    clipboardState === 'fetching' ||
    clipboardState === 'saving' ||
    clipboardState === 'uploading';

  const manualSection = (
    <>
      <Button label={t('upload.selectVideo')} onPress={handleManualPick} />
      {selectedVideo ? (
        <View>
          {!showFullscreen && (
            <UploadVideoPreview
              key={selectedVideo.normalizedUri}
              player={videoPlayer}
              isMuted={isPreviewMuted}
              isPlaying={isPreviewPlaying}
              isLooping={isPreviewLooping}
              onTogglePlay={() => setIsPreviewPlaying((prev) => !prev)}
              onToggleFullscreen={() => setShowFullscreen(true)}
              onToggleLoop={() => setIsPreviewLooping((prev) => !prev)}
            />
          )}
          <Pressable
            style={styles.removeButton}
            onPress={handleManualRemove}
            hitSlop={8}
          >
            <View style={[styles.removeIconContainer, shadows.subtle, { backgroundColor: palette.error }]}>
              <Ionicons name="trash" size={16} color={palette.onAccent} />
            </View>
          </Pressable>
        </View>
      ) : null}
      {selectedVideo ? (
        <View>
          <AppText variant="caption" style={{ marginBottom: 4 }}>{selectedVideo.filename}</AppText>
        </View>
      ) : null}
      <Input
        placeholder={t('upload.videoTitle')}
        value={title}
        onChangeText={handleTitleChange}
        maxLength={UPLOAD_VIDEO_TITLE_MAX_BYTES}
      />
      <Input
        placeholder={t('upload.description')}
        value={description}
        onChangeText={handleDescriptionChange}
        maxLength={UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES}
        multiline
        style={styles.textArea}
      />
      {selectedVideo ? (
        <View style={styles.previewActions}>
          <Pressable
            style={[styles.previewAction, { borderColor: palette.border }]}
            onPress={() => setIsPreviewMuted((prev) => !prev)}
          >
            <Ionicons name={isPreviewMuted ? 'volume-mute' : 'volume-high'} size={16} color={palette.text.primary} />
            <AppText variant="caption">
              {isPreviewMuted ? t('upload.unmutePreview') : t('upload.mutePreview')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.toggleRow}>
        <AppText>{t('upload.anonymous')}</AppText>
        <Switch
          value={isAnonymous}
          onValueChange={(value) => {
            void setUploadAnonymousDefault(value);
          }}
          trackColor={{ true: palette.accent, false: palette.border }}
        />
      </View>
      <View style={styles.footer}>
        {loading ? <ActivityIndicator color={palette.accent} /> : null}
        <Button label={t('upload.title')} onPress={handleManualUpload} disabled={!selectedVideo || loading} />
      </View>
    </>
  );

  const clipboardSection = (
    <>
      <Pressable
        style={[
          styles.clipboardButton,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            opacity: clipboardActionInFlight ? 0.7 : 1,
          },
        ]}
        disabled={clipboardActionInFlight}
        onPress={handleClipboardDownloadAndUpload}
      >
        {clipboardActionInFlight ? (
          <ActivityIndicator size="large" color={palette.accent} />
        ) : (
          <Ionicons name="download-outline" size={64} color={palette.accent} />
        )}
        <AppText variant="bodyBold" style={{ color: palette.accent, textAlign: 'center' }}>
          {t('upload.clipboardButton')}
        </AppText>
        <AppText variant="caption" style={{ color: palette.text.secondary, textAlign: 'center' }}>
          {t('upload.clipboardButtonHint')}
        </AppText>
      </Pressable>

      {clipboardStatusMessage ? (
        <AppText
          variant="caption"
          style={{
            textAlign: 'center',
            color: clipboardState === 'error' ? palette.error : palette.text.secondary,
          }}
        >
          {clipboardStatusMessage}
        </AppText>
      ) : null}

      <View
        style={[
          styles.clipboardToggleCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={[styles.clipboardToggleRow, { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
          <View style={styles.clipboardToggleLabelContainer}>
            <AppText style={styles.clipboardToggleLabelText}>{t('upload.anonymous')}</AppText>
          </View>
          <View style={styles.clipboardToggleSwitchSlot}>
            <Switch
              value={isAnonymous}
              onValueChange={(value) => {
                void setUploadAnonymousDefault(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
            />
          </View>
        </View>

        <View style={[styles.clipboardToggleRow, { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
          <View style={styles.clipboardToggleLabelContainer}>
            <AppText style={styles.clipboardToggleLabelText}>{t('upload.clipboardAskMetadata')}</AppText>
          </View>
          <View style={styles.clipboardToggleSwitchSlot}>
            <Switch
              value={askMetadataAfterDownload}
              onValueChange={(value) => {
                void setClipboardUploadAskMetadata(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
            />
          </View>
        </View>

        <View style={styles.clipboardToggleRow}>
          <View style={styles.clipboardToggleLabelContainer}>
            <AppText style={styles.clipboardToggleLabelText}>{t('upload.clipboardSaveToDeviceAlso')}</AppText>
          </View>
          <View style={styles.clipboardToggleSwitchSlot}>
            <Switch
              value={saveToDeviceAlso}
              onValueChange={(value) => {
                void setClipboardUploadSaveToDevice(value);
              }}
              trackColor={{ true: palette.accent, false: palette.border }}
            />
          </View>
        </View>
      </View>
    </>
  );

  const content = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      <View style={styles.content}>
        <SegmentedControl
          options={modeOptions}
          value={mode}
          onChange={(value) => setMode(value as UploadMode)}
        />

        {!isDownloaderConfigured && mode === 'clipboard' ? (
          <AppText variant="caption" style={{ color: palette.text.secondary }}>
            {t('upload.clipboardDownloaderNotConfigured')}
          </AppText>
        ) : null}

        {mode === 'manual' ? manualSection : clipboardSection}
      </View>
    </ScrollView>
  );

  return (
    <>
      <Screen title={t('upload.title')} showBack contentStyle={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
        >
          {content}
        </KeyboardAvoidingView>
      </Screen>

      {showFullscreen && selectedVideo ? (
        <Modal
          visible={showFullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowFullscreen(false)}
          statusBarTranslucent
        >
          <View style={[styles.fullscreenContainer, { backgroundColor: palette.mediaBackground }]}>
            <View style={styles.fullscreenVideoWrapper}>
              <UploadVideoPreview
                player={videoPlayer}
                isMuted={isPreviewMuted}
                isPlaying={isPreviewPlaying}
                isLooping={isPreviewLooping}
                isFullscreen={true}
                onTogglePlay={() => setIsPreviewPlaying((prev) => !prev)}
                onToggleFullscreen={() => setShowFullscreen(false)}
                onToggleLoop={() => setIsPreviewLooping((prev) => !prev)}
              />
            </View>
            <Pressable
              style={styles.fullscreenClose}
              onPress={() => setShowFullscreen(false)}
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={40} color={palette.mediaControlText} />
            </Pressable>
          </View>
        </Modal>
      ) : null}

      <Modal
        visible={metadataModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void handleClipboardMetadataCancel();
        }}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
          onPress={() => {
            void handleClipboardMetadataCancel();
          }}
        >
          <Pressable
            style={[styles.metadataModal, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="heading2">{t('upload.clipboardMetadataModalTitle')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('upload.clipboardMetadataModalBody')}
            </AppText>

            <Input
              placeholder={t('upload.videoTitle')}
              value={clipboardTitle}
              onChangeText={(text) => setClipboardTitle(clampUtf8Bytes(text, UPLOAD_VIDEO_TITLE_MAX_BYTES))}
              maxLength={UPLOAD_VIDEO_TITLE_MAX_BYTES}
            />
            <Input
              placeholder={t('upload.description')}
              value={clipboardDescription}
              onChangeText={(text) =>
                setClipboardDescription(clampUtf8Bytes(text, UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES))
              }
              maxLength={UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES}
              multiline
              style={styles.textArea}
            />

            <View style={styles.modalActions}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={() => {
                  void handleClipboardMetadataCancel();
                }}
              />
              <Button
                label={t('upload.clipboardUploadNow')}
                onPress={async () => {
                  if (!clipboardDownloadedAsset) return;
                  await uploadAssetToPlatform(clipboardDownloadedAsset, {
                    fallbackTitle: clipboardFallbackTitle,
                    customTitle: clipboardTitle,
                    customDescription: clipboardDescription,
                  });
                }}
                disabled={loading}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  content: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  preview: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    width: '100%',
    maxHeight: 280,
  },
  previewFullscreen: {
    overflow: 'hidden',
    borderRadius: 0,
    borderWidth: 0,
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewControl: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHidden: {
    opacity: 0,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  previewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  removeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewControls: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  previewControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
  },
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipboardButton: {
    width: 260,
    height: 260,
    borderRadius: 24,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  clipboardToggleCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  clipboardToggleRow: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 0,
  },
  clipboardToggleLabelContainer: {
    flex: 1,
    minWidth: 0,
  },
  clipboardToggleLabelText: {
    flexShrink: 1,
  },
  clipboardToggleSwitchSlot: {
    width: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  metadataModal: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
