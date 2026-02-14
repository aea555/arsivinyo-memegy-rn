import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type FloatingSearchControlsMode = 'expanded' | 'collapsed' | 'focused';

type UseFloatingSearchControlsOptions = {
  collapseOffsetY?: number;
  collapseDelta?: number;
  expandDelta?: number;
  nearTopOffsetY?: number;
  animationDurationMs?: number;
};

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

type UseFloatingSearchControlsResult = {
  mode: FloatingSearchControlsMode;
  onScroll: ScrollHandler;
  onScrollBeginDrag: ScrollHandler;
  onScrollEndDrag: ScrollHandler;
  onMomentumScrollBegin: ScrollHandler;
  onMomentumScrollEnd: ScrollHandler;
  onInputFocus: () => void;
  onInputBlur: () => void;
  expand: () => void;
  collapse: () => void;
  expandedAnimatedStyle: {
    opacity: Animated.AnimatedInterpolation<number> | Animated.Value;
    transform: { translateY: Animated.AnimatedInterpolation<number> }[];
  };
  collapsedAnimatedStyle: {
    opacity: Animated.AnimatedInterpolation<number>;
    transform: { translateY: Animated.AnimatedInterpolation<number> }[];
  };
};

const DEFAULTS = {
  collapseOffsetY: 40,
  collapseDelta: 24,
  expandDelta: 16,
  nearTopOffsetY: 12,
  animationDurationMs: 200,
} as const;

export function useFloatingSearchControls(
  options: UseFloatingSearchControlsOptions = {}
): UseFloatingSearchControlsResult {
  const collapseOffsetY = options.collapseOffsetY ?? DEFAULTS.collapseOffsetY;
  const collapseDelta = options.collapseDelta ?? DEFAULTS.collapseDelta;
  const expandDelta = options.expandDelta ?? DEFAULTS.expandDelta;
  const nearTopOffsetY = options.nearTopOffsetY ?? DEFAULTS.nearTopOffsetY;
  const animationDurationMs = options.animationDurationMs ?? DEFAULTS.animationDurationMs;

  const [mode, setMode] = useState<FloatingSearchControlsMode>('expanded');
  const modeRef = useRef<FloatingSearchControlsMode>('expanded');
  const isInputFocusedRef = useRef(false);
  const lastOffsetYRef = useRef(0);
  const directionRef = useRef<'up' | 'down' | null>(null);
  const accumulatedDeltaRef = useRef(0);
  const expandProgress = useRef(new Animated.Value(1)).current;

  const applyMode = useCallback(
    (nextMode: FloatingSearchControlsMode) => {
      if (modeRef.current === nextMode) return;
      modeRef.current = nextMode;
      setMode(nextMode);

      const toValue = nextMode === 'collapsed' ? 0 : 1;
      Animated.timing(expandProgress, {
        toValue,
        duration: animationDurationMs,
        useNativeDriver: true,
      }).start();
    },
    [animationDurationMs, expandProgress]
  );

  const resetDirectionTracking = useCallback(() => {
    directionRef.current = null;
    accumulatedDeltaRef.current = 0;
  }, []);

  const expand = useCallback(() => {
    applyMode(isInputFocusedRef.current ? 'focused' : 'expanded');
    resetDirectionTracking();
  }, [applyMode, resetDirectionTracking]);

  const collapse = useCallback(() => {
    if (isInputFocusedRef.current) return;
    applyMode('collapsed');
    resetDirectionTracking();
  }, [applyMode, resetDirectionTracking]);

  const onInputFocus = useCallback(() => {
    isInputFocusedRef.current = true;
    applyMode('focused');
    resetDirectionTracking();
  }, [applyMode, resetDirectionTracking]);

  const onInputBlur = useCallback(() => {
    isInputFocusedRef.current = false;
    applyMode('expanded');
    resetDirectionTracking();
  }, [applyMode, resetDirectionTracking]);

  const handleScrollOffset = useCallback(
    (offsetY: number) => {
      const y = Math.max(0, offsetY);
      const delta = y - lastOffsetYRef.current;
      lastOffsetYRef.current = y;

      if (isInputFocusedRef.current) {
        return;
      }

      if (y <= nearTopOffsetY) {
        applyMode('expanded');
        resetDirectionTracking();
        return;
      }

      if (Math.abs(delta) < 0.5) {
        return;
      }

      const direction = delta > 0 ? 'down' : 'up';
      if (directionRef.current !== direction) {
        directionRef.current = direction;
        accumulatedDeltaRef.current = Math.abs(delta);
      } else {
        accumulatedDeltaRef.current += Math.abs(delta);
      }

      if (
        direction === 'down' &&
        y > collapseOffsetY &&
        accumulatedDeltaRef.current >= collapseDelta
      ) {
        applyMode('collapsed');
        resetDirectionTracking();
        return;
      }

      if (direction === 'up' && accumulatedDeltaRef.current >= expandDelta) {
        applyMode('expanded');
        resetDirectionTracking();
      }
    },
    [
      applyMode,
      collapseDelta,
      collapseOffsetY,
      expandDelta,
      nearTopOffsetY,
      resetDirectionTracking,
    ]
  );

  const onScroll = useCallback<ScrollHandler>(
    (event) => {
      handleScrollOffset(event.nativeEvent.contentOffset.y);
    },
    [handleScrollOffset]
  );

  const onScrollBeginDrag = useCallback<ScrollHandler>(
    (event) => {
      lastOffsetYRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
      resetDirectionTracking();
    },
    [resetDirectionTracking]
  );

  const onScrollEndDrag = useCallback<ScrollHandler>(() => {}, []);
  const onMomentumScrollBegin = useCallback<ScrollHandler>(() => {}, []);
  const onMomentumScrollEnd = useCallback<ScrollHandler>(() => {}, []);

  const expandedAnimatedStyle = useMemo(
    () => ({
      opacity: expandProgress,
      transform: [
        {
          translateY: expandProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [-10, 0],
          }),
        },
      ],
    }),
    [expandProgress]
  );

  const collapsedAnimatedStyle = useMemo(
    () => ({
      opacity: expandProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
      transform: [
        {
          translateY: expandProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
      ],
    }),
    [expandProgress]
  );

  return {
    mode,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    onInputFocus,
    onInputBlur,
    expand,
    collapse,
    expandedAnimatedStyle,
    collapsedAnimatedStyle,
  };
}
