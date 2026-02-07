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

const SCREEN_LOSS_PAUSE_DELAY_MS = 250;
const VIEWABILITY_LOSS_PAUSE_DELAY_MS = 900;
const BACKGROUND_PAUSE_DELAY_MS = 1200;
const FULLSCREEN_RESUME_WINDOW_MS = 2000;

export function VideoPlayer({ uri, isActive, isScreenActive = true }: VideoPlayerProps) {
  const { palette } = useTheme();
  const autoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const pauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(appState);
  const isActiveRef = React.useRef(isActive);
  const isScreenActiveRef = React.useRef(isScreenActive);
  const isFullscreenRef = React.useRef(isFullscreen);
  const lastKnownPlayingRef = React.useRef(false);
  const postFullscreenStateRef = React.useRef<boolean | null>(null);
  const resumeAfterForcedPauseUntilRef = React.useRef(0);

  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    appStateRef.current = appState;
    isActiveRef.current = isActive;
    isScreenActiveRef.current = isScreenActive;
    isFullscreenRef.current = isFullscreen;
  }, [appState, isActive, isScreenActive, isFullscreen]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = player.addListener('playingChange', ({ isPlaying }) => {
      lastKnownPlayingRef.current = isPlaying;
      // Once fullscreen state has been restored, do not keep forcing it.
      if (!isFullscreenRef.current && postFullscreenStateRef.current !== null) {
        postFullscreenStateRef.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    postFullscreenStateRef.current = null;
  }, [uri]);

  useEffect(() => {
    const pauseNow = () => {
      try {
        const wasPlaying = player.playing || lastKnownPlayingRef.current;
        if (wasPlaying) {
          resumeAfterForcedPauseUntilRef.current = Date.now() + FULLSCREEN_RESUME_WINDOW_MS;
        } else {
          resumeAfterForcedPauseUntilRef.current = 0;
        }
        player.pause();
      } catch (error) {
        if (__DEV__) {
          console.debug('[video] pause skipped for released player', {
            uri,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };

    const schedulePause = (delayMs: number) => {
      if (pauseTimerRef.current) return;
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        const shouldPause =
          (!isFullscreenRef.current && appStateRef.current === 'background') ||
          (!isFullscreenRef.current && (!isActiveRef.current || !isScreenActiveRef.current));
        if (!shouldPause) return;
        pauseNow();
      }, delayMs);
    };

    if (appState === 'background') {
      if (isFullscreen) {
        clearPauseTimer();
        return;
      }
      postFullscreenStateRef.current = null;
      schedulePause(BACKGROUND_PAUSE_DELAY_MS);
      return;
    }

    if (isFullscreen) {
      clearPauseTimer();
      return;
    }

    if (!isActive || !isScreenActive) {
      postFullscreenStateRef.current = null;
      // Losing only viewability (while screen remains focused) can be a fullscreen transition.
      // Keep a longer delay to avoid pausing during the native fullscreen animation.
      const delayMs = !isActive && isScreenActive
        ? VIEWABILITY_LOSS_PAUSE_DELAY_MS
        : SCREEN_LOSS_PAUSE_DELAY_MS;
      schedulePause(delayMs);
      return;
    }

    clearPauseTimer();

    try {
      if (postFullscreenStateRef.current !== null) {
        if (postFullscreenStateRef.current) {
          player.play();
        } else {
          player.pause();
        }
      } else if (autoPlayVideos) {
        player.play();
      }
    } catch (error) {
      if (__DEV__) {
        console.debug('[video] playback sync skipped for released player', {
          uri,
          isActive,
          isScreenActive,
          isFullscreen,
          appState,
          autoPlayVideos,
          postFullscreenState: postFullscreenStateRef.current,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return () => {
      clearPauseTimer();
    };
  }, [
    appState,
    autoPlayVideos,
    isActive,
    isScreenActive,
    isFullscreen,
    player,
    uri,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: palette.surface }]}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        onFullscreenEnter={() => {
          if (pauseTimerRef.current) {
            clearTimeout(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }
          postFullscreenStateRef.current = null;
          setIsFullscreen(true);
          const shouldResumeAfterTransition =
            resumeAfterForcedPauseUntilRef.current > Date.now() ||
            lastKnownPlayingRef.current ||
            player.playing;
          resumeAfterForcedPauseUntilRef.current = 0;
          if (shouldResumeAfterTransition) {
            try {
              player.play();
            } catch {
              // no-op: transient native fullscreen transition
            }
          }
        }}
        onFullscreenExit={() => {
          postFullscreenStateRef.current = lastKnownPlayingRef.current;
          setIsFullscreen(false);
        }}
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
