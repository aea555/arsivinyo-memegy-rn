import { Platform } from 'react-native';

const iosShadow = (opacity: number, radius: number, height: number) => ({
  shadowColor: '#000',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height },
});

const androidShadow = (elevation: number) =>
  Platform.select({
    android: { elevation },
    default: {},
  });

export const shadows = {
  subtle: {
    ...iosShadow(0.08, 6, 3),
    ...androidShadow(3),
  },
  medium: {
    ...iosShadow(0.12, 10, 6),
    ...androidShadow(6),
  },
  strong: {
    ...iosShadow(0.2, 16, 10),
    ...androidShadow(10),
  },
};
