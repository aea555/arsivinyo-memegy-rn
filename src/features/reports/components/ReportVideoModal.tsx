import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { reportVideo } from '@/src/features/reports/api/reportsApi';
import { AbuseReasonCode } from '@/src/shared/types/api';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useToastStore } from '@/src/store/toastStore';

const REPORT_DETAILS_MAX_CHARS = 1000;

const REASON_CODES: AbuseReasonCode[] = [
  'PORNOGRAPHY',
  'CHILD_SEXUAL_ABUSE_MATERIAL',
  'MINOR_SEXUAL_EXPLOITATION',
  'RAPE_GLORIFICATION',
  'PEDOPHILIC_CONTENT',
  'ZOOPHILIA_OR_BESTIALITY',
  'NECROPHILIA',
  'EXPLICIT_SEXUAL_CONTENT',
  'ILLEGAL_SUBSTANCE_PROMOTION',
  'MALICIOUS_OR_MANIPULATIVE',
  'GRAPHIC_OR_DISTURBING',
  'MURDER_OR_SERIOUS_INJURY',
  'CORPSE_CONTENT',
  'NSFW_MISTAGGED',
  'HATE_OR_RACISM',
  'OTHER',
];

type ReportVideoModalProps = {
  visible: boolean;
  videoId: string;
  onClose: () => void;
};

export function ReportVideoModal({ visible, videoId, onClose }: ReportVideoModalProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const [selected, setSelected] = useState<AbuseReasonCode[]>([]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleReason = (reason: AbuseReasonCode) => {
    setSelected((prev) => {
      if (prev.includes(reason)) {
        return prev.filter((value) => value !== reason);
      }
      if (prev.length >= 5) {
        showToast(t('reports.maxReasons'), 'error');
        return prev;
      }
      return [...prev, reason];
    });
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      showToast(t('reports.selectReason'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      await reportVideo(videoId, {
        reason_codes: selected,
        details: details.trim().length ? details.trim() : null,
      });
      showToast(t('reports.submitted'), 'success');
      setSelected([]);
      setDetails('');
      onClose();
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.response?.data?.message;
      showToast(typeof message === 'string' ? message : t('reports.failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardAvoiding}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: palette.scrim }]}
          onPress={() => {
            if (!submitting) onClose();
          }}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.header}>
              <AppText variant="heading2">{t('reports.title')}</AppText>
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {t('reports.subtitle')}
              </AppText>
            </View>

            <View style={styles.middleSection}>
              <ScrollView
                style={styles.reasonList}
                contentContainerStyle={styles.reasonListContent}
                keyboardShouldPersistTaps="handled"
              >
                {REASON_CODES.map((reason) => {
                  const active = selectedSet.has(reason);
                  return (
                    <Pressable
                      key={reason}
                      onPress={() => toggleReason(reason)}
                      style={[
                        styles.reasonRow,
                        {
                          borderColor: active ? palette.accent : palette.border,
                          backgroundColor: active ? palette.accent : palette.background,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{ color: active ? palette.onAccent : palette.text.primary, flex: 1 }}
                      >
                        {t(`reports.reason.${reason}`)}
                      </AppText>
                      {active ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Input
                placeholder={t('reports.detailsPlaceholder')}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={REPORT_DETAILS_MAX_CHARS}
                editable={!submitting}
                style={styles.detailsInput}
              />
              <AppText variant="caption" style={{ color: palette.text.secondary }}>
                {details.length}/{REPORT_DETAILS_MAX_CHARS}
              </AppText>
            </View>

            <View style={styles.actions}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={onClose}
                disabled={submitting}
                style={styles.actionBtn}
              />
              <Button
                label={submitting ? t('reports.submitting') : t('reports.submit')}
                onPress={handleSubmit}
                disabled={submitting}
                style={styles.actionBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  header: {
    gap: spacing.xs,
  },
  middleSection: {
    gap: spacing.sm,
    flexShrink: 1,
    minHeight: 0,
  },
  reasonList: {
    maxHeight: 220,
    flexGrow: 0,
    flexShrink: 1,
  },
  reasonListContent: {
    gap: spacing.xs,
  },
  reasonRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailsInput: {
    minHeight: 56,
    maxHeight: 110,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
    marginTop: spacing.xs,
  },
  actionBtn: {
    minWidth: 112,
  },
});
