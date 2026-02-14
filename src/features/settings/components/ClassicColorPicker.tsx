import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, PanResponderGestureState, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/src/shared/components/ui/Input';
import { AppText } from '@/src/shared/components/ui/AppText';
import { clamp, hexToHsv, hsvToHex, normalizeHexColor, withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

type ClassicColorPickerProps = {
  color: string;
  onChange: (hex: string) => void;
  onChangeEnd?: (hex: string) => void;
  showChannels?: boolean;
};

type HSV = {
  h: number;
  s: number;
  v: number;
};

const HUE_GRADIENT_COLORS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'] as const;

function ChannelSlider({
  label,
  value,
  min,
  max,
  colors,
  borderColor,
  thumbColor,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  colors: readonly [string, string, ...string[]];
  borderColor: string;
  thumbColor: string;
  onChange: (next: number) => void;
  onCommit: (next: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const ratio = (value - min) / (max - min);
  const trackLeftRef = useRef(0);

  const updateFromPosition = useCallback((x: number, commit: boolean) => {
    const next = min + (clamp(x, 0, width) / width) * (max - min);
    if (commit) {
      onCommit(next);
      return;
    }
    onChange(next);
  }, [max, min, onChange, onCommit, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          trackLeftRef.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
          updateFromPosition(event.nativeEvent.pageX - trackLeftRef.current, false);
        },
        onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
          updateFromPosition(gestureState.moveX - trackLeftRef.current, false);
        },
        onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
          updateFromPosition(gestureState.moveX - trackLeftRef.current, true);
        },
        onPanResponderTerminate: (_, gestureState: PanResponderGestureState) => {
          updateFromPosition(gestureState.moveX - trackLeftRef.current, true);
        },
      }),
    [updateFromPosition]
  );

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabelRow}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="caption">{Math.round(value)}</AppText>
      </View>
      <View
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={[styles.channelTrack, { borderColor }]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.channelThumb,
            {
              left: clamp(ratio, 0, 1) * width,
              borderColor,
              backgroundColor: thumbColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

function ClassicColorPickerComponent({ color, onChange, onChangeEnd, showChannels = true }: ClassicColorPickerProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(normalizeHexColor(color)));
  const [hexInput, setHexInput] = useState(() => normalizeHexColor(color));
  const [svSize, setSvSize] = useState({ width: 1, height: 1 });
  const [hueWidth, setHueWidth] = useState(1);
  const svOffsetRef = useRef({ x: 0, y: 0 });
  const hueOffsetRef = useRef(0);

  const hsvRef = useRef(hsv);
  const interactingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingHexRef = useRef<string>(hexInput);

  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  useEffect(() => {
    if (interactingRef.current) return;
    const normalized = normalizeHexColor(color, hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v));
    if (normalized === hexInput) return;
    setHexInput(normalized);
    setHsv(hexToHsv(normalized));
  }, [color, hexInput]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const emitColor = useCallback((hex: string, commit = false) => {
    pendingHexRef.current = hex;

    if (commit) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onChange(hex);
      onChangeEnd?.(hex);
      return;
    }

    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      onChange(pendingHexRef.current);
    });
  }, [onChange, onChangeEnd]);

  const setFromHsv = useCallback((next: HSV, commit = false) => {
    const normalized: HSV = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp(next.s, 0, 100),
      v: clamp(next.v, 0, 100),
    };

    setHsv(normalized);
    const hex = hsvToHex(normalized.h, normalized.s, normalized.v);
    setHexInput(hex);
    emitColor(hex, commit);
  }, [emitColor]);

  const updateFromSVPosition = useCallback((x: number, y: number, commit = false) => {
    const safeX = clamp(x, 0, svSize.width);
    const safeY = clamp(y, 0, svSize.height);

    const nextS = (safeX / svSize.width) * 100;
    const nextV = 100 - (safeY / svSize.height) * 100;

    setFromHsv({ h: hsvRef.current.h, s: nextS, v: nextV }, commit);
  }, [setFromHsv, svSize.height, svSize.width]);

  const updateFromHuePosition = useCallback((x: number, commit = false) => {
    const safeX = clamp(x, 0, hueWidth);
    const nextH = (safeX / hueWidth) * 360;
    setFromHsv({ h: nextH, s: hsvRef.current.s, v: hsvRef.current.v }, commit);
  }, [hueWidth, setFromHsv]);

  const commitCurrentColor = useCallback(() => {
    const current = hsvRef.current;
    const hex = hsvToHex(current.h, current.s, current.v);
    setHexInput(hex);
    emitColor(hex, true);
  }, [emitColor]);

  const svResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          interactingRef.current = true;
          svOffsetRef.current = {
            x: event.nativeEvent.pageX - event.nativeEvent.locationX,
            y: event.nativeEvent.pageY - event.nativeEvent.locationY,
          };
          updateFromSVPosition(
            event.nativeEvent.pageX - svOffsetRef.current.x,
            event.nativeEvent.pageY - svOffsetRef.current.y,
            false
          );
        },
        onPanResponderMove: (_, gestureState: PanResponderGestureState) =>
          updateFromSVPosition(
            gestureState.moveX - svOffsetRef.current.x,
            gestureState.moveY - svOffsetRef.current.y,
            false
          ),
        onPanResponderRelease: () => {
          interactingRef.current = false;
          commitCurrentColor();
        },
        onPanResponderTerminate: () => {
          interactingRef.current = false;
          commitCurrentColor();
        },
      }),
    [commitCurrentColor, updateFromSVPosition]
  );

  const hueResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          interactingRef.current = true;
          hueOffsetRef.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
          updateFromHuePosition(event.nativeEvent.pageX - hueOffsetRef.current, false);
        },
        onPanResponderMove: (_, gestureState: PanResponderGestureState) =>
          updateFromHuePosition(gestureState.moveX - hueOffsetRef.current, false),
        onPanResponderRelease: () => {
          interactingRef.current = false;
          commitCurrentColor();
        },
        onPanResponderTerminate: () => {
          interactingRef.current = false;
          commitCurrentColor();
        },
      }),
    [commitCurrentColor, updateFromHuePosition]
  );

  const huePure = hsvToHex(hsv.h, 100, 100);
  const svThumb = {
    left: (hsv.s / 100) * svSize.width,
    top: ((100 - hsv.v) / 100) * svSize.height,
  };

  const satGradient: [string, string] = [hsvToHex(hsv.h, 0, hsv.v), hsvToHex(hsv.h, 100, hsv.v)];
  const valGradient: [string, string] = [hsvToHex(hsv.h, hsv.s, 0), hsvToHex(hsv.h, hsv.s, 100)];

  return (
    <View style={styles.container}>
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSvSize({ width: Math.max(1, width), height: Math.max(1, height) });
        }}
        style={[styles.svArea, { borderColor: palette.border }]}
        {...svResponder.panHandlers}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: huePure }]} />
        <LinearGradient colors={['#FFFFFF', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', '#000000']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.svThumb,
            {
              left: svThumb.left,
              top: svThumb.top,
              borderColor: palette.surface,
              backgroundColor: withAlpha(palette.text.primary, 0.2),
            },
          ]}
        />
      </View>

      <View
        onLayout={(event) => setHueWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={[styles.hueArea, { borderColor: palette.border }]}
        {...hueResponder.panHandlers}
      >
        <LinearGradient colors={HUE_GRADIENT_COLORS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.hueThumb,
            {
              left: (hsv.h / 360) * hueWidth,
              borderColor: palette.surface,
              backgroundColor: palette.text.primary,
            },
          ]}
        />
      </View>

      <Input
        value={hexInput}
        onChangeText={(input) => {
          setHexInput(input);
          const normalized = normalizeHexColor(input, '');
          if (!normalized) return;
          setFromHsv(hexToHsv(normalized), false);
        }}
        onBlur={() => {
          const normalized = normalizeHexColor(hexInput, hsvToHex(hsv.h, hsv.s, hsv.v));
          setFromHsv(hexToHsv(normalized), true);
        }}
        placeholder="#RRGGBB"
      />

      {showChannels ? (
        <View style={styles.channels}>
          <ChannelSlider
            label={t('settings.colorHue')}
            value={hsv.h}
            min={0}
            max={360}
            colors={HUE_GRADIENT_COLORS}
            borderColor={palette.border}
            thumbColor={palette.text.primary}
            onChange={(next) => setFromHsv({ h: next, s: hsvRef.current.s, v: hsvRef.current.v }, false)}
            onCommit={(next) => setFromHsv({ h: next, s: hsvRef.current.s, v: hsvRef.current.v }, true)}
          />
          <ChannelSlider
            label={t('settings.colorSaturation')}
            value={hsv.s}
            min={0}
            max={100}
            colors={satGradient}
            borderColor={palette.border}
            thumbColor={hsvToHex(hsv.h, hsv.s, hsv.v)}
            onChange={(next) => setFromHsv({ h: hsvRef.current.h, s: next, v: hsvRef.current.v }, false)}
            onCommit={(next) => setFromHsv({ h: hsvRef.current.h, s: next, v: hsvRef.current.v }, true)}
          />
          <ChannelSlider
            label={t('settings.colorValue')}
            value={hsv.v}
            min={0}
            max={100}
            colors={valGradient}
            borderColor={palette.border}
            thumbColor={hsvToHex(hsv.h, hsv.s, hsv.v)}
            onChange={(next) => setFromHsv({ h: hsvRef.current.h, s: hsvRef.current.s, v: next }, false)}
            onCommit={(next) => setFromHsv({ h: hsvRef.current.h, s: hsvRef.current.s, v: next }, true)}
          />
        </View>
      ) : null}
    </View>
  );
}

export const ClassicColorPicker = React.memo(ClassicColorPickerComponent);

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  svArea: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  svThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginLeft: -10,
    marginTop: -10,
  },
  hueArea: {
    width: '100%',
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hueThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -8,
    width: 16,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
  },
  channels: {
    gap: spacing.xs,
  },
  sliderRow: {
    gap: spacing.xs,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  channelTrack: {
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  channelThumb: {
    position: 'absolute',
    top: -5,
    marginLeft: -8,
    width: 16,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
  },
});
