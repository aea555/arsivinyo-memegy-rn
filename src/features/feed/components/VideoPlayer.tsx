import React, { useEffect } from 'react';
import {
  AppState,
  AppStateStatus,
  Animated,
  Modal,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/src/shared/components/ui/AppText';
import { withAlpha } from '@/src/shared/theme/colorUtils';
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
  showMinimalControls?: boolean;
  minimalControlsPersistent?: boolean;
  minimalControlsBottomInset?: number;
  inactivePauseDelayMs?: number;
  autoPlayEnabled?: boolean;
  allowTapToToggle?: boolean;
  resetOnDeactivate?: boolean;
  holdFastForwardRate?: number;
  onPlaybackEnd?: () => void;
};

const SCREEN_LOSS_PAUSE_DELAY_MS = 250;
const VIEWABILITY_LOSS_PAUSE_DELAY_MS = 900;
const BACKGROUND_PAUSE_DELAY_MS = 1200;
const FULLSCREEN_RESUME_WINDOW_MS = 2000;
const TAP_FEEDBACK_TOTAL_MS = 500;
const TIME_UPDATE_INTERVAL_SECONDS = 0.25;
const CONTROLS_AUTO_HIDE_MS = 3000;
const CONTROLS_FADE_DURATION_MS = 180;
const RELEASED_PLAYER_LOG_LIMIT = 160;
const HOLD_FAST_FORWARD_DELAY_MS = 170;
const DEFAULT_HOLD_FAST_FORWARD_RATE = 1.5;
const HOLD_FAST_FORWARD_RIGHT_SIDE_RATIO = 0.55;
const releasedPlayerLogKeys = new Set<string>();

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function formatVideoTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function isReleasedPlayerError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Cannot use shared object that was already released') ||
    message.includes('already released')
  );
}

function logPlayerError(context: string, uri: string, error: unknown) {
  if (!__DEV__) return;
  const key = `${context}:${uri}`;
  if (releasedPlayerLogKeys.has(key)) return;
  releasedPlayerLogKeys.add(key);
  if (releasedPlayerLogKeys.size > RELEASED_PLAYER_LOG_LIMIT) {
    releasedPlayerLogKeys.clear();
  }
  console.debug(`[video] ${context} skipped for released player`, {
    uri,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function VideoPlayer({
  uri,
  isActive,
  isScreenActive = true,
  variant = 'card',
  height,
  contentFit,
  showNativeControls,
  showMinimalControls,
  minimalControlsPersistent,
  minimalControlsBottomInset,
  inactivePauseDelayMs,
  autoPlayEnabled,
  allowTapToToggle = false,
  resetOnDeactivate = false,
  holdFastForwardRate,
  onPlaybackEnd,
}: VideoPlayerProps) {
  const canMountNativePlayer = typeof uri === 'string' && uri.length > 0;

  if (!canMountNativePlayer) {
    return (
      <InactiveVideoPlayerShell
        variant={variant}
        height={height}
      />
    );
  }

  return (
    <VideoPlayerNative
      uri={uri}
      isActive={isActive}
      isScreenActive={isScreenActive}
      variant={variant}
      height={height}
      contentFit={contentFit}
      showNativeControls={showNativeControls}
      showMinimalControls={showMinimalControls}
      minimalControlsPersistent={minimalControlsPersistent}
      minimalControlsBottomInset={minimalControlsBottomInset}
      inactivePauseDelayMs={inactivePauseDelayMs}
      autoPlayEnabled={autoPlayEnabled}
      allowTapToToggle={allowTapToToggle}
      resetOnDeactivate={resetOnDeactivate}
      holdFastForwardRate={holdFastForwardRate}
      onPlaybackEnd={onPlaybackEnd}
    />
  );
}

type InactiveVideoPlayerShellProps = Pick<VideoPlayerProps, 'variant' | 'height'>;

function InactiveVideoPlayerShell({ variant = 'card', height }: InactiveVideoPlayerShellProps) {
  const { palette } = useTheme();
  const isImmersive = variant === 'immersive';

  return (
    <View
      style={[
        isImmersive ? styles.immersiveContainer : styles.container,
        { backgroundColor: palette.surface },
        typeof height === 'number' ? { height } : null,
      ]}
    >
      <View style={isImmersive ? styles.videoImmersive : styles.videoCard} />
    </View>
  );
}

function VideoPlayerNative({
  uri,
  isActive,
  isScreenActive = true,
  variant = 'card',
  height,
  contentFit,
  showNativeControls,
  showMinimalControls,
  minimalControlsPersistent,
  minimalControlsBottomInset,
  inactivePauseDelayMs,
  autoPlayEnabled,
  allowTapToToggle = false,
  resetOnDeactivate = false,
  holdFastForwardRate = DEFAULT_HOLD_FAST_FORWARD_RATE,
  onPlaybackEnd,
}: VideoPlayerProps) {
  const { palette } = useTheme();
  const defaultAutoPlayVideos = useAppSettingsStore((state) => state.autoPlayVideos);
  const autoPlayVideos = autoPlayEnabled ?? defaultAutoPlayVideos;
  const isImmersive = variant === 'immersive';
  const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isCustomFullscreen, setIsCustomFullscreen] = React.useState(false);
  const [manualPaused, setManualPaused] = React.useState<boolean | null>(null);
  const [tapFeedbackIcon, setTapFeedbackIcon] = React.useState<'pause' | 'play' | null>(null);
  const [areMinimalControlsVisible, setAreMinimalControlsVisible] = React.useState(false);
  const [durationSec, setDurationSec] = React.useState(0);
  const [positionSec, setPositionSec] = React.useState(0);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [scrubPreviewSec, setScrubPreviewSec] = React.useState(0);
  const pauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekTrackWidthRef = React.useRef(0);
  const seekTrackLeftRef = React.useRef(0);
  const isScrubbingRef = React.useRef(false);
  const scrubPreviewSecRef = React.useRef(0);
  const tapFeedbackOpacity = React.useRef(new Animated.Value(0)).current;
  const tapFeedbackScale = React.useRef(new Animated.Value(0.84)).current;
  const tapOverlayWidthRef = React.useRef(0);
  const holdFastForwardTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingFastForwardRef = React.useRef(false);
  const suppressTapToggleRef = React.useRef(false);
  const minimalControlsOpacity = React.useRef(new Animated.Value(0)).current;
  const minimalControlsHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const areMinimalControlsVisibleRef = React.useRef(false);
  const videoViewRef = React.useRef<VideoView>(null);
  const appStateRef = React.useRef<AppStateStatus>(appState);
  const isActiveRef = React.useRef(isActive);
  const isScreenActiveRef = React.useRef(isScreenActive);
  const isFullscreenRef = React.useRef(isFullscreen);
  const manualPausedRef = React.useRef<boolean | null>(manualPaused);
  const lastKnownPlayingRef = React.useRef(false);
  const postFullscreenStateRef = React.useRef<boolean | null>(null);
  const resumeAfterForcedPauseUntilRef = React.useRef(0);
  const shouldForcePostFullscreenState = isImmersive;
  const shouldShowMinimalControls = !isImmersive && Boolean(showMinimalControls);
  const keepMinimalControlsVisible = shouldShowMinimalControls && Boolean(minimalControlsPersistent);
  const canUseHoldFastForward = isImmersive && allowTapToToggle;
  const effectiveHoldFastForwardRate =
    Number.isFinite(holdFastForwardRate) && holdFastForwardRate > 1
      ? holdFastForwardRate
      : DEFAULT_HOLD_FAST_FORWARD_RATE;

  const clearMinimalControlsHideTimer = React.useCallback(() => {
    if (minimalControlsHideTimerRef.current) {
      clearTimeout(minimalControlsHideTimerRef.current);
      minimalControlsHideTimerRef.current = null;
    }
  }, []);

  const setMinimalControlsVisible = React.useCallback(
    (visible: boolean) => {
      if (!shouldShowMinimalControls) return;

      areMinimalControlsVisibleRef.current = visible;
      setAreMinimalControlsVisible((prev) => (prev === visible ? prev : visible));
      minimalControlsOpacity.stopAnimation();
      Animated.timing(minimalControlsOpacity, {
        toValue: visible ? 1 : 0,
        duration: CONTROLS_FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    },
    [minimalControlsOpacity, shouldShowMinimalControls]
  );

  const scheduleMinimalControlsAutoHide = React.useCallback(
    (delayMs: number = CONTROLS_AUTO_HIDE_MS) => {
      if (!shouldShowMinimalControls || keepMinimalControlsVisible) return;
      clearMinimalControlsHideTimer();
      minimalControlsHideTimerRef.current = setTimeout(() => {
        minimalControlsHideTimerRef.current = null;
        if (isScrubbingRef.current) {
          scheduleMinimalControlsAutoHide(500);
          return;
        }
        setMinimalControlsVisible(false);
      }, delayMs);
    },
    [
      clearMinimalControlsHideTimer,
      keepMinimalControlsVisible,
      setMinimalControlsVisible,
      shouldShowMinimalControls,
    ]
  );

  const revealMinimalControls = React.useCallback(
    (autoHide: boolean = true) => {
      if (!shouldShowMinimalControls) return;
      setMinimalControlsVisible(true);
      if (autoHide && !keepMinimalControlsVisible) {
        scheduleMinimalControlsAutoHide();
      } else {
        clearMinimalControlsHideTimer();
      }
    },
    [
      clearMinimalControlsHideTimer,
      keepMinimalControlsVisible,
      scheduleMinimalControlsAutoHide,
      setMinimalControlsVisible,
      shouldShowMinimalControls,
    ]
  );

  const hideMinimalControls = React.useCallback(() => {
    if (!shouldShowMinimalControls || keepMinimalControlsVisible) return;
    clearMinimalControlsHideTimer();
    setMinimalControlsVisible(false);
  }, [
    clearMinimalControlsHideTimer,
    keepMinimalControlsVisible,
    setMinimalControlsVisible,
    shouldShowMinimalControls,
  ]);

  const videoPlayer = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;
    playerInstance.muted = false;
  });

  useEffect(() => {
    appStateRef.current = appState;
    isActiveRef.current = isActive;
    isScreenActiveRef.current = isScreenActive;
    isFullscreenRef.current = isFullscreen;
    manualPausedRef.current = manualPaused;
  }, [appState, isActive, isScreenActive, isFullscreen, manualPaused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = videoPlayer.addListener('playingChange', ({ isPlaying }) => {
        lastKnownPlayingRef.current = isPlaying;
        // Once fullscreen state has been restored, do not keep forcing it.
        if (
          shouldForcePostFullscreenState &&
          !isFullscreenRef.current &&
          postFullscreenStateRef.current !== null
        ) {
          postFullscreenStateRef.current = null;
        }
      });
    } catch (error) {
      if (isReleasedPlayerError(error)) {
        logPlayerError('playing listener setup', uri, error);
      } else {
        throw error;
      }
    }

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        if (isReleasedPlayerError(error)) {
          logPlayerError('playing listener cleanup', uri, error);
        } else {
          throw error;
        }
      }
    };
  }, [shouldForcePostFullscreenState, uri, videoPlayer]);

  useEffect(() => {
    if (!onPlaybackEnd) return;

    let subscription: { remove: () => void } | null = null;
    try {
      subscription = videoPlayer.addListener('playToEnd', () => {
        if (!isActiveRef.current || !isScreenActiveRef.current) return;
        if (appStateRef.current === 'background') return;
        onPlaybackEnd();
      });
    } catch (error) {
      if (isReleasedPlayerError(error)) {
        logPlayerError('playToEnd listener setup', uri, error);
      } else {
        throw error;
      }
    }

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        if (isReleasedPlayerError(error)) {
          logPlayerError('playToEnd listener cleanup', uri, error);
        } else {
          throw error;
        }
      }
    };
  }, [onPlaybackEnd, uri, videoPlayer]);

  useEffect(() => {
    return () => {
      clearMinimalControlsHideTimer();
      if (holdFastForwardTimerRef.current) {
        clearTimeout(holdFastForwardTimerRef.current);
        holdFastForwardTimerRef.current = null;
      }
      try {
        videoPlayer.playbackRate = 1;
      } catch {
        // no-op on unmount for already released players
      }
      try {
        videoPlayer.pause();
      } catch {
        // no-op on unmount for already released players
      }
    };
  }, [clearMinimalControlsHideTimer, videoPlayer]);

  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    postFullscreenStateRef.current = null;
    setIsCustomFullscreen(false);
    setManualPaused(null);
    setDurationSec(0);
    setPositionSec(0);
    setIsScrubbing(false);
    setScrubPreviewSec(0);
    isScrubbingRef.current = false;
    scrubPreviewSecRef.current = 0;
    clearMinimalControlsHideTimer();
    areMinimalControlsVisibleRef.current = false;
    setAreMinimalControlsVisible(false);
    minimalControlsOpacity.setValue(0);
  }, [clearMinimalControlsHideTimer, minimalControlsOpacity, uri]);

  const previousIsActiveRef = React.useRef(isActive);
  useEffect(() => {
    const wasActive = previousIsActiveRef.current;
    previousIsActiveRef.current = isActive;
    if (!resetOnDeactivate || !wasActive || isActive) return;

    setPositionSec(0);
    setScrubPreviewSec(0);
    scrubPreviewSecRef.current = 0;
    try {
      videoPlayer.currentTime = 0;
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
      if (__DEV__) {
        console.debug('[video] reset-on-deactivate skipped for released player', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [isActive, resetOnDeactivate, uri, videoPlayer]);

  useEffect(() => {
    if (!shouldShowMinimalControls) {
      clearMinimalControlsHideTimer();
      areMinimalControlsVisibleRef.current = false;
      setAreMinimalControlsVisible(false);
      minimalControlsOpacity.setValue(0);
      try {
        videoPlayer.timeUpdateEventInterval = 0;
      } catch (error) {
        if (isReleasedPlayerError(error)) {
          logPlayerError('timeUpdate interval disable', uri, error);
        } else {
          throw error;
        }
      }
      return;
    }

    try {
      videoPlayer.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SECONDS;
      setDurationSec(normalizeSeconds(videoPlayer.duration));
      setPositionSec(videoPlayer.currentTime > 0 ? videoPlayer.currentTime : 0);
    } catch (error) {
      if (isReleasedPlayerError(error)) {
        logPlayerError('timeUpdate interval setup', uri, error);
        return;
      }
      throw error;
    }

    let timeSub: { remove: () => void } | null = null;
    let sourceLoadSub: { remove: () => void } | null = null;
    try {
      timeSub = videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
        if (isScrubbingRef.current) return;
        setPositionSec(currentTime > 0 ? currentTime : 0);
        try {
          const nextDuration = normalizeSeconds(videoPlayer.duration);
          if (nextDuration > 0) {
            setDurationSec(nextDuration);
          }
        } catch (error) {
          if (isReleasedPlayerError(error)) {
            logPlayerError('timeUpdate event', uri, error);
            return;
          }
          throw error;
        }
      });

      sourceLoadSub = videoPlayer.addListener('sourceLoad', ({ duration }) => {
        const nextDuration = normalizeSeconds(duration);
        if (nextDuration > 0) {
          setDurationSec(nextDuration);
        }
      });
    } catch (error) {
      if (isReleasedPlayerError(error)) {
        logPlayerError('timeUpdate listener setup', uri, error);
      } else {
        throw error;
      }
    }

    return () => {
      try {
        timeSub?.remove();
        sourceLoadSub?.remove();
      } catch (error) {
        if (isReleasedPlayerError(error)) {
          logPlayerError('timeUpdate listener cleanup', uri, error);
        } else {
          throw error;
        }
      }
      try {
        videoPlayer.timeUpdateEventInterval = 0;
      } catch (error) {
        if (isReleasedPlayerError(error)) {
          logPlayerError('timeUpdate interval cleanup', uri, error);
        } else {
          throw error;
        }
      }
    };
  }, [
    clearMinimalControlsHideTimer,
    minimalControlsOpacity,
    shouldShowMinimalControls,
    uri,
    videoPlayer,
  ]);

  useEffect(() => {
    if (!shouldShowMinimalControls) return;
    if (keepMinimalControlsVisible) {
      if (!isActive || !isScreenActive || appState === 'background') {
        clearMinimalControlsHideTimer();
        areMinimalControlsVisibleRef.current = false;
        setAreMinimalControlsVisible(false);
        minimalControlsOpacity.stopAnimation();
        minimalControlsOpacity.setValue(0);
        return;
      }

      clearMinimalControlsHideTimer();
      areMinimalControlsVisibleRef.current = true;
      setAreMinimalControlsVisible(true);
      minimalControlsOpacity.stopAnimation();
      minimalControlsOpacity.setValue(1);
      return;
    }

    if (!isActive || !isScreenActive || appState === 'background') {
      hideMinimalControls();
      return;
    }
    if (areMinimalControlsVisibleRef.current) {
      scheduleMinimalControlsAutoHide();
    }
  }, [
    appState,
    clearMinimalControlsHideTimer,
    hideMinimalControls,
    isActive,
    isScreenActive,
    keepMinimalControlsVisible,
    minimalControlsOpacity,
    scheduleMinimalControlsAutoHide,
    shouldShowMinimalControls,
  ]);

  useEffect(() => {
    if (!shouldShowMinimalControls) return;
    if (isCustomFullscreen) {
      revealMinimalControls(true);
    }
  }, [isCustomFullscreen, revealMinimalControls, shouldShowMinimalControls]);

  useEffect(() => {
    const pauseNow = () => {
      try {
        const wasPlaying = lastKnownPlayingRef.current;
        if (wasPlaying) {
          resumeAfterForcedPauseUntilRef.current = Date.now() + FULLSCREEN_RESUME_WINDOW_MS;
        } else {
          resumeAfterForcedPauseUntilRef.current = 0;
        }
        videoPlayer.pause();
      } catch (error) {
        // Passive pauses frequently race with native teardown during list virtualization.
        // Do not remount the player for this path; just ignore released-player errors.
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
      const defaultDelayMs = !isActive && isScreenActive
        ? VIEWABILITY_LOSS_PAUSE_DELAY_MS
        : SCREEN_LOSS_PAUSE_DELAY_MS;
      const delayMs = typeof inactivePauseDelayMs === 'number'
        ? Math.max(0, inactivePauseDelayMs)
        : defaultDelayMs;
      schedulePause(delayMs);
      return;
    }

    clearPauseTimer();

    try {
      if (shouldForcePostFullscreenState && postFullscreenStateRef.current !== null) {
        if (postFullscreenStateRef.current) {
          videoPlayer.play();
        } else {
          videoPlayer.pause();
        }
      } else if (manualPaused === true) {
        videoPlayer.pause();
      } else if (manualPaused === false) {
        videoPlayer.play();
      } else if (autoPlayVideos) {
        videoPlayer.play();
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
    inactivePauseDelayMs,
    manualPaused,
    isActive,
    isScreenActive,
    isFullscreen,
    shouldForcePostFullscreenState,
    videoPlayer,
    uri,
  ]);

  const runTapFeedback = React.useCallback((icon: 'pause' | 'play') => {
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
  }, [tapFeedbackOpacity, tapFeedbackScale]);

  const handleTogglePlayback = React.useCallback(() => {
    if (!allowTapToToggle) return;
    if (!isActive || !isScreenActive) return;

    const isPlaying = manualPaused === null ? lastKnownPlayingRef.current : !manualPaused;
    const nextPaused = isPlaying;
    setManualPaused(nextPaused);
    runTapFeedback(nextPaused ? 'pause' : 'play');
    try {
      if (nextPaused) {
        videoPlayer.pause();
      } else {
        videoPlayer.play();
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
  }, [allowTapToToggle, isActive, isScreenActive, manualPaused, videoPlayer, runTapFeedback, uri]);

  const clearHoldFastForwardTimer = React.useCallback(() => {
    if (!holdFastForwardTimerRef.current) return;
    clearTimeout(holdFastForwardTimerRef.current);
    holdFastForwardTimerRef.current = null;
  }, []);

  const stopHoldFastForward = React.useCallback(() => {
    clearHoldFastForwardTimer();
    if (!isHoldingFastForwardRef.current) return;
    isHoldingFastForwardRef.current = false;
    try {
      videoPlayer.playbackRate = 1;
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
      if (__DEV__) {
        console.debug('[video] hold-fast-forward stop skipped for released player', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [clearHoldFastForwardTimer, uri, videoPlayer]);

  useEffect(() => {
    if (isActive && isScreenActive && appState !== 'background') return;
    stopHoldFastForward();
  }, [appState, isActive, isScreenActive, stopHoldFastForward]);

  const handleTapOverlayPressIn = React.useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      suppressTapToggleRef.current = false;
      if (!canUseHoldFastForward) return;
      if (!isActive || !isScreenActive) return;
      if (manualPausedRef.current === true) return;

      const overlayWidth = tapOverlayWidthRef.current;
      const locationX = event.nativeEvent.locationX;
      if (overlayWidth <= 0 || locationX < overlayWidth * HOLD_FAST_FORWARD_RIGHT_SIDE_RATIO) {
        return;
      }

      clearHoldFastForwardTimer();
      holdFastForwardTimerRef.current = setTimeout(() => {
        holdFastForwardTimerRef.current = null;
        if (!isActiveRef.current || !isScreenActiveRef.current) return;
        if (appStateRef.current === 'background') return;
        if (manualPausedRef.current === true) return;
        isHoldingFastForwardRef.current = true;
        suppressTapToggleRef.current = true;
        try {
          videoPlayer.playbackRate = effectiveHoldFastForwardRate;
        } catch (error) {
          if (isReleasedPlayerError(error)) return;
          if (__DEV__) {
            console.debug('[video] hold-fast-forward start skipped for released player', {
              uri,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }, HOLD_FAST_FORWARD_DELAY_MS);
    },
    [
      canUseHoldFastForward,
      clearHoldFastForwardTimer,
      effectiveHoldFastForwardRate,
      isActive,
      isScreenActive,
      uri,
      videoPlayer,
    ]
  );

  const handleTapOverlayPressOut = React.useCallback(() => {
    stopHoldFastForward();
  }, [stopHoldFastForward]);

  const handleTapOverlayPress = React.useCallback(() => {
    if (isHoldingFastForwardRef.current || suppressTapToggleRef.current) {
      suppressTapToggleRef.current = false;
      return;
    }
    handleTogglePlayback();
  }, [handleTogglePlayback]);

  const handleControlTogglePlayback = React.useCallback(() => {
    if (!isActive || !isScreenActive) return;
    revealMinimalControls(true);

    const isPlaying = manualPaused === null ? lastKnownPlayingRef.current : !manualPaused;
    const nextPaused = isPlaying;
    setManualPaused(nextPaused);
    try {
      if (nextPaused) {
        videoPlayer.pause();
      } else {
        videoPlayer.play();
      }
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
      if (__DEV__) {
        console.debug('[video] control-toggle skipped for released player', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [isActive, isScreenActive, manualPaused, revealMinimalControls, videoPlayer, uri]);

  const commitSeek = React.useCallback((nextTimeSec: number) => {
    const safeDuration = durationSec;
    if (safeDuration <= 0) return;

    const clamped = Math.max(0, Math.min(safeDuration, nextTimeSec));
    setPositionSec(clamped);
    setScrubPreviewSec(clamped);
    scrubPreviewSecRef.current = clamped;
    try {
      videoPlayer.currentTime = clamped;
    } catch (error) {
      if (isReleasedPlayerError(error)) return;
      if (__DEV__) {
        console.debug('[video] seek skipped for released player', {
          uri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [durationSec, videoPlayer, uri]);

  const updateSeekPreviewFromX = React.useCallback(
    (locationX: number) => {
      const width = seekTrackWidthRef.current;
      const safeDuration = durationSec;
      if (width <= 0 || safeDuration <= 0) return null;

      const ratio = Math.max(0, Math.min(1, locationX / width));
      const nextTimeSec = safeDuration * ratio;
      setScrubPreviewSec(nextTimeSec);
      scrubPreviewSecRef.current = nextTimeSec;
      return nextTimeSec;
    },
    [durationSec]
  );

  const updateSeekPreviewFromAbsoluteX = React.useCallback(
    (pageX: number) => {
      const trackLeft = seekTrackLeftRef.current;
      return updateSeekPreviewFromX(pageX - trackLeft);
    },
    [updateSeekPreviewFromX]
  );

  const seekPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          seekTrackLeftRef.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
          isScrubbingRef.current = true;
          setIsScrubbing(true);
          revealMinimalControls(false);
          updateSeekPreviewFromAbsoluteX(event.nativeEvent.pageX);
        },
        onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
          updateSeekPreviewFromAbsoluteX(gestureState.moveX);
        },
        onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
          const nextTimeSec = updateSeekPreviewFromAbsoluteX(gestureState.moveX);
          isScrubbingRef.current = false;
          setIsScrubbing(false);
          if (typeof nextTimeSec === 'number') {
            commitSeek(nextTimeSec);
          }
          scheduleMinimalControlsAutoHide();
        },
        onPanResponderTerminate: (_, gestureState: PanResponderGestureState) => {
          const nextTimeSec = updateSeekPreviewFromAbsoluteX(gestureState.moveX);
          isScrubbingRef.current = false;
          setIsScrubbing(false);
          if (typeof nextTimeSec === 'number') {
            commitSeek(nextTimeSec);
          } else {
            commitSeek(scrubPreviewSecRef.current);
          }
          scheduleMinimalControlsAutoHide();
        },
      }),
    [
      commitSeek,
      revealMinimalControls,
      scheduleMinimalControlsAutoHide,
      updateSeekPreviewFromAbsoluteX,
    ]
  );

  const displayedPositionSec = isScrubbing ? scrubPreviewSec : positionSec;
  const displayedDurationSec = durationSec;
  const progressRatio = displayedDurationSec > 0
    ? Math.max(0, Math.min(1, displayedPositionSec / displayedDurationSec))
    : 0;
  const isPlayingNow = manualPaused === null ? lastKnownPlayingRef.current : !manualPaused;
  const shouldUseCustomFullscreen = shouldShowMinimalControls;
  const videoSurfaceStyle =
    isImmersive || typeof height === 'number' ? styles.videoImmersive : styles.videoCard;

  const enterCustomFullscreen = React.useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    postFullscreenStateRef.current = null;
    setIsFullscreen(true);
    setIsCustomFullscreen(true);
    revealMinimalControls(true);
    try {
      videoPlayer.play();
      setManualPaused(false);
    } catch {
      // no-op: transient state while mounting fullscreen view
    }
  }, [revealMinimalControls, videoPlayer]);

  const exitCustomFullscreen = React.useCallback(() => {
    postFullscreenStateRef.current = shouldForcePostFullscreenState
      ? lastKnownPlayingRef.current
      : null;
    setIsCustomFullscreen(false);
    setIsFullscreen(false);
    revealMinimalControls(true);
  }, [revealMinimalControls, shouldForcePostFullscreenState]);

  const handleFullscreenToggle = React.useCallback(() => {
    revealMinimalControls(true);
    if (shouldUseCustomFullscreen) {
      if (isCustomFullscreen) {
        exitCustomFullscreen();
      } else {
        enterCustomFullscreen();
      }
      return;
    }
    void videoViewRef.current?.enterFullscreen();
  }, [
    enterCustomFullscreen,
    exitCustomFullscreen,
    isCustomFullscreen,
    revealMinimalControls,
    shouldUseCustomFullscreen,
  ]);

  const handleMinimalControlsOverlayPress = React.useCallback(() => {
    if (!shouldShowMinimalControls) return;
    if (!isActive || !isScreenActive) return;
    if (keepMinimalControlsVisible) return;

    if (areMinimalControlsVisibleRef.current) {
      hideMinimalControls();
      return;
    }
    revealMinimalControls(true);
  }, [
    hideMinimalControls,
    isActive,
    isScreenActive,
    keepMinimalControlsVisible,
    revealMinimalControls,
    shouldShowMinimalControls,
  ]);

  return (
    <View
      style={[
        isImmersive ? styles.immersiveContainer : styles.container,
        { backgroundColor: palette.surface },
        typeof height === 'number' ? { height } : null,
      ]}
    >
      {isCustomFullscreen ? (
        <View style={[videoSurfaceStyle, styles.fullscreenPlaceholder]} />
      ) : (
        <VideoView
          ref={videoViewRef}
          style={videoSurfaceStyle}
          player={videoPlayer}
          contentFit={contentFit ?? (isImmersive ? 'cover' : 'cover')}
          nativeControls={showNativeControls ?? (!isImmersive && !shouldShowMinimalControls)}
          onFullscreenEnter={() => {
            if (pauseTimerRef.current) {
              clearTimeout(pauseTimerRef.current);
              pauseTimerRef.current = null;
            }
            postFullscreenStateRef.current = null;
            setIsFullscreen(true);
            const shouldResumeAfterTransition = shouldForcePostFullscreenState
              ? (
                resumeAfterForcedPauseUntilRef.current > Date.now() ||
                lastKnownPlayingRef.current ||
                manualPaused === false
              )
              : true;
            resumeAfterForcedPauseUntilRef.current = 0;
            if (shouldResumeAfterTransition) {
              try {
                // Card-mode fullscreen can be triggered while list viewability has paused playback.
                // Force a resume to avoid blank fullscreen with only native controls.
                videoPlayer.play();
                if (!shouldForcePostFullscreenState) {
                  setManualPaused(false);
                }
              } catch {
                // no-op: transient native fullscreen transition
              }
            }
          }}
          onFullscreenExit={() => {
            postFullscreenStateRef.current = shouldForcePostFullscreenState
              ? lastKnownPlayingRef.current
              : null;
            setIsFullscreen(false);
          }}
        />
      )}
      {shouldShowMinimalControls && !isCustomFullscreen ? (
        <Pressable
          style={styles.minimalControlsTapArea}
          onPress={handleMinimalControlsOverlayPress}
          accessibilityRole="button"
          accessibilityLabel="Toggle video controls"
        />
      ) : null}
      {shouldShowMinimalControls && !isCustomFullscreen ? (
        <Animated.View
          pointerEvents={areMinimalControlsVisible ? 'auto' : 'none'}
          style={[
            styles.minimalControls,
            {
              backgroundColor: withAlpha(palette.overlay, 0.78),
              borderColor: withAlpha(palette.border, 0.45),
              bottom: typeof minimalControlsBottomInset === 'number' ? minimalControlsBottomInset : 12,
              opacity: minimalControlsOpacity,
            },
          ]}
        >
          <View style={styles.minimalControlsRow}>
            <Pressable
              onPress={handleControlTogglePlayback}
              style={({ pressed }) => [
                styles.minimalIconButton,
                { backgroundColor: withAlpha(palette.mediaControl, pressed ? 0.45 : 0.32) },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPlayingNow ? 'Pause video' : 'Play video'}
            >
              <Ionicons
                name={isPlayingNow ? 'pause' : 'play'}
                size={20}
                color={palette.mediaControlText}
              />
            </Pressable>
            <View style={styles.seekWrap}>
              <View
                style={styles.seekTrackTouchArea}
                onLayout={(event) => {
                  seekTrackWidthRef.current = event.nativeEvent.layout.width;
                }}
                {...seekPanResponder.panHandlers}
              >
                <View
                  style={[
                    styles.seekTrack,
                    {
                      backgroundColor: withAlpha(palette.mediaControlText, 0.28),
                    },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.seekFill,
                      {
                        width: `${progressRatio * 100}%`,
                        backgroundColor: palette.accent,
                      },
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.seekThumb,
                      {
                        left: `${progressRatio * 100}%`,
                        backgroundColor: palette.mediaControlText,
                      },
                    ]}
                  />
                </View>
              </View>
              <AppText variant="caption" style={styles.seekTimeText}>
                {`${formatVideoTime(displayedPositionSec)} / ${formatVideoTime(displayedDurationSec)}`}
              </AppText>
            </View>
            <Pressable
              onPress={handleFullscreenToggle}
              style={({ pressed }) => [
                styles.minimalIconButton,
                { backgroundColor: withAlpha(palette.mediaControl, pressed ? 0.45 : 0.32) },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fullscreen"
            >
              <Ionicons
                name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                size={20}
                color={palette.mediaControlText}
              />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {allowTapToToggle && !isCustomFullscreen ? (
        <Pressable
          style={styles.tapOverlay}
          onLayout={(event) => {
            tapOverlayWidthRef.current = event.nativeEvent.layout.width;
          }}
          onPressIn={handleTapOverlayPressIn}
          onPressOut={handleTapOverlayPressOut}
          onPress={handleTapOverlayPress}
        />
      ) : null}
      {allowTapToToggle && !isCustomFullscreen && tapFeedbackIcon ? (
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
      {shouldUseCustomFullscreen ? (
        <Modal
          visible={isCustomFullscreen}
          transparent={false}
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={exitCustomFullscreen}
        >
          <View style={[styles.customFullscreenRoot, { backgroundColor: palette.mediaBackground }]}>
            <VideoView
              style={styles.customFullscreenVideo}
              player={videoPlayer}
              contentFit={contentFit ?? 'contain'}
              nativeControls={false}
            />
            <Pressable
              style={styles.minimalControlsTapArea}
              onPress={handleMinimalControlsOverlayPress}
              accessibilityRole="button"
              accessibilityLabel="Toggle video controls"
            />
            <Animated.View
              pointerEvents={areMinimalControlsVisible ? 'auto' : 'none'}
              style={[
                styles.minimalControls,
                styles.minimalControlsFullscreen,
                {
                  backgroundColor: withAlpha(palette.overlay, 0.78),
                  borderColor: withAlpha(palette.border, 0.45),
                  bottom: typeof minimalControlsBottomInset === 'number' ? minimalControlsBottomInset : 20,
                  opacity: minimalControlsOpacity,
                },
              ]}
            >
              <View style={styles.minimalControlsRow}>
                <Pressable
                  onPress={handleControlTogglePlayback}
                  style={({ pressed }) => [
                    styles.minimalIconButton,
                    { backgroundColor: withAlpha(palette.mediaControl, pressed ? 0.45 : 0.32) },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={isPlayingNow ? 'Pause video' : 'Play video'}
                >
                  <Ionicons
                    name={isPlayingNow ? 'pause' : 'play'}
                    size={20}
                    color={palette.mediaControlText}
                  />
                </Pressable>
                <View style={styles.seekWrap}>
                  <View
                    style={styles.seekTrackTouchArea}
                    onLayout={(event) => {
                      seekTrackWidthRef.current = event.nativeEvent.layout.width;
                    }}
                    {...seekPanResponder.panHandlers}
                  >
                    <View
                      style={[
                        styles.seekTrack,
                        {
                          backgroundColor: withAlpha(palette.mediaControlText, 0.28),
                        },
                      ]}
                    >
                      <View
                        pointerEvents="none"
                        style={[
                          styles.seekFill,
                          {
                            width: `${progressRatio * 100}%`,
                            backgroundColor: palette.accent,
                          },
                        ]}
                      />
                      <View
                        pointerEvents="none"
                        style={[
                          styles.seekThumb,
                          {
                            left: `${progressRatio * 100}%`,
                            backgroundColor: palette.mediaControlText,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <AppText variant="caption" style={styles.seekTimeText}>
                    {`${formatVideoTime(displayedPositionSec)} / ${formatVideoTime(displayedDurationSec)}`}
                  </AppText>
                </View>
                <Pressable
                  onPress={handleFullscreenToggle}
                  style={({ pressed }) => [
                    styles.minimalIconButton,
                    { backgroundColor: withAlpha(palette.mediaControl, pressed ? 0.45 : 0.32) },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Fullscreen"
                >
                  <Ionicons
                    name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                    size={20}
                    color={palette.mediaControlText}
                  />
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
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
  fullscreenPlaceholder: {
    backgroundColor: '#000000',
  },
  customFullscreenRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  customFullscreenVideo: {
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
  minimalControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  minimalControlsTapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  minimalControlsFullscreen: {
    bottom: 20,
  },
  minimalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  minimalIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekWrap: {
    flex: 1,
    gap: 4,
  },
  seekTrackTouchArea: {
    height: 24,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'visible',
    justifyContent: 'center',
  },
  seekFill: {
    height: '100%',
    borderRadius: 999,
  },
  seekThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -3,
    marginLeft: -6,
  },
  seekTimeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
  },
});
