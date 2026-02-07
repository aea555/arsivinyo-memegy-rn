const toNumber = (value: string | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const fromEnv = (name: string, fallback: number, min: number, max: number) => {
  const value = toNumber(process.env[name], fallback);
  return clamp(value, min, max);
};

export const layoutConfig = {
  spacingScale: fromEnv('EXPO_PUBLIC_UI_SPACING_SCALE', 0.8, 0.65, 1),
  screen: {
    horizontalPadding: fromEnv('EXPO_PUBLIC_UI_SCREEN_HORIZONTAL_PADDING', 16, 8, 32),
    withHeaderTopPadding: fromEnv('EXPO_PUBLIC_UI_SCREEN_WITH_HEADER_TOP_PADDING', 12, 4, 32),
    noHeaderTopPadding: fromEnv('EXPO_PUBLIC_UI_SCREEN_NO_HEADER_TOP_PADDING', 18, 8, 40),
    noHeaderBottomPadding: fromEnv('EXPO_PUBLIC_UI_SCREEN_NO_HEADER_BOTTOM_PADDING', 18, 8, 40),
  },
  header: {
    horizontalPadding: fromEnv('EXPO_PUBLIC_UI_HEADER_HORIZONTAL_PADDING', 16, 8, 32),
    topPadding: fromEnv('EXPO_PUBLIC_UI_HEADER_TOP_PADDING', 10, 2, 24),
    bottomPadding: fromEnv('EXPO_PUBLIC_UI_HEADER_BOTTOM_PADDING', 6, 2, 20),
    minHeight: fromEnv('EXPO_PUBLIC_UI_HEADER_MIN_HEIGHT', 50, 40, 72),
  },
  card: {
    padding: fromEnv('EXPO_PUBLIC_UI_CARD_PADDING', 12, 8, 20),
  },
  tabBar: {
    height: fromEnv('EXPO_PUBLIC_UI_TAB_HEIGHT', 68, 56, 110),
    paddingTop: fromEnv('EXPO_PUBLIC_UI_TAB_PADDING_TOP', 4, 0, 20),
    paddingBottom: fromEnv('EXPO_PUBLIC_UI_TAB_PADDING_BOTTOM', 6, 0, 24),
    paddingHorizontal: fromEnv('EXPO_PUBLIC_UI_TAB_PADDING_HORIZONTAL', 4, 0, 20),
    uploadTopOffset: fromEnv('EXPO_PUBLIC_UI_TAB_UPLOAD_TOP_OFFSET', -19, -30, 0),
    uploadShellSize: fromEnv('EXPO_PUBLIC_UI_TAB_UPLOAD_SHELL_SIZE', 56, 44, 72),
    uploadInnerSize: fromEnv('EXPO_PUBLIC_UI_TAB_UPLOAD_INNER_SIZE', 48, 38, 64),
  },
  list: {
    headerGap: fromEnv('EXPO_PUBLIC_UI_LIST_HEADER_GAP', 8, 4, 20),
    headerBottomMargin: fromEnv('EXPO_PUBLIC_UI_LIST_HEADER_BOTTOM_MARGIN', 8, 0, 24),
  },
} as const;
