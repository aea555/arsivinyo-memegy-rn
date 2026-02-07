import React, { useEffect } from 'react';
import { AppState, AppStateStatus, Animated, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

type VideoPlayerProps = {
  uri: string;
  isActive: boolean;
  isScreenActive?: boolean;
  variant?: 'card' | 'immersive';
  height?: number;
  contentFit?: 'cover' | 'contain';
  showNativeControls?: boolean;
  autoPlayEnabled?: boolean;
  allowTapToToggle?: boolean;
};

const SCREEN_LOSS_PAUSE_DELAY_MS = 250;
const VIEWABILITY_LOSS_PAUSE_DELAY_MS = 900;
const BACKGROUND_PAUSE_DELAY_MS = 1200;
const FULLSCREEN_RESUME_WINDOW_MS = 2000;
const TAP_FEEDBACK_TOTAL_MS = 500;

function isReleasedPlayerError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Cannot use shared object that was already released') ||
    message.includes('already released')
  );
}

export function VideoPlayer({
  uri,
  isActive,
  isScreenActive = true,
  variant = 'card',
  height,
  contentFit,
  showNativeControls,
  autoPlayEnabled,
  allowTapToToggle = false,
}: VideoPlayerProps) {
  const { palette } = useTheme();
  const defaultAutoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const autoPlayVideos = autoPlayEnabled ?? defaultAutoPlayVideos;
  const isImmersive = variant === 'immersive';
  const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [manualPaused, setManualPaused] = React.useState<boolean | null>(null);
  const [tapFeedbackIcon, setTapFeedbackIcon] = React.useState<'pause' | 'play' | null>(null);
  const pauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapFeedbackOpacity = React.useRef(new Animated.Value(0)).current;
  const tapFeedbackScale = React.useRef(new Animated.Value(0.84)).current;
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
    setManualPaused(null);
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
        if (isReleasedPlayerError(error)) return;
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
      if (manualPaused !== null) {
        setManualPaused(null);
      }
      postFullscreenStateRef.current = null;
      if (isImmersive) {
        clearPauseTimer();
        pauseNow();
        return;
      }
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
      } else if (manualPaused === true) {
        player.pause();
      } else if (manualPaused === false) {
        player.play();
      } else if (autoPlayVideos) {
        player.play();
      }
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
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
    isImmersive,
    manualPaused,
    isActive,
    isScreenActive,
    isFullscreen,
    player,
    uri,
  ]);

  const runTapFeedback = (icon: 'pause' | 'play') => {
    setTapFeedbackIcon(icon);
    tapFeedbackOpacity.stopAnimation();
    tapFeedbackScale.stopAnimation();
    tapFeedbackOpacity.setValue(0);
    tapFeedbackScale.setValue(0.84);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(tapFeedbackOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(tapFeedbackScale, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(160),
      Animated.parallel([
        Animated.timing(tapFeedbackOpacity, {
          toValue: 0,
          duration: TAP_FEEDBACK_TOTAL_MS - 280,
          useNativeDriver: true,
        }),
        Animated.timing(tapFeedbackScale, {
          toValue: 1.04,
          duration: TAP_FEEDBACK_TOTAL_MS - 280,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        setTapFeedbackIcon(null);
      }
    });
  };

  const handleTogglePlayback = () => {
    if (!allowTapToToggle) return;
    if (!isActive || !isScreenActive) return;

    const isPlaying = player.playing || lastKnownPlayingRef.current;
    const nextPaused = isPlaying;
    setManualPaused(nextPaused);
    runTapFeedback(nextPaused ? 'pause' : 'play');
    try {
      if (nextPaused) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
      if (__DEV__) {
        console.debug('[video] tap-toggle skipped for released player', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  return (
    <View
      style={[
        isImmersive ? styles.immersiveContainer : styles.container,
        { backgroundColor: palette.surface },
        typeof height === 'number' ? { height } : null,
      ]}
    >
      <VideoView
        style={isImmersive ? styles.videoImmersive : styles.videoCard}
        player={player}
        contentFit={contentFit ?? (isImmersive ? 'cover' : 'cover')}
        nativeControls={showNativeControls ?? !isImmersive}
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
      {allowTapToToggle ? <Pressable style={styles.tapOverlay} onPress={handleTogglePlayback} /> : null}
      {allowTapToToggle && tapFeedbackIcon ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tapFeedbackWrap,
            {
              opacity: tapFeedbackOpacity,
              transform: [{ scale: tapFeedbackScale }],
            },
          ]}
        >
          <View style={[styles.tapFeedbackBadge, { backgroundColor: palette.mediaControl }]}>
            <Ionicons
              name={tapFeedbackIcon === 'pause' ? 'pause' : 'play'}
              size={24}
              color={palette.mediaControlText}
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  immersiveContainer: {
    borderRadius: 0,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  videoCard: {
    width: '100%',
    height: 360,
  },
  videoImmersive: {
    width: '100%',
    height: '100%',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tapFeedbackWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapFeedbackBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
