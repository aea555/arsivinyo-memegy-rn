import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { getVideoSize, pickVideo, uploadVideo } from '@/src/features/upload/hooks/useVideoUpload';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { isValidFile, showEditor } from 'react-native-video-trim';

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
          backgroundColor: '#000000',
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
        <View style={[styles.previewControl, isPlaying ? styles.previewHidden : null]}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFFFFF" />
        </View>
      </Pressable>
      <View style={styles.previewControls}>
        <Pressable onPress={onToggleFullscreen} style={styles.previewControlButton} hitSlop={8}>
          <Ionicons name="expand" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={onToggleLoop} style={styles.previewControlButton} hitSlop={8}>
          <Ionicons name={isLooping ? "repeat" : "repeat-outline"} size={20} color={isLooping ? "#4CAF50" : "#FFFFFF"} />
        </Pressable>
      </View>
    </View>
  );
});

export function UploadScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();

  const [assetUri, setAssetUri] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Create a single video player instance shared between preview and fullscreen
  const videoPlayer = useVideoPlayer(assetUri || '', (playerInstance) => {
    playerInstance.loop = isPreviewLooping;
    playerInstance.muted = isPreviewMuted;
  });

  const handleTitleChange = React.useCallback((text: string) => {
    setTitle(text);
  }, []);

  const handleDescriptionChange = React.useCallback((text: string) => {
    setDescription(text);
  }, []);

  const handlePick = async () => {
    try {
      const asset = await pickVideo();
      if (!asset) return;
      setAssetUri(asset.uri);
      setFilename(asset.fileName ?? 'upload.mp4');
      setIsPreviewPlaying(false);
    } catch {
      Alert.alert(t('common.error'), t('upload.pickError'));
    }
  };

  const handleUpload = async () => {
    if (!assetUri) return;
    setLoading(true);

    try {
      const sizeBytes = await getVideoSize(assetUri);

      await uploadVideo({
        assetUri,
        filename: filename || 'upload.mp4',
        sizeBytes,
        isAnonymous,
        metadata: {
          title: title.trim() || null,
          description: description.trim() || null,
          is_anonymous: isAnonymous,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['myVideos'] });

      Alert.alert(t('upload.success'));
      router.back();
    } catch (error: any) {
      if (error?.message === 'too_large') {
        Alert.alert(t('common.error'), t('upload.tooLarge'));
      } else if (error?.response?.status === 429) {
        Alert.alert(t('common.error'), t('upload.rateLimited'));
      } else {
        Alert.alert(t('common.error'), t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTrimComplete = React.useCallback((e: any) => {
    console.log('✅ Trim complete! Event data:', JSON.stringify(e, null, 2));
    console.log('Previous URI:', assetUri);
    console.log('New URI:', e.outputPath);
    setAssetUri(e.outputPath);
    setFilename('trimmed_' + (filename || 'video.mp4'));
    setIsPreviewPlaying(false);
    Alert.alert('✅ Success', `Video trimmed!\n\nOld: ${assetUri?.substring(assetUri.lastIndexOf('/') + 1)}\nNew: ${e.outputPath?.substring(e.outputPath.lastIndexOf('/') + 1)}`);
  }, [assetUri, filename]);

  useEffect(() => {
    console.log('🔧 Setting up trim event listeners...');

    // Try both iOS and Android patterns
    const iosEmitter = new NativeEventEmitter(NativeModules.VideoTrim);
    const androidEmitter = DeviceEventEmitter;

    // Subscribe to both to see which one works
    const subscriptions: any[] = [];

    ['onFinishTrimming', 'VideoTrimFinished', 'onComplete'].forEach(eventName => {
      subscriptions.push(
        iosEmitter.addListener(eventName, (e: any) => {
          console.log(`✅ iOS event '${eventName}':`, e);
          handleTrimComplete(e)
        })
      );

      subscriptions.push(
        androidEmitter.addListener(eventName, (e: any) => {
          console.log(`✅ Android event '${eventName}':`, e);
          handleTrimComplete(e);
        })
      );
    });

    ['onError', 'VideoTrimError'].forEach(eventName => {
      subscriptions.push(
        iosEmitter.addListener(eventName, (e: any) => {
          console.error(`❌ iOS error '${eventName}':`, e);
          Alert.alert(t('common.error'), e.message || t('upload.trimError'));
        })
      );

      subscriptions.push(
        androidEmitter.addListener(eventName, (e: any) => {
          console.error(`❌ Android error '${eventName}':`, e);
          Alert.alert(t('common.error'), e.message || t('upload.trimError'));
        })
      );
    });

    return () => {
      console.log('🧹 Cleaning up trim listeners');
      subscriptions.forEach(sub => sub?.remove?.());
    };
  }, [t, handleTrimComplete]);

  const handleTrim = async () => {
    if (!assetUri) return;

    try {
      const valid = await isValidFile(assetUri);
      if (!valid.isValid) {
        Alert.alert(t('common.error'), t('upload.invalidVideo'));
        return;
      }

      showEditor(assetUri, {
        maxDuration: 60,
        minDuration: 1,
        cancelButtonText: t('common.cancel'),
        saveButtonText: t('common.save'),
        enableCancelDialog: false,
        enableSaveDialog: false,
        saveToPhoto: false,
      });
    } catch (error) {
      console.error('Start trim error:', error);
    }
  };

  const handleRemove = () => {
    setAssetUri(null);
    setFilename('');
    setIsPreviewPlaying(false);
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
        {assetUri ? (
          <View>
            {!showFullscreen && (
              <UploadVideoPreview
                key={assetUri}
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
              <View style={[styles.removeIconContainer, { backgroundColor: palette.error }]}>
                <Ionicons name="trash" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        ) : null}
        {assetUri ? (
          <View>
            <AppText variant="caption" style={{ marginBottom: 4 }}>{filename}</AppText>
            <AppText variant="caption" style={{ fontSize: 10, opacity: 0.6 }}>
              Path: {assetUri.substring(assetUri.lastIndexOf('/') + 1)}
            </AppText>
          </View>
        ) : null}
        <Input placeholder={t('upload.videoTitle')} value={title} onChangeText={handleTitleChange} />
        <Input
          placeholder={t('upload.description')}
          value={description}
          onChangeText={handleDescriptionChange}
          multiline
          style={styles.textArea}
        />
        {assetUri ? (
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
          <Button label={t('upload.title')} onPress={handleUpload} disabled={!assetUri || loading} />
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
      {showFullscreen && assetUri && (
        <Modal
          visible={showFullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowFullscreen(false)}
          statusBarTranslucent
        >
          <View style={styles.fullscreenContainer}>
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
              <Ionicons name="close-circle" size={40} color="#FFFFFF" />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    backgroundColor: '#000',
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
