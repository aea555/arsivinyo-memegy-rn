import { MAX_UPLOAD_SIZE_BYTES } from '@/src/shared/utils/constants';
import { NormalizedVideoAsset, UploadValidationError } from '@/src/features/upload/types/uploadTypes';

export function validateNormalizedVideoAsset(asset: NormalizedVideoAsset) {
  if (!asset.normalizedUri.startsWith('file://')) {
    throw new UploadValidationError('unsupported_source', 'Upload source must be a local file URI.');
  }

  if (!asset.filename || !asset.filename.includes('.')) {
    throw new UploadValidationError('file_unreadable', 'Upload file name is invalid.');
  }

  if (!Number.isFinite(asset.sizeBytes) || asset.sizeBytes <= 0) {
    throw new UploadValidationError('empty_file', 'Selected video file is empty.');
  }

  if (asset.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError('too_large', 'Selected video exceeds size limit.');
  }
}
