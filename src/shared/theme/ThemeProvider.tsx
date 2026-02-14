import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Theme as NavigationTheme } from '@react-navigation/native';

import i18n from '@/src/shared/locales/i18n';
import { LocalStorage } from '@/src/shared/services/storage/LocalStorage';
import { getContrastingTextColor, normalizeHexColor, withAlpha } from '@/src/shared/theme/colorUtils';
import {
  createDefaultThemeSettings,
  DEFAULT_ACCENT_ID,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  SYSTEM_ACCENTS,
  SYSTEM_THEMES,
} from '@/src/shared/theme/presets';
import {
  AccentDefinition,
  AccentDraft,
  ResolvedPalette,
  ThemeDefinition,
  ThemeDraft,
  ThemeKind,
  ThemeMode,
  ThemeSettingsState,
} from '@/src/shared/theme/types';

type ThemeContextValue = {
  mode: ThemeMode;
  effectiveMode: 'light' | 'dark';
  palette: ResolvedPalette;
  navigationTheme: NavigationTheme;
  lightThemeId: string;
  darkThemeId: string;
  accentId: string;
  systemThemes: ThemeDefinition[];
  customThemes: ThemeDefinition[];
  systemAccents: AccentDefinition[];
  customAccents: AccentDefinition[];
  setMode: (mode: ThemeMode) => Promise<void>;
  setThemeForKind: (kind: ThemeKind, themeId: string) => Promise<void>;
  setAccent: (accentId: string) => Promise<void>;
  saveCustomTheme: (draft: ThemeDraft) => Promise<ThemeDefinition>;
  deleteCustomTheme: (themeId: string) => Promise<void>;
  saveCustomAccent: (draft: AccentDraft) => Promise<AccentDefinition>;
  deleteCustomAccent: (accentId: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const CUSTOM_THEME_PREFIX = 'custom_theme_';
const CUSTOM_ACCENT_PREFIX = 'custom_accent_';

const themeNameRegex = /^custom theme (\d+)$/i;
const accentNameRegex = /^custom accent (\d+)$/i;

const resolveTheme = (settings: ThemeSettingsState, kind: ThemeKind): ThemeDefinition => {
  const id = kind === 'light' ? settings.lightThemeId : settings.darkThemeId;
  const allThemes = [...SYSTEM_THEMES, ...settings.customThemes];
  const target = allThemes.find((theme) => theme.id === id && theme.kind === kind);
  if (target) return target;
  const fallbackId = kind === 'light' ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID;
  return allThemes.find((theme) => theme.id === fallbackId)!;
};

const resolveAccent = (settings: ThemeSettingsState): AccentDefinition => {
  const allAccents = [...SYSTEM_ACCENTS, ...settings.customAccents];
  return allAccents.find((accent) => accent.id === settings.accentId) ?? allAccents.find((accent) => accent.id === DEFAULT_ACCENT_ID)!;
};

const resolvePalette = (theme: ThemeDefinition, accent: AccentDefinition, effectiveMode: 'light' | 'dark'): ResolvedPalette => {
  const accentColor = normalizeHexColor(accent.color, '#2563EB');
  return {
    background: normalizeHexColor(theme.colors.background),
    surface: normalizeHexColor(theme.colors.surface),
    border: normalizeHexColor(theme.colors.border),
    accent: accentColor,
    success: normalizeHexColor(theme.colors.success),
    warning: normalizeHexColor(theme.colors.warning),
    error: normalizeHexColor(theme.colors.error),
    text: {
      primary: normalizeHexColor(theme.colors.textPrimary),
      secondary: normalizeHexColor(theme.colors.textSecondary),
      disabled: normalizeHexColor(theme.colors.textDisabled),
    },
    backgroundGradient: theme.backgroundGradient,
    onAccent: getContrastingTextColor(accentColor),
    scrim: withAlpha('#000000', effectiveMode === 'dark' ? 0.56 : 0.42),
    overlay: withAlpha(normalizeHexColor(theme.colors.background), 0.84),
    mediaBackground: effectiveMode === 'dark' ? '#000000' : '#0F172A',
    mediaControl: withAlpha('#000000', 0.58),
    mediaControlText: '#FFFFFF',
    likeActive: accentColor,
    likeActiveBg: withAlpha(accentColor, 0.16),
    shadow: withAlpha('#000000', effectiveMode === 'dark' ? 0.5 : 0.22),
  };
};

const getNextLocalizedName = (items: { name?: string }[], templateKey: string, matcher: RegExp): string => {
  const occupied = new Set<number>();
  for (const item of items) {
    if (!item.name) continue;
    const match = item.name.trim().match(matcher);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed)) occupied.add(parsed);
  }

  let index = 1;
  while (occupied.has(index)) index += 1;

  return i18n.t(templateKey, { index });
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [settings, setSettings] = useState<ThemeSettingsState>(createDefaultThemeSettings());

  useEffect(() => {
    let mounted = true;
    LocalStorage.getThemeSettings().then((stored) => {
      if (!mounted || !stored) return;
      setSettings(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: ThemeSettingsState) => {
    setSettings(next);
    await LocalStorage.setThemeSettings(next);
  }, []);

  const effectiveMode = settings.mode === 'auto' ? systemScheme : settings.mode;
  const resolvedTheme = resolveTheme(settings, effectiveMode);
  const resolvedAccent = resolveAccent(settings);
  const palette = useMemo(
    () => resolvePalette(resolvedTheme, resolvedAccent, effectiveMode),
    [effectiveMode, resolvedAccent, resolvedTheme]
  );

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = effectiveMode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.background,
        card: palette.surface,
        text: palette.text.primary,
        border: palette.border,
        primary: palette.accent,
      },
    };
  }, [effectiveMode, palette]);

  const setMode = useCallback(
    async (mode: ThemeMode) => {
      await persist({
        ...settings,
        mode,
      });
    },
    [persist, settings]
  );

  const setThemeForKind = useCallback(
    async (kind: ThemeKind, themeId: string) => {
      if (kind === 'light') {
        await persist({ ...settings, lightThemeId: themeId });
        return;
      }
      await persist({ ...settings, darkThemeId: themeId });
    },
    [persist, settings]
  );

  const setAccent = useCallback(
    async (accentId: string) => {
      await persist({ ...settings, accentId });
    },
    [persist, settings]
  );

  const saveCustomTheme = useCallback(
    async (draft: ThemeDraft) => {
      const nowIso = new Date().toISOString();
      const id = draft.id ?? `${CUSTOM_THEME_PREFIX}${Date.now()}`;
      const name = draft.name?.trim().length
        ? draft.name.trim()
        : getNextLocalizedName(settings.customThemes, 'settings.defaultCustomThemeName', themeNameRegex);

      const nextTheme: ThemeDefinition = {
        id,
        name,
        kind: draft.kind,
        source: 'custom',
        colors: draft.colors,
        backgroundGradient: draft.backgroundGradient,
        createdAt: settings.customThemes.find((theme) => theme.id === id)?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };

      const nextThemes = settings.customThemes.some((theme) => theme.id === id)
        ? settings.customThemes.map((theme) => (theme.id === id ? nextTheme : theme))
        : [...settings.customThemes, nextTheme];

      await persist({
        ...settings,
        customThemes: nextThemes,
        lightThemeId: draft.kind === 'light' ? id : settings.lightThemeId,
        darkThemeId: draft.kind === 'dark' ? id : settings.darkThemeId,
      });

      return nextTheme;
    },
    [persist, settings]
  );

  const deleteCustomTheme = useCallback(
    async (themeId: string) => {
      const target = settings.customThemes.find((theme) => theme.id === themeId);
      if (!target) return;

      await persist({
        ...settings,
        customThemes: settings.customThemes.filter((theme) => theme.id !== themeId),
        lightThemeId: settings.lightThemeId === themeId ? DEFAULT_LIGHT_THEME_ID : settings.lightThemeId,
        darkThemeId: settings.darkThemeId === themeId ? DEFAULT_DARK_THEME_ID : settings.darkThemeId,
      });
    },
    [persist, settings]
  );

  const saveCustomAccent = useCallback(
    async (draft: AccentDraft) => {
      const nowIso = new Date().toISOString();
      const id = draft.id ?? `${CUSTOM_ACCENT_PREFIX}${Date.now()}`;
      const name = draft.name?.trim().length
        ? draft.name.trim()
        : getNextLocalizedName(settings.customAccents, 'settings.defaultCustomAccentName', accentNameRegex);

      const nextAccent: AccentDefinition = {
        id,
        name,
        source: 'custom',
        color: normalizeHexColor(draft.color, '#2563EB'),
        createdAt: settings.customAccents.find((accent) => accent.id === id)?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };

      const nextAccents = settings.customAccents.some((accent) => accent.id === id)
        ? settings.customAccents.map((accent) => (accent.id === id ? nextAccent : accent))
        : [...settings.customAccents, nextAccent];

      await persist({
        ...settings,
        customAccents: nextAccents,
        accentId: id,
      });

      return nextAccent;
    },
    [persist, settings]
  );

  const deleteCustomAccent = useCallback(
    async (accentId: string) => {
      if (!settings.customAccents.some((accent) => accent.id === accentId)) return;
      await persist({
        ...settings,
        customAccents: settings.customAccents.filter((accent) => accent.id !== accentId),
        accentId: settings.accentId === accentId ? DEFAULT_ACCENT_ID : settings.accentId,
      });
    },
    [persist, settings]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode: settings.mode,
      effectiveMode,
      palette,
      navigationTheme,
      lightThemeId: settings.lightThemeId,
      darkThemeId: settings.darkThemeId,
      accentId: settings.accentId,
      systemThemes: SYSTEM_THEMES,
      customThemes: settings.customThemes,
      systemAccents: SYSTEM_ACCENTS,
      customAccents: settings.customAccents,
      setMode,
      setThemeForKind,
      setAccent,
      saveCustomTheme,
      deleteCustomTheme,
      saveCustomAccent,
      deleteCustomAccent,
    }),
    [
      deleteCustomAccent,
      deleteCustomTheme,
      effectiveMode,
      navigationTheme,
      palette,
      saveCustomAccent,
      saveCustomTheme,
      setAccent,
      setMode,
      setThemeForKind,
      settings.accentId,
      settings.customAccents,
      settings.customThemes,
      settings.darkThemeId,
      settings.lightThemeId,
      settings.mode,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export type { ThemeMode, ThemeKind, ThemeDefinition, AccentDefinition, ThemeDraft, AccentDraft };
