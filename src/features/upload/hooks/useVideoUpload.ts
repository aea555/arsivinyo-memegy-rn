import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { confirmUpload, initAnonymousUpload, initUpload, updateVideoMetadata } from '@/src/features/upload/api/uploadApi';
import { MAX_UPLOAD_SIZE_BYTES } from '@/src/shared/utils/constants';
import { UpdateVideoRequest } from '@/src/shared/types/api';

export type UploadResult = {
  videoId: string;
};

export async function pickVideo({ allowsEditing = true }: { allowsEditing?: boolean } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('permissions');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing,
    quality: 1,
    videoMaxDuration: 60,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0];
}

export async function uploadVideo({
  assetUri,
  filename,
  sizeBytes,
  isAnonymous,
  metadata,
}: {
  assetUri: string;
  filename: string;
  sizeBytes: number;
  isAnonymous: boolean;
  metadata: UpdateVideoRequest;
}): Promise<UploadResult> {
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    const error = new Error('too_large');
    throw error;
  }

  const initPayload = { filename, size_bytes: sizeBytes };
  const initResponse = isAnonymous ? await initAnonymousUpload(initPayload) : await initUpload(initPayload);

  const uploadResult = await FileSystem.uploadAsync(initResponse.upload_url, assetUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': 'video/mp4',
    },
  });

  if (uploadResult.status !== 200) {
    throw new Error('upload_failed');
  }

  await confirmUpload(initResponse.video_id);

  if (metadata.title || metadata.description || metadata.is_anonymous !== undefined) {
    await updateVideoMetadata(initResponse.video_id, metadata);
  }

  return { videoId: initResponse.video_id };
}

export async function getVideoSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return 0;
  if ('size' in info && typeof info.size === 'number') {
    return info.size;
  }
  return 0;
}
