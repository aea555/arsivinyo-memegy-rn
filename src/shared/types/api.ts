export type UserDto = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: UserDto;
};

export type UsernameRulesDto = {
  min_length: number;
  max_length: number;
  pattern: string;
};

export type ExchangeOtcUsernameRequiredResponse = {
  error: 'username_required';
  signup_ticket: string;
  suggested_username: string;
  rules: UsernameRulesDto;
};

export type ExchangeOtcResult =
  | { kind: 'authenticated'; data: AuthResponse }
  | { kind: 'username_required'; data: ExchangeOtcUsernameRequiredResponse };

export type SignupCompleteRequest = {
  signup_ticket: string;
  username: string;
};

export type UpdateUsernameRequest = {
  username: string;
};

export type ApiErrorResponse = {
  error?: string;
  message?: string;
  detail?: string;
};

export type RefreshRequest = {
  access_token: string;
  refresh_token: string;
};

export type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

export type UploaderInfo = {
  id: string;
  username: string;
};

export type VideoStatus = 'DRAFT' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

export type VideoFeedItem = {
  id: string;
  title?: string | null;
  url: string;
  like_count: number;
  created_at: string;
  uploader?: UploaderInfo | null;
  is_liked?: boolean;
  description?: string | null;
};

export type UserVideoDto = {
  id: string;
  title?: string | null;
  description?: string | null;
  status: VideoStatus;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  like_count: number;
  is_liked?: boolean;
  url: string | null;
  uploader?: UploaderInfo | null;
  processing_error_code?: string | null;
  processing_error_message?: string | null;
};

export type MyVideoItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  status: VideoStatus;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  like_count: number;
  is_liked: boolean;
  uploader: UploaderInfo | null;
  url: string | null;
  processing_error_code?: string | null;
  processing_error_message?: string | null;
};

export type InitUploadRequest = {
  filename: string;
  size_bytes: number;
};

export type InitUploadResponse = {
  video_id: string;
  upload_url: string;
};

export type UpdateVideoRequest = {
  title?: string | null;
  description?: string | null;
  is_anonymous?: boolean | null;
};

export type RefreshDownloadResponse = {
  download_url: string;
  expires_in_seconds: number;
};

export type BulkDownloadCreateRequest = {
  video_ids: string[];
};

export type BulkDownloadCreateResponse = {
  job_id: string;
  status: string;
};

export type BulkDownloadStatusResponse = {
  job_id: string;
  status: string;
  download_url?: string | null;
  expires_in_seconds?: number | null;
};
