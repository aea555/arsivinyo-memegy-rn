import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { pickVideo, getVideoSize, uploadVideo } from '@/src/features/upload/hooks/useVideoUpload';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Input } from '@/src/shared/components/ui/Input';
import { Screen } from '@/src/shared/components/layout/Screen';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function UploadScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const router = useRouter();

  const [assetUri, setAssetUri] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    try {
      const asset = await pickVideo();
      if (!asset) return;
      setAssetUri(asset.uri);
      setFilename(asset.fileName ?? 'upload.mp4');
    } catch {
      Alert.alert(t('common.error'), t('upload.pickError'));
    }
  };

  const handleUpload = async () => {
    if (!assetUri) return;
    setLoading(true);

    try {
      const sizeBytes = await getVideoSize(assetUri);

      await uploadVideo({
        assetUri,
        filename: filename || 'upload.mp4',
        sizeBytes,
        isAnonymous,
        metadata: {
          title: title.trim() || null,
          description: description.trim() || null,
          is_anonymous: isAnonymous,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      await queryClient.invalidateQueries({ queryKey: ['myVideos'] });

      Alert.alert(t('upload.success'));
      router.back();
    } catch (error: any) {
      if (error?.message === 'too_large') {
        Alert.alert(t('common.error'), t('upload.tooLarge'));
      } else if (error?.response?.status === 429) {
        Alert.alert(t('common.error'), t('upload.rateLimited'));
      } else {
        Alert.alert(t('common.error'), t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <AppText variant="heading2">{t('upload.title')}</AppText>
      <View style={styles.content}>
        <Button label={t('upload.selectVideo')} onPress={handlePick} />
        {assetUri ? <AppText variant="caption">{filename}</AppText> : null}
        <Input placeholder={t('upload.videoTitle')} value={title} onChangeText={setTitle} />
        <Input
          placeholder={t('upload.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.textArea}
        />
        <View style={styles.toggleRow}>
          <AppText>{t('upload.anonymous')}</AppText>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        </View>
      </View>
      <View style={styles.footer}>
        {loading ? <ActivityIndicator color={palette.accent} /> : null}
        <Button label={t('upload.title')} onPress={handleUpload} disabled={!assetUri || loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  content: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
