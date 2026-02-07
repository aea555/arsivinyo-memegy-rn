import {
  utf8ByteLength,
  VIDEO_DESCRIPTION_MAX_BYTES,
  VIDEO_TITLE_MAX_BYTES,
} from '@/src/shared/utils/inputLimits';

export function validateTitle(title: string) {
  return title.trim().length > 0 && utf8ByteLength(title) <= VIDEO_TITLE_MAX_BYTES;
}

export function validateDescription(description: string) {
  return utf8ByteLength(description) <= VIDEO_DESCRIPTION_MAX_BYTES;
}
