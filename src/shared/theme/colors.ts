export const colors = {
  light: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: {
      primary: '#1F1F1F',
      secondary: '#6B6B6B',
      disabled: '#A0A0A0',
    },
    accent: '#5E72E4',
    success: '#2DCE89',
    warning: '#FB6340',
    error: '#F5365C',
    border: '#E0E0E0',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      disabled: '#707070',
    },
    accent: '#748FFC',
    success: '#38D9A9',
    warning: '#FFB347',
    error: '#FF6B6B',
    border: '#2C2C2C',
  },
};

export type ThemeColors = typeof colors.light;
