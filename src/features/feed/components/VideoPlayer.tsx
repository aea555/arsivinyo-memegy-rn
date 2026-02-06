import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';

import { useTheme } from '@/src/shared/theme/ThemeProvider';

type VideoPlayerProps = {
  uri: string;
  isActive: boolean;
};

export function VideoPlayer({ uri, isActive }: VideoPlayerProps) {
  const { palette } = useTheme();
  const ref = useRef<Video>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (isActive) {
      void ref.current.playAsync();
    } else {
      void ref.current.pauseAsync();
    }
  }, [isActive]);

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}> 
      <Video
        ref={ref}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={false}
        isMuted={false}
      />
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
