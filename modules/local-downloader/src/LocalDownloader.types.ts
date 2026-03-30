export type LocalPlatform = 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'reddit' | 'tiktok';

export interface LocalDownloadStartInput {
  url: string;
  cookiePlatform?: LocalPlatform;
  cookieProfile?: string;
  // 0 or undefined means unlimited file size.
  maxFileSizeMb?: number;
}

export interface LocalDownloadStartResult {
  taskId: string;
  estimatedSizeMb?: number | null;
}

export type LocalTaskStatus = 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'CANCELLED';

export interface LocalTaskStatusResult {
  taskId: string;
  status: LocalTaskStatus;
  state?: 'starting' | 'downloading' | 'processing' | 'saving' | 'completed' | 'error';
  filename?: string;
  filePath?: string;
  sizeMb?: number;
  progressPercent?: number;
  speedBytesPerSec?: number;
  errorCode?: string;
  errorMessage?: string;
  estimatedSizeMb?: number | null;
  timestampNormalized?: boolean;
  warningCode?: string;
}

export interface LocalCookieProfile {
  profileName: string;
  path: string;
  lastModified: number;
}
