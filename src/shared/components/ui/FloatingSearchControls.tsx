import React from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FloatingSearchControlsMode } from '@/src/shared/hooks/useFloatingSearchControls';

type FloatingSearchControlsProps = {
  mode: FloatingSearchControlsMode;
  expandedContent: React.ReactNode;
  collapsedContent: React.ReactNode;
  expandedAnimatedStyle: StyleProp<ViewStyle>;
  collapsedAnimatedStyle: StyleProp<ViewStyle>;
  onMeasureHeight?: (height: number) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function FloatingSearchControls({
  mode,
  expandedContent,
  collapsedContent,
  expandedAnimatedStyle,
  collapsedAnimatedStyle,
  onMeasureHeight,
  containerStyle,
}: FloatingSearchControlsProps) {
  return (
    <View pointerEvents="box-none" style={[styles.host, containerStyle]}>
      <Animated.View
        pointerEvents={mode === 'collapsed' ? 'none' : 'auto'}
        style={[styles.expandedWrap, expandedAnimatedStyle]}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight > 0) {
            onMeasureHeight?.(nextHeight);
          }
        }}
      >
        {expandedContent}
      </Animated.View>

      <Animated.View
        pointerEvents={mode === 'collapsed' ? 'auto' : 'none'}
        style={[styles.collapsedWrap, collapsedAnimatedStyle]}
      >
        {collapsedContent}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  expandedWrap: {
    width: '100%',
  },
  collapsedWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
