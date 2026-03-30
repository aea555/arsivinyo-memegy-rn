export type LocalPlatform = 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'reddit' | 'tiktok';

export interface LocalDownloadStartInput {
  url: string;
  cookiePlatform?: LocalPlatform;
  cookieProfile?: string;
  // 0 or undefined means unlimited file size.
  maxFileSizeMb?: number;
  visibility?: 'public' | 'private';
}

export interface LocalDownloadStartResult {
  taskId: string;
  estimatedSizeMb?: number | null;
}

export interface LocalBackgroundState {
  serviceRunning: boolean;
  activeTaskId: string | null;
  queueSize: number;
  maxQueueSize?: number;
  queuedUrls: string[];
  lastQuickReason?: string | null;
  notificationPhase?: string;
  notificationPermissionRequired: boolean;
  notificationPermissionGranted: boolean;
  quickUploadSettings?: LocalQuickUploadSettings;
  pendingQuickUploadCount?: number;
  pendingQuickMetadataCount?: number;
}

export interface LocalBackgroundPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

export interface LocalQuickUploadSettings {
  nsfwDefault: boolean;
  anonymousDefault: boolean;
  saveToDeviceDefault: boolean;
  askMetadata: boolean;
}

export interface LocalQuickDownloadResult {
  accepted: boolean;
  metadataRequired?: boolean;
  reason?:
    | 'NO_CLIPBOARD_URL'
    | 'INVALID_QUICK_URL'
    | 'QUEUE_FULL'
    | 'PERMISSION_REQUIRED'
    | 'ALREADY_ACTIVE'
    | 'QUICK_DOWNLOAD_REJECTED'
    | 'QUICK_CAPTURE_CANCELLED';
  taskId?: string;
  queueSize?: number;
  queueMax?: number;
  resolvedUrl?: string | null;
  visibility?: 'public' | 'private';
  captureMode?: 'clipboard' | 'manual';
}

export interface LocalPendingQuickUpload {
  taskId: string;
  url: string | null;
  filePath: string;
  filename: string;
  titleHint?: string | null;
  customTitle?: string | null;
  customDescription?: string | null;
  anonymousDefault: boolean;
  nsfwDefault: boolean;
  saveToDeviceDefault: boolean;
  createdAtMs: number;
}

export interface LocalPendingQuickMetadataRequest {
  requestId: string;
  url: string;
  captureMode: 'clipboard' | 'manual';
  createdAtMs: number;
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

export interface LocalCustomCookieImportInput {
  uri: string;
  profileName?: string;
  domain?: string | null;
}

export interface LocalCustomCookieImportResult {
  profileId: string;
  profileName: string;
  detectedDomains: string[];
  boundDomains: string[];
}

export interface LocalCustomDomainSummary {
  domain: string;
  profileCount: number;
  defaultProfileName: string | null;
}

export interface LocalCustomDomainProfile {
  profileName: string;
  profileId: string;
  lastModified: number;
}

export interface LocalDownloadEvent {
  taskId: string;
  status: LocalTaskStatus;
  state: 'starting' | 'downloading' | 'processing' | 'saving' | 'completed' | 'error';
  message?: string;
  progressPercent?: number;
  speedBytesPerSec?: number;
}

export interface LocalBackgroundStateEvent extends LocalBackgroundState {}
