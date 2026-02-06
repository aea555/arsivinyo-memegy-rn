import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

type VideoPlayerProps = {
  uri: string;
  isActive: boolean;
};

export function VideoPlayer({ uri, isActive }: VideoPlayerProps) {
  const { palette } = useTheme();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    if (isActive && autoPlayVideos) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, autoPlayVideos, player]);

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
