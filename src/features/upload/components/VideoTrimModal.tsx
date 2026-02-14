import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import VideoTrimmer from 'react-native-video-trim';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useShadows } from '@/src/shared/theme/shadows';
import { spacing } from '@/src/shared/theme/spacing';

type VideoTrimModalProps = {
    visible: boolean;
    videoUri: string;
    onComplete: (trimmedUri: string) => void;
    onCancel: () => void;
};

export function VideoTrimModal({ visible, videoUri, onComplete, onCancel }: VideoTrimModalProps) {
    const { t } = useTranslation();
    const { palette } = useTheme();
    const shadows = useShadows();
    const [trimming, setTrimming] = useState(false);
    const [startTime, setStartTime] = useState('0');
    const [endTime, setEndTime] = useState('10');

    const handleTrim = async () => {
        const start = parseFloat(startTime);
        const end = parseFloat(endTime);

        if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
            Alert.alert(t('common.error'), 'Invalid trim times. Start must be before end.');
            return;
        }

        setTrimming(true);
        try {
            const result = await VideoTrimmer.trim(videoUri, {
                startTime: start * 1000, // Convert to milliseconds
                endTime: end * 1000,
                quality: 'medium',
                saveToCameraRoll: false,
            });

            if (result && result.path) {
                onComplete(result.path);
            } else {
                throw new Error('Trim failed');
            }
        } catch (error) {
            console.error('Video trim error:', error);
            Alert.alert(t('common.error'), 'Failed to trim video. Please try again.');
        } finally {
            setTrimming(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <Pressable style={[styles.overlay, { backgroundColor: palette.scrim }]} onPress={onCancel}>
                <View
                  style={[styles.modal, shadows.strong, { backgroundColor: palette.surface }]}
                  onStartShouldSetResponder={() => true}
                >
                    <View style={styles.header}>
                        <AppText variant="heading2">{t('upload.trim')}</AppText>
                        <Pressable onPress={onCancel} hitSlop={8}>
                            <Ionicons name="close" size={24} color={palette.text.primary} />
                        </Pressable>
                    </View>

                    <View style={styles.content}>
                        <AppText variant="body" style={styles.label}>
                            Start Time (seconds)
                        </AppText>
                        <View style={[styles.inputContainer, { borderColor: palette.border, backgroundColor: palette.background }]}>
                            <TextInput
                                style={[styles.input, { color: palette.text.primary }]}
                                value={startTime}
                                onChangeText={setStartTime}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={palette.text.secondary}
                            />
                        </View>

                        <AppText variant="body" style={styles.label}>
                            End Time (seconds)
                        </AppText>
                        <View style={[styles.inputContainer, { borderColor: palette.border, backgroundColor: palette.background }]}>
                            <TextInput
                                style={[styles.input, { color: palette.text.primary }]}
                                value={endTime}
                                onChangeText={setEndTime}
                                keyboardType="numeric"
                                placeholder="10"
                                placeholderTextColor={palette.text.secondary}
                            />
                        </View>

                        <AppText variant="caption" style={{ color: palette.text.secondary, marginTop: spacing.sm }}>
                            Clip will be trimmed from {startTime}s to {endTime}s ({(parseFloat(endTime) - parseFloat(startTime)).toFixed(1)}s duration)
                        </AppText>
                    </View>

                    <View style={styles.actions}>
                        {trimming ? (
                            <ActivityIndicator color={palette.accent} />
                        ) : (
                            <>
                                <Button label={t('common.cancel')} onPress={onCancel} variant="outline" style={{ flex: 1 }} />
                                <Button label={t('common.save')} onPress={handleTrim} style={{ flex: 1 }} />
                            </>
                        )}
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modal: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    content: {
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    label: {
        marginTop: spacing.sm,
    },
    inputContainer: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    input: {
        fontSize: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
});
