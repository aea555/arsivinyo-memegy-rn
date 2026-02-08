import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
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

import { pickVideo, uploadVideo } from '@/src/features/upload/hooks/useVideoUpload';
import { cleanupNormalizedVideoAsset, normalizePickedVideoAsset } from '@/src/features/upload/services/videoAssetNormalizer';
import { NormalizedVideoAsset, UploadValidationError } from '@/src/features/upload/types/uploadTypes';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { useShadows } from '@/src/shared/theme/shadows';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { extractApiErrorMessage } from '@/src/shared/utils/errorParser';
import {
  clampUtf8Bytes,
  VIDEO_DESCRIPTION_MAX_BYTES,
  VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';
import { useToastStore } from '@/src/store/toastStore';

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

export function UploadScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const shadows = useShadows();
  const router = useRouter();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);

  const [selectedVideo, setSelectedVideo] = useState<NormalizedVideoAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Create a single video player instance shared between preview and fullscreen
  const videoPlayer = useVideoPlayer(selectedVideo?.normalizedUri || '', (playerInstance) => {
    playerInstance.loop = isPreviewLooping;
    playerInstance.muted = isPreviewMuted;
  });

  React.useEffect(() => {
    return () => {
      void cleanupNormalizedVideoAsset(selectedVideo);
    };
  }, [selectedVideo]);

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

  const handleTitleChange = React.useCallback((text: string) => {
    setTitle(clampUtf8Bytes(text, VIDEO_TITLE_MAX_BYTES));
  }, []);

  const handleDescriptionChange = React.useCallback((text: string) => {
    setDescription(clampUtf8Bytes(text, VIDEO_DESCRIPTION_MAX_BYTES));
  }, []);

  const handlePick = async () => {
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

  const handleUpload = async () => {
    if (!selectedVideo) return;
    setLoading(true);

    try {
      await uploadVideo({
        asset: selectedVideo,
        isAnonymous,
        metadata: {
          title: clampUtf8Bytes(title.trim(), VIDEO_TITLE_MAX_BYTES) || null,
          description:
            clampUtf8Bytes(description.trim(), VIDEO_DESCRIPTION_MAX_BYTES) || null,
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

  const handleRemove = () => {
    setSelectedVideo(null);
    setIsPreviewPlaying(false);
    setShowFullscreen(false);
    setTitle('');
    setDescription('');
  };

  /* 
  const handleTrimComplete = (trimmedUri: string) => {
    setAssetUri(trimmedUri);
    setFilename('trimmed_' + filename);
    setShowTrimModal(false);
    setIsPreviewPlaying(false);
  }; 
  */

  const content = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      <View style={styles.content}>
        <Button label={t('upload.selectVideo')} onPress={handlePick} />
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
              onPress={handleRemove}
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
            {/* <AppText variant="caption" style={{ fontSize: 10, opacity: 0.6 }}>
              Path: {selectedVideo.normalizedUri.substring(selectedVideo.normalizedUri.lastIndexOf('/') + 1)}
            </AppText> */}
          </View>
        ) : null}
        <Input
          placeholder={t('upload.videoTitle')}
          value={title}
          onChangeText={handleTitleChange}
          maxLength={VIDEO_TITLE_MAX_BYTES}
        />
        <Input
          placeholder={t('upload.description')}
          value={description}
          onChangeText={handleDescriptionChange}
          maxLength={VIDEO_DESCRIPTION_MAX_BYTES}
          multiline
          style={styles.textArea}
        />
        {selectedVideo ? (
          <View style={styles.previewActions}>
            {/* Trim button hidden for now */}
            {/* <Pressable
              style={[styles.previewAction, { borderColor: palette.border }]}
              onPress={handleTrim}
            >
              <Ionicons name="cut" size={16} color={palette.text.primary} />
              <AppText variant="caption">{t('upload.trim')}</AppText>
            </Pressable> */}
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
            onValueChange={setIsAnonymous}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </View>
        <View style={styles.footer}>
          {loading ? <ActivityIndicator color={palette.accent} /> : null}
          <Button label={t('upload.title')} onPress={handleUpload} disabled={!selectedVideo || loading} />
        </View>
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
      {showFullscreen && selectedVideo && (
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
      )}
      {/* Temporarily disabled until native module is verified */}
      {/* Native trimmer is used instead of modal */}
      {/* {assetUri && (
        <VideoTrimModal ...
      )} */}
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
});
