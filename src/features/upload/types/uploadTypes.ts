export type NormalizedVideoAsset = {
  normalizedUri: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  sourceScheme: string;
};

export type UploadValidationErrorCode =
  | 'empty_file'
  | 'too_large'
  | 'unsupported_source'
  | 'file_unreadable';

export class UploadValidationError extends Error {
  constructor(
    public code: UploadValidationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export type UploadProcessingOutcome = 'published' | 'processing' | 'failed';
