export type ThemeMode = 'auto' | 'light' | 'dark';
export type ThemeKind = 'light' | 'dark';
export type ThemeSource = 'system' | 'custom';
export type AccentSource = 'system' | 'custom';

export type ThemeColorTokens = {
  background: string;
  surface: string;
  border: string;
  switchThumb: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  warning: string;
  error: string;
};

export type ThemeGradient = {
  start: string;
  end: string;
};

export type ThemeDefinition = {
  id: string;
  nameKey?: string;
  name?: string;
  kind: ThemeKind;
  source: ThemeSource;
  colors: ThemeColorTokens;
  backgroundGradient?: ThemeGradient;
  createdAt?: string;
  updatedAt?: string;
};

export type AccentDefinition = {
  id: string;
  nameKey?: string;
  name?: string;
  source: AccentSource;
  color: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ThemeSettingsState = {
  version: 1;
  mode: ThemeMode;
  lightThemeId: string;
  darkThemeId: string;
  accentId: string;
  customThemes: ThemeDefinition[];
  customAccents: AccentDefinition[];
};

export type ResolvedPalette = {
  background: string;
  surface: string;
  border: string;
  switchThumb: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  backgroundGradient?: ThemeGradient;
  onAccent: string;
  scrim: string;
  overlay: string;
  mediaBackground: string;
  mediaControl: string;
  mediaControlText: string;
  likeActive: string;
  likeActiveBg: string;
  shadow: string;
};

export type ThemeDraft = {
  id?: string;
  kind: ThemeKind;
  name?: string;
  colors: ThemeColorTokens;
  backgroundGradient?: ThemeGradient;
};

export type AccentDraft = {
  id?: string;
  name?: string;
  color: string;
};
