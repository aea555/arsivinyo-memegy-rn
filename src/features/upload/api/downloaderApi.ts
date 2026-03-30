import LocalDownloaderModule, {
  isLocalDownloaderRuntimeAvailable,
  type LocalDownloadStartInput,
  type LocalPlatform,
} from '@/src/native/localDownloader';

const KNOWN_NATIVE_ERROR_CODES = [
  'INVALID_URL',
  'UNSUPPORTED_PLATFORM',
  'DOWNLOAD_ALREADY_IN_PROGRESS',
  'FILE_TOO_LARGE',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_CANCELLED',
  'TASK_CANCELLED',
  'COOKIE_STORE_ENCRYPT_FAILED',
  'COOKIE_STORE_DECRYPT_FAILED',
  'COOKIE_MIGRATION_FAILED',
  'COOKIE_PROFILE_NOT_FOUND',
  'REDDIT_COOKIE_REQUIRED',
  'FFMPEG_NATIVE_RUNTIME_UNAVAILABLE',
  'FFMPEG_MISSING',
  'FFPROBE_MISSING',
  'MERGE_DEPENDENCY_MISSING',
  'SITE_BLOCKED_403',
  'COOKIE_STALE_OR_INVALID',
  'TIKTOK_API_STATUS_ZERO',
  'TIKTOK_EXTRACTOR_UNSTABLE',
  'IMPERSONATION_BOOTSTRAP_FAILED',
  'IMPERSONATION_TARGET_REQUIRED_UNAVAILABLE',
  'IMPERSONATION_DEPENDENCY_MISSING',
  'IMPERSONATION_RUNTIME_UNAVAILABLE',
  'COOKIE_DOMAIN_MISMATCH',
  'COOKIE_EMPTY_OR_EXPIRED',
  'TIMESTAMP_POSTPROCESS_FAILED',
  'PREFLIGHT_FAILED',
  'INTERNAL_ERROR',
  'FILE_NOT_FOUND',
] as const;

const START_FAILURE_CODES = new Set<string>([
  'INVALID_URL',
  'UNSUPPORTED_PLATFORM',
  'DOWNLOAD_ALREADY_IN_PROGRESS',
  'FILE_TOO_LARGE',
  'COOKIE_PROFILE_NOT_FOUND',
  'FFMPEG_NATIVE_RUNTIME_UNAVAILABLE',
  'FFMPEG_MISSING',
  'FFPROBE_MISSING',
  'MERGE_DEPENDENCY_MISSING',
  'PREFLIGHT_FAILED',
  'INTERNAL_ERROR',
]);

export type DownloaderTaskStatus = {
  taskId: string;
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'UNKNOWN';
  filename: string | null;
  filePath: string | null;
  message: string | null;
  errorCode: string | null;
  progressPercent: number | null;
};

export type StartLocalDownloadInput = {
  url: string;
  cookiePlatform?: LocalPlatform;
  cookieProfile?: string;
  maxFileSizeMb?: number;
};

export class DownloaderApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'DownloaderApiError';
  }
}

function ensureDownloaderRuntimeAvailable() {
  if (!isLocalDownloaderRuntimeAvailable) {
    throw new DownloaderApiError(
      'DOWNLOADER_UNAVAILABLE',
      0,
      'Local downloader is available on Android builds only.'
    );
  }
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Unknown downloader error');
}

function extractNativeCode(message: string): string {
  const matched = KNOWN_NATIVE_ERROR_CODES.find((code) => message.includes(code));
  return matched ?? 'UNKNOWN_ERROR';
}

function toDownloaderError(error: unknown, fallbackCode: string): DownloaderApiError {
  const message = normalizeErrorMessage(error);
  const nativeCode = extractNativeCode(message);
  const code = nativeCode === 'UNKNOWN_ERROR' ? fallbackCode : nativeCode;
  return new DownloaderApiError(code, 0, message);
}

function normalizeStatus(rawStatus: unknown): DownloaderTaskStatus['status'] {
  if (
    rawStatus === 'PENDING' ||
    rawStatus === 'STARTED' ||
    rawStatus === 'PROGRESS' ||
    rawStatus === 'SUCCESS' ||
    rawStatus === 'FAILURE' ||
    rawStatus === 'CANCELLED'
  ) {
    return rawStatus;
  }
  return 'UNKNOWN';
}

function toStartInput(input: StartLocalDownloadInput): LocalDownloadStartInput {
  return {
    url: input.url,
    cookiePlatform: input.cookiePlatform,
    cookieProfile: input.cookieProfile,
    maxFileSizeMb: input.maxFileSizeMb,
  };
}

export async function startDownload(input: StartLocalDownloadInput): Promise<{ taskId: string }> {
  ensureDownloaderRuntimeAvailable();

  try {
    const result = await LocalDownloaderModule.startDownload(toStartInput(input));
    if (!result?.taskId) {
      throw new DownloaderApiError('DOWNLOADER_START_FAILED', 0, 'Downloader failed to start.');
    }

    return { taskId: result.taskId };
  } catch (error) {
    const normalized = toDownloaderError(error, 'DOWNLOADER_START_FAILED');
    if (START_FAILURE_CODES.has(normalized.code)) {
      throw normalized;
    }
    throw new DownloaderApiError('DOWNLOADER_START_FAILED', 0, normalized.message);
  }
}

export async function getTaskStatus(taskId: string): Promise<DownloaderTaskStatus> {
  ensureDownloaderRuntimeAvailable();

  try {
    const result = await LocalDownloaderModule.getTaskStatus(taskId);

    return {
      taskId: result.taskId ?? taskId,
      status: normalizeStatus(result.status),
      filename: result.filename ?? null,
      filePath: result.filePath ?? null,
      message: result.errorMessage ?? null,
      errorCode: result.errorCode ?? null,
      progressPercent:
        typeof result.progressPercent === 'number' && Number.isFinite(result.progressPercent)
          ? result.progressPercent
          : null,
    };
  } catch (error) {
    throw toDownloaderError(error, 'DOWNLOADER_STATUS_FAILED');
  }
}

export async function cancelTask(taskId: string): Promise<{ success: boolean }> {
  ensureDownloaderRuntimeAvailable();

  try {
    const result = await LocalDownloaderModule.cancelTask(taskId);
    return { success: Boolean(result?.success) };
  } catch (error) {
    throw toDownloaderError(error, 'DOWNLOADER_CANCEL_FAILED');
  }
}
