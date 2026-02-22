import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import {
  clampUtf8Bytes,
  VIDEO_DESCRIPTION_MAX_BYTES,
  VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';

export type EditVideoMetadataValues = {
  title: string;
  description: string;
  isAnonymous: boolean;
  isNsfw: boolean;
};

type EditVideoMetadataModalProps = {
  visible: boolean;
  title: string;
  description: string;
  isAnonymous: boolean;
  isNsfw: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (values: EditVideoMetadataValues) => void;
};

export function EditVideoMetadataModal({
  visible,
  title,
  description,
  isAnonymous,
  isNsfw,
  isSaving,
  onCancel,
  onSave,
}: EditVideoMetadataModalProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAnonymous, setDraftAnonymous] = useState(false);
  const [draftNsfw, setDraftNsfw] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraftTitle(title ?? '');
    setDraftDescription(description ?? '');
    setDraftAnonymous(Boolean(isAnonymous));
    setDraftNsfw(Boolean(isNsfw));
  }, [description, isAnonymous, isNsfw, title, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: palette.scrim }]}
        onPress={() => {
          if (isSaving) return;
          onCancel();
        }}
      >
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <AppText variant="heading2">{t('profile.editMetadataTitle')}</AppText>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('profile.editMetadataSubtitle')}
            </AppText>
          </View>

          <View style={styles.inputGroup}>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('profile.editMetadataTitleLabel')}
            </AppText>
            <Input
              placeholder={t('profile.editMetadataTitlePlaceholder')}
              value={draftTitle}
              onChangeText={(text) => setDraftTitle(clampUtf8Bytes(text, VIDEO_TITLE_MAX_BYTES))}
              maxLength={VIDEO_TITLE_MAX_BYTES}
              editable={!isSaving}
            />
          </View>

          <View style={styles.inputGroup}>
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {t('profile.editMetadataDescriptionLabel')}
            </AppText>
            <Input
              placeholder={t('profile.editMetadataDescriptionPlaceholder')}
              value={draftDescription}
              onChangeText={(text) =>
                setDraftDescription(clampUtf8Bytes(text, VIDEO_DESCRIPTION_MAX_BYTES))
              }
              maxLength={VIDEO_DESCRIPTION_MAX_BYTES}
              multiline
              editable={!isSaving}
              style={styles.descriptionInput}
            />
          </View>

          <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}>
            <View style={styles.toggleText}>
              <AppText variant="bodyBold">{t('profile.editMetadataAnonymousLabel')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('profile.editMetadataAnonymousHint')}
              </AppText>
            </View>
            <Switch
              value={draftAnonymous}
              onValueChange={setDraftAnonymous}
              trackColor={{ true: palette.accent, false: palette.border }}
              thumbColor={draftAnonymous ? palette.switchThumb : palette.surface}
              disabled={isSaving}
            />
          </View>

          <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}>
            <View style={styles.toggleText}>
              <AppText variant="bodyBold">{t('profile.editMetadataNsfwLabel')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('profile.editMetadataNsfwHint')}
              </AppText>
            </View>
            <Switch
              value={draftNsfw}
              onValueChange={setDraftNsfw}
              trackColor={{ true: palette.accent, false: palette.border }}
              thumbColor={draftNsfw ? palette.switchThumb : palette.surface}
              disabled={isSaving}
            />
          </View>

          <View style={styles.actions}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={onCancel}
              disabled={isSaving}
              style={styles.actionButton}
            />
            <Button
              label={isSaving ? t('profile.editMetadataSaving') : t('common.save')}
              onPress={() =>
                onSave({
                  title: draftTitle,
                  description: draftDescription,
                  isAnonymous: draftAnonymous,
                  isNsfw: draftNsfw,
                })
              }
              disabled={isSaving}
              style={styles.actionButton}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 112,
  },
});
