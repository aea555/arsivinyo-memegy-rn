import { Platform } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';

const iosShadow = (color: string, opacity: number, radius: number, height: number) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height },
});

const androidShadow = (elevation: number) =>
  Platform.select({
    android: { elevation },
    default: {},
  });

export const createShadows = (color: string) => ({
  subtle: {
    ...iosShadow(color, 0.08, 6, 3),
    ...androidShadow(3),
  },
  medium: {
    ...iosShadow(color, 0.12, 10, 6),
    ...androidShadow(6),
  },
  strong: {
    ...iosShadow(color, 0.2, 16, 10),
    ...androidShadow(10),
  },
});

export function useShadows() {
  const { palette } = useTheme();
  return createShadows(palette.shadow);
}
