import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type UseAutoHideControlsOnScrollOptions = {
  graceMs?: number;
};

export function useAutoHideControlsOnScroll(options: UseAutoHideControlsOnScrollOptions = {}) {
  const { graceMs = 3000 } = options;
  const [isVisible, setIsVisible] = useState(true);

  const isInputFocusedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isMomentumRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const setVisibility = useCallback((nextVisible: boolean) => {
    if (isVisibleRef.current === nextVisible) return;
    isVisibleRef.current = nextVisible;
    setIsVisible(nextVisible);
  }, []);

  const showControls = useCallback(() => {
    clearHideTimer();
    setVisibility(true);
  }, [clearHideTimer, setVisibility]);

  const hideControls = useCallback(() => {
    if (isInputFocusedRef.current) return;
    clearHideTimer();
    setVisibility(false);
  }, [clearHideTimer, setVisibility]);

  const scheduleHide = useCallback(() => {
    if (isInputFocusedRef.current) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (
        !isInputFocusedRef.current &&
        !isDraggingRef.current &&
        !isMomentumRef.current
      ) {
        setVisibility(false);
      }
    }, graceMs);
  }, [clearHideTimer, graceMs, setVisibility]);

  const onScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    isMomentumRef.current = true;
    hideControls();
  }, [hideControls]);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDraggingRef.current = false;
      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
      if (velocityY > 0.05) {
        // Momentum continues; wait for onMomentumScrollEnd.
        return;
      }
      isMomentumRef.current = false;
      showControls();
      scheduleHide();
    },
    [scheduleHide, showControls]
  );

  const onMomentumScrollBegin = useCallback(() => {
    isMomentumRef.current = true;
    hideControls();
  }, [hideControls]);

  const onMomentumScrollEnd = useCallback(() => {
    isMomentumRef.current = false;
    if (!isDraggingRef.current) {
      showControls();
      scheduleHide();
    }
  }, [scheduleHide, showControls]);

  const onScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Intentionally empty: visibility is driven by begin/end drag + momentum events
    // to avoid per-frame state churn on long lists.
  }, []);

  const setInputFocused = useCallback(
    (focused: boolean) => {
      isInputFocusedRef.current = focused;
      if (focused) {
        showControls();
        return;
      }
      if (!isDraggingRef.current && !isMomentumRef.current) {
        scheduleHide();
      }
    },
    [scheduleHide, showControls]
  );

  const showControlsOnFocus = useCallback(() => {
    isDraggingRef.current = false;
    isMomentumRef.current = false;
    showControls();
  }, [showControls]);

  useEffect(
    () => () => {
      clearHideTimer();
    },
    [clearHideTimer]
  );

  return {
    isVisible,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    setInputFocused,
    showControlsOnFocus,
  };
}
