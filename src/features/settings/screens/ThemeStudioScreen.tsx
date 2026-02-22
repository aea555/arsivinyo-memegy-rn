import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { GestureResponderEvent, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClassicColorPicker } from '@/src/features/settings/components/ClassicColorPicker';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import {
  AccentDefinition,
  AccentDraft,
  ThemeDefinition,
  ThemeDraft,
  ThemeKind,
  ThemeMode,
  useTheme,
} from '@/src/shared/theme/ThemeProvider';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';

const THEME_FIELDS: { key: keyof ThemeDraft['colors']; labelKey: string }[] = [
  { key: 'background', labelKey: 'settings.colorBackground' },
  { key: 'surface', labelKey: 'settings.colorSurface' },
  { key: 'border', labelKey: 'settings.colorBorder' },
  { key: 'switchThumb', labelKey: 'settings.colorSwitchThumb' },
  { key: 'textPrimary', labelKey: 'settings.colorTextPrimary' },
  { key: 'textSecondary', labelKey: 'settings.colorTextSecondary' },
  { key: 'textDisabled', labelKey: 'settings.colorTextDisabled' },
  { key: 'success', labelKey: 'settings.colorSuccess' },
  { key: 'warning', labelKey: 'settings.colorWarning' },
  { key: 'error', labelKey: 'settings.colorError' },
];

function handleNestedAction(event: GestureResponderEvent, action: () => void) {
  event.stopPropagation();
  action();
}

function ModeCard({
  mode,
  selected,
  onPress,
  label,
  palette,
}: {
  mode: ThemeMode;
  selected: boolean;
  onPress: () => void;
  label: string;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  const isDark = mode === 'dark';
  const isLight = mode === 'light';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCard,
        {
          borderColor: selected ? palette.accent : palette.border,
          backgroundColor: selected ? palette.likeActiveBg : palette.surface,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.modePreview,
          {
            borderColor: palette.border,
            backgroundColor: isDark ? '#0F172A' : isLight ? '#F8FAFC' : palette.surface,
          },
        ]}
      >
        {mode === 'auto' ? (
          <LinearGradient
            colors={['#F8FAFC', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {mode === 'auto' ? (
          <View style={styles.autoCenter}>
            <Ionicons name="phone-portrait-outline" size={20} color="#FFFFFF" />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.modeTopBar,
                {
                  backgroundColor: isDark ? '#111827' : '#FFFFFF',
                  borderBottomColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            />
            <View style={styles.modeBody}>
              <View
                style={[
                  styles.modeCol,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
              />
              <View style={styles.modeBodyRight}>
                <View
                  style={[
                    styles.modeLine,
                    {
                      backgroundColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.modeAccentLine,
                    {
                      backgroundColor: isDark ? withAlpha('#60A5FA', 0.4) : withAlpha('#2563EB', 0.2),
                    },
                  ]}
                />
              </View>
            </View>
          </>
        )}
      </View>
      <View style={styles.modeLabelRow}>
        <AppText variant="caption">{label}</AppText>
        {selected ? <Ionicons name="checkmark-circle" size={16} color={palette.accent} /> : null}
      </View>
    </Pressable>
  );
}

function ThemePreviewCard({
  theme,
  accentColor,
  selected,
  name,
  editLabel,
  deleteLabel,
  palette,
  onPress,
  onEdit,
  onDelete,
}: {
  theme: ThemeDefinition;
  accentColor: string;
  selected: boolean;
  name: string;
  editLabel: string;
  deleteLabel: string;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const background = theme.colors.background;
  const surface = theme.colors.surface;
  const border = theme.colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.themePreviewCard,
        {
          borderColor: selected ? palette.accent : palette.border,
          backgroundColor: palette.surface,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={[styles.themePreviewFrame, { borderColor: border, backgroundColor: background }]}>
        {theme.backgroundGradient ? (
          <LinearGradient
            colors={[theme.backgroundGradient.start, theme.backgroundGradient.end]}
            start={{ x: 0.08, y: 0.02 }}
            end={{ x: 0.92, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[styles.themePreviewTop, { backgroundColor: surface, borderBottomColor: border }]} />
        <View style={styles.themePreviewBody}>
          <View style={[styles.themePreviewCol, { backgroundColor: surface, borderColor: border }]} />
          <View style={styles.themePreviewRight}>
            <View style={[styles.themePreviewLine, { backgroundColor: withAlpha(theme.colors.textSecondary, 0.28) }]} />
            <View style={[styles.themePreviewLine, { width: '72%', backgroundColor: withAlpha(theme.colors.textSecondary, 0.22) }]} />
            <View style={[styles.themePreviewAccent, { backgroundColor: withAlpha(accentColor, 0.26), borderColor: accentColor }]} />
          </View>
        </View>
      </View>
      <View style={styles.themePreviewFooter}>
        <View style={styles.themePreviewTitleRow}>
          <AppText variant="caption" numberOfLines={1} style={styles.themePreviewTitle}>
            {name}
          </AppText>
          {selected ? <Ionicons name="checkmark-circle" size={16} color={palette.accent} /> : null}
        </View>
        {onEdit ? (
          <Pressable
            onPress={(event) => handleNestedAction(event, onEdit)}
            style={({ pressed }) => [
              styles.themeActionRow,
              {
                borderColor: palette.border,
                backgroundColor: palette.background,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
          >
            <View style={styles.themeActionRowLeft}>
              <Ionicons name="create-outline" size={16} color={palette.text.secondary} />
              <AppText variant="caption">{editLabel}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.text.secondary} />
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable
            onPress={(event) => handleNestedAction(event, onDelete)}
            style={({ pressed }) => [
              styles.themeActionRow,
              {
                borderColor: withAlpha(palette.error, 0.4),
                backgroundColor: withAlpha(palette.error, 0.08),
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <View style={styles.themeActionRowLeft}>
              <Ionicons name="trash-outline" size={16} color={palette.error} />
              <AppText variant="caption" style={{ color: palette.error }}>{deleteLabel}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.error} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function AccentPreviewCard({
  accent,
  selected,
  name,
  editLabel,
  deleteLabel,
  palette,
  onPress,
  onEdit,
  onDelete,
}: {
  accent: AccentDefinition;
  selected: boolean;
  name: string;
  editLabel: string;
  deleteLabel: string;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.accentPreviewCard,
        {
          borderColor: selected ? accent.color : palette.border,
          backgroundColor: selected ? withAlpha(accent.color, 0.15) : palette.surface,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={[styles.accentPreviewDot, { backgroundColor: accent.color }]} />
      <View style={styles.accentPreviewMeta}>
        <View style={styles.accentPreviewHeader}>
          <AppText variant="caption" numberOfLines={1} style={styles.accentPreviewTitle}>{name}</AppText>
          {selected ? <Ionicons name="checkmark-circle" size={14} color={accent.color} /> : null}
        </View>
        <View style={styles.accentActionRows}>
          {onEdit ? (
            <Pressable
              onPress={(event) => handleNestedAction(event, onEdit)}
              style={({ pressed }) => [
                styles.themeActionRow,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={editLabel}
            >
              <View style={styles.themeActionRowLeft}>
                <Ionicons name="create-outline" size={16} color={palette.text.secondary} />
                <AppText variant="caption">{editLabel}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.text.secondary} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={(event) => handleNestedAction(event, onDelete)}
              style={({ pressed }) => [
                styles.themeActionRow,
                {
                  borderColor: withAlpha(palette.error, 0.4),
                  backgroundColor: withAlpha(palette.error, 0.08),
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={deleteLabel}
            >
              <View style={styles.themeActionRowLeft}>
                <Ionicons name="trash-outline" size={16} color={palette.error} />
                <AppText variant="caption" style={{ color: palette.error }}>{deleteLabel}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.error} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

type ThemeEditorProps = {
  visible: boolean;
  title: string;
  initial: ThemeDraft;
  onClose: () => void;
  onSave: (draft: ThemeDraft) => Promise<void>;
};

function ThemeEditorModal({ visible, title, initial, onClose, onSave }: ThemeEditorProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const [name, setName] = useState(initial.name ?? '');
  const [colors, setColors] = useState(initial.colors);
  const [gradientEnabled, setGradientEnabled] = useState(Boolean(initial.backgroundGradient));
  const [gradientStart, setGradientStart] = useState(initial.backgroundGradient?.start ?? initial.colors.background);
  const [gradientEnd, setGradientEnd] = useState(initial.backgroundGradient?.end ?? initial.colors.surface);
  const [gradientTarget, setGradientTarget] = useState<'start' | 'end'>('start');
  const [activeField, setActiveField] = useState<keyof ThemeDraft['colors']>('background');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial.name ?? '');
    setColors(initial.colors);
    setGradientEnabled(Boolean(initial.backgroundGradient));
    setGradientStart(initial.backgroundGradient?.start ?? initial.colors.background);
    setGradientEnd(initial.backgroundGradient?.end ?? initial.colors.surface);
    setGradientTarget('start');
    setActiveField('background');
  }, [initial, visible]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        ...initial,
        name,
        colors,
        backgroundGradient: gradientEnabled ? { start: gradientStart, end: gradientEnd } : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedGradientColor = gradientTarget === 'start' ? gradientStart : gradientEnd;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: palette.scrim }]}> 
        <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
          <AppText variant="heading2">{title}</AppText>
          <AppText variant="caption" style={{ color: palette.text.secondary }}>
            {initial.kind === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
          </AppText>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Input value={name} onChangeText={setName} placeholder={t('settings.optionalName')} />

            <View style={styles.fieldList}>
              {THEME_FIELDS.map((field) => {
                const selected = activeField === field.key;
                return (
                  <Pressable
                    key={field.key}
                    onPress={() => setActiveField(field.key)}
                    style={[
                      styles.fieldRow,
                      {
                        borderColor: selected ? palette.accent : palette.border,
                        backgroundColor: selected ? palette.likeActiveBg : palette.background,
                      },
                    ]}
                  >
                    <AppText variant="caption">{t(field.labelKey)}</AppText>
                    <View style={styles.fieldRight}>
                      <AppText variant="caption" style={{ color: palette.text.secondary }}>{colors[field.key]}</AppText>
                      <View style={[styles.colorPreview, { backgroundColor: colors[field.key], borderColor: palette.border }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <ClassicColorPicker
              color={colors[activeField]}
              onChange={(next) => {
                setColors((prev) => {
                  if (prev[activeField] === next) return prev;
                  return { ...prev, [activeField]: next };
                });
              }}
            />

            <Pressable
              onPress={() => setGradientEnabled((prev) => !prev)}
              style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}
            >
              <AppText variant="bodyBold">{t('settings.enableGradient')}</AppText>
              <Ionicons
                name={gradientEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={gradientEnabled ? palette.accent : palette.text.secondary}
              />
            </Pressable>

            {gradientEnabled ? (
              <View style={styles.gradientFields}>
                <SegmentedControl
                  value={gradientTarget}
                  onChange={(value) => setGradientTarget(value as 'start' | 'end')}
                  options={[
                    { label: t('settings.gradientTargetStart'), value: 'start' },
                    { label: t('settings.gradientTargetEnd'), value: 'end' },
                  ]}
                />
                <AppText variant="caption" style={{ color: palette.text.secondary }}>
                  {gradientTarget === 'start' ? t('settings.gradientStart') : t('settings.gradientEnd')}
                </AppText>
                <ClassicColorPicker
                  color={selectedGradientColor}
                  onChange={(next) => {
                    if (gradientTarget === 'start') {
                      setGradientStart(next);
                      return;
                    }
                    setGradientEnd(next);
                  }}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button label={t('common.cancel')} onPress={onClose} variant="secondary" />
            <Button label={t('common.save')} onPress={() => void save()} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type AccentEditorProps = {
  visible: boolean;
  title: string;
  initial: AccentDraft;
  onClose: () => void;
  onSave: (draft: AccentDraft) => Promise<void>;
};

function AccentEditorModal({ visible, title, initial, onClose, onSave }: AccentEditorProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const [name, setName] = useState(initial.name ?? '');
  const [color, setColor] = useState(initial.color);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial.name ?? '');
    setColor(initial.color);
  }, [initial, visible]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ ...initial, name, color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: palette.scrim }]}> 
        <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
          <AppText variant="heading2">{title}</AppText>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Input value={name} onChangeText={setName} placeholder={t('settings.optionalName')} />
            <ClassicColorPicker color={color} onChange={setColor} />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button label={t('common.cancel')} onPress={onClose} variant="secondary" />
            <Button label={t('common.save')} onPress={() => void save()} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ThemeStudioScreen() {
  const { t } = useTranslation();
  const {
    mode,
    effectiveMode,
    setMode,
    setThemeForKind,
    setAccent,
    lightThemeId,
    darkThemeId,
    accentId,
    systemThemes,
    customThemes,
    systemAccents,
    customAccents,
    saveCustomTheme,
    deleteCustomTheme,
    saveCustomAccent,
    deleteCustomAccent,
    palette,
  } = useTheme();

  const activeKind: ThemeKind = mode === 'auto' ? effectiveMode : mode;
  const selectedThemeId = activeKind === 'dark' ? darkThemeId : lightThemeId;

  const themes = useMemo(
    () => [...systemThemes, ...customThemes].filter((theme) => theme.kind === activeKind),
    [activeKind, customThemes, systemThemes]
  );

  const accents = useMemo(() => [...systemAccents, ...customAccents], [customAccents, systemAccents]);

  const resolveThemeName = (theme: ThemeDefinition) => {
    if (theme.name?.trim()) return theme.name;
    if (theme.nameKey) return t(theme.nameKey);
    return theme.id;
  };

  const resolveAccentName = (accent: AccentDefinition) => {
    if (accent.name?.trim()) return accent.name;
    if (accent.nameKey) return t(accent.nameKey);
    return accent.id;
  };

  const [themeEditorVisible, setThemeEditorVisible] = useState(false);
  const [accentEditorVisible, setAccentEditorVisible] = useState(false);
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [accentDraft, setAccentDraft] = useState<AccentDraft | null>(null);
  const [deleteThemeId, setDeleteThemeId] = useState<string | null>(null);
  const [deleteAccentId, setDeleteAccentId] = useState<string | null>(null);

  const openCreateTheme = () => {
    const base = themes.find((theme) => theme.id === selectedThemeId) ?? themes[0];
    setThemeDraft({
      kind: activeKind,
      colors: base.colors,
      backgroundGradient: base.backgroundGradient,
    });
    setThemeEditorVisible(true);
  };

  const openEditTheme = (theme: ThemeDefinition) => {
    setThemeDraft({
      id: theme.id,
      kind: theme.kind,
      name: theme.name,
      colors: theme.colors,
      backgroundGradient: theme.backgroundGradient,
    });
    setThemeEditorVisible(true);
  };

  const openCreateAccent = () => {
    const current = accents.find((accent) => accent.id === accentId) ?? accents[0];
    setAccentDraft({ color: current.color });
    setAccentEditorVisible(true);
  };

  const openEditAccent = (accent: AccentDefinition) => {
    setAccentDraft({
      id: accent.id,
      name: accent.name,
      color: accent.color,
    });
    setAccentEditorVisible(true);
  };

  return (
    <Screen title={t('settings.themeStudio')} showBack contentStyle={styles.screenContent}>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.sectionCard}>
          <AppText variant="heading2">{t('settings.appearance')}</AppText>
          <AppText variant="caption" style={{ color: palette.text.secondary }}>
            {t('settings.appearanceSubtitle')}
          </AppText>
          <View style={styles.modeGrid}>
            <ModeCard mode="light" selected={mode === 'light'} onPress={() => void setMode('light')} label={t('settings.themeLight')} palette={palette} />
            <ModeCard mode="dark" selected={mode === 'dark'} onPress={() => void setMode('dark')} label={t('settings.themeDark')} palette={palette} />
            <ModeCard mode="auto" selected={mode === 'auto'} onPress={() => void setMode('auto')} label={t('settings.themeAuto')} palette={palette} />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <AppText variant="heading2">
                {activeKind === 'dark' ? t('settings.darkThemes') : t('settings.lightThemes')}
              </AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {mode === 'auto'
                  ? t('settings.autoModeActiveHint', {
                      mode: activeKind === 'dark' ? t('settings.themeDark') : t('settings.themeLight'),
                    })
                  : t('settings.themePreviewHint')}
              </AppText>
            </View>
            <Button label={t('settings.createTheme')} variant="secondary" onPress={openCreateTheme} />
          </View>

          <View style={styles.themeGrid}>
            {themes.map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                theme={theme}
                accentColor={(accents.find((accent) => accent.id === accentId) ?? accents[0]).color}
                selected={selectedThemeId === theme.id}
                name={resolveThemeName(theme)}
                editLabel={t('common.edit')}
                deleteLabel={t('common.delete')}
                palette={palette}
                onPress={() => void setThemeForKind(activeKind, theme.id)}
                onEdit={theme.source === 'custom' ? () => openEditTheme(theme) : undefined}
                onDelete={theme.source === 'custom' ? () => setDeleteThemeId(theme.id) : undefined}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <AppText variant="heading2">{t('settings.accents')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('settings.accentPreviewHint')}
              </AppText>
            </View>
            <Button label={t('settings.createAccent')} variant="secondary" onPress={openCreateAccent} />
          </View>

          <View style={styles.accentGrid}>
            {accents.map((accent) => (
              <AccentPreviewCard
                key={accent.id}
                accent={accent}
                selected={accentId === accent.id}
                name={resolveAccentName(accent)}
                editLabel={t('common.edit')}
                deleteLabel={t('common.delete')}
                palette={palette}
                onPress={() => void setAccent(accent.id)}
                onEdit={accent.source === 'custom' ? () => openEditAccent(accent) : undefined}
                onDelete={accent.source === 'custom' ? () => setDeleteAccentId(accent.id) : undefined}
              />
            ))}
          </View>
        </Card>
      </ScrollView>

      {themeDraft ? (
        <ThemeEditorModal
          visible={themeEditorVisible}
          title={themeDraft.id ? t('settings.editTheme') : t('settings.createTheme')}
          initial={themeDraft}
          onClose={() => setThemeEditorVisible(false)}
          onSave={async (draft) => {
            await saveCustomTheme(draft);
          }}
        />
      ) : null}

      {accentDraft ? (
        <AccentEditorModal
          visible={accentEditorVisible}
          title={accentDraft.id ? t('settings.editAccent') : t('settings.createAccent')}
          initial={accentDraft}
          onClose={() => setAccentEditorVisible(false)}
          onSave={async (draft) => {
            await saveCustomAccent(draft);
          }}
        />
      ) : null}

      <ConfirmModal
        visible={Boolean(deleteThemeId)}
        title={t('settings.deleteThemeTitle')}
        body={t('settings.deleteThemeBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (!deleteThemeId) return;
          void deleteCustomTheme(deleteThemeId);
          setDeleteThemeId(null);
        }}
        onCancel={() => setDeleteThemeId(null)}
      />

      <ConfirmModal
        visible={Boolean(deleteAccentId)}
        title={t('settings.deleteAccentTitle')}
        body={t('settings.deleteAccentBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (!deleteAccentId) return;
          void deleteCustomAccent(deleteAccentId);
          setDeleteAccentId(null);
        }}
        onCancel={() => setDeleteAccentId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  modePreview: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  autoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTopBar: {
    height: 8,
    borderBottomWidth: 1,
  },
  modeBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  modeCol: {
    width: '24%',
    borderRadius: 5,
    borderWidth: 1,
  },
  modeBodyRight: {
    flex: 1,
    gap: 4,
  },
  modeLine: {
    height: 6,
    borderRadius: 999,
  },
  modeAccentLine: {
    width: '66%',
    height: 6,
    borderRadius: 999,
  },
  modeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themePreviewCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  themePreviewFrame: {
    width: '100%',
    aspectRatio: 16 / 11,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themePreviewTop: {
    height: 8,
    borderBottomWidth: 1,
  },
  themePreviewBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  themePreviewCol: {
    width: '24%',
    borderRadius: 5,
    borderWidth: 1,
  },
  themePreviewRight: {
    flex: 1,
    gap: 5,
  },
  themePreviewLine: {
    width: '94%',
    height: 6,
    borderRadius: 999,
  },
  themePreviewAccent: {
    width: '58%',
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  themePreviewFooter: {
    gap: spacing.xs,
  },
  themePreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  themePreviewTitle: {
    flex: 1,
  },
  themeActionRow: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeActionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  accentPreviewCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  accentPreviewDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  accentPreviewMeta: {
    gap: spacing.xs,
  },
  accentPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  accentPreviewTitle: {
    flex: 1,
  },
  accentActionRows: {
    gap: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  fieldList: {
    gap: spacing.xs,
  },
  fieldRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradientFields: {
    gap: spacing.sm,
  },
});
