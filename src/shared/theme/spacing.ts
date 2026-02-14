import { layoutConfig } from '@/src/shared/config/layoutConfig';

const scale = (value: number) =>
  Math.max(2, Math.round(value * layoutConfig.spacingScale));

export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
  xxxl: scale(64),
};
