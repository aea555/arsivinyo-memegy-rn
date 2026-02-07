import React, { useEffect } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

type VideoPlayerProps = {
  uri: string;
  isActive: boolean;
  isScreenActive?: boolean;
};

export function VideoPlayer({ uri, isActive, isScreenActive = true }: VideoPlayerProps) {
  const { palette } = useTheme();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const shouldPlay =
      isActive &&
      isScreenActive &&
      autoPlayVideos &&
      appState === 'active';

    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch (error) {
      if (__DEV__) {
        console.debug('[video] play/pause skipped for released player', {
          uri,
          shouldPlay,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [appState, autoPlayVideos, isActive, isScreenActive, player, uri]);

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <VideoView style={styles.video} player={player} contentFit="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: 360,
  },
});
