import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useTheme } from '@/src/shared/theme/ThemeProvider';

type VideoPlayerProps = {
  uri: string;
  isActive: boolean;
};

export function VideoPlayer({ uri, isActive }: VideoPlayerProps) {
  const { palette } = useTheme();
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

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
