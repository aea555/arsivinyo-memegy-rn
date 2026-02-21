export type UserDto = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  age_confirmed: boolean;
  terms_accepted: boolean;
  required_terms_version: string;
  accepted_terms_version?: string | null;
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
  requires_age_confirmation: boolean;
  required_terms_version: string;
  terms_url?: string | null;
  rules: UsernameRulesDto;
};

export type ExchangeOtcResult =
  | { kind: 'authenticated'; data: AuthResponse }
  | { kind: 'username_required'; data: ExchangeOtcUsernameRequiredResponse };

export type SignupCompleteRequest = {
  signup_ticket: string;
  username: string;
  age_confirmed: boolean;
  terms_version: string;
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
  thumbnail_url?: string | null;
  like_count: number;
  created_at: string;
  uploader?: UploaderInfo | null;
  is_nsfw: boolean;
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
  is_nsfw?: boolean | null;
  like_count: number;
  is_liked?: boolean;
  url: string | null;
  thumbnail_url?: string | null;
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
  is_nsfw?: boolean | null;
  like_count: number;
  is_liked: boolean;
  uploader: UploaderInfo | null;
  url: string | null;
  thumbnail_url?: string | null;
  thumbnail_source?: 'backend' | 'derived_from_url' | 'derived_from_cdn' | 'none';
  processing_error_code?: string | null;
  processing_error_message?: string | null;
};

export type InitUploadRequest = {
  filename: string;
  size_bytes: number;
  is_nsfw: boolean;
};

export type InitUploadResponse = {
  video_id: string;
  upload_url: string;
};

export type UpdateVideoRequest = {
  title?: string | null;
  description?: string | null;
  is_anonymous?: boolean | null;
  is_nsfw?: boolean | null;
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

export type OnboardingStatusResponse = {
  completed: boolean;
  age_confirmed: boolean;
  terms_accepted: boolean;
  required_terms_version: string;
  accepted_terms_version?: string | null;
  terms_url?: string | null;
};

export type CompleteOnboardingRequest = {
  age_confirmed: boolean;
  terms_version: string;
};

export type TermsResponse = {
  version: string;
  url?: string | null;
  content_type?: string | null;
  content_sha256?: string | null;
  content?: string | null;
  effective_at?: string | null;
  jurisdictions: string[];
  legal_contact_email?: string | null;
  abuse_contact_email?: string | null;
};

export type ModeStatusResponse = {
  enabled: boolean;
};

export type AbuseReasonCode =
  | 'PORNOGRAPHY'
  | 'CHILD_SEXUAL_ABUSE_MATERIAL'
  | 'MINOR_SEXUAL_EXPLOITATION'
  | 'RAPE_GLORIFICATION'
  | 'PEDOPHILIC_CONTENT'
  | 'ZOOPHILIA_OR_BESTIALITY'
  | 'NECROPHILIA'
  | 'EXPLICIT_SEXUAL_CONTENT'
  | 'ILLEGAL_SUBSTANCE_PROMOTION'
  | 'MALICIOUS_OR_MANIPULATIVE'
  | 'GRAPHIC_OR_DISTURBING'
  | 'MURDER_OR_SERIOUS_INJURY'
  | 'CORPSE_CONTENT'
  | 'NSFW_MISTAGGED'
  | 'HATE_OR_RACISM'
  | 'OTHER';

export type ReportVideoRequest = {
  reason_codes: AbuseReasonCode[];
  details?: string | null;
  timestamp_seconds?: number | null;
};

export type VideoReportDto = {
  id: string;
  video_id: string;
  reporter_user_id: string;
  reason_codes: string[];
  details?: string | null;
  timestamp_seconds?: number | null;
  severity_score: number;
  status: string;
  auto_quarantined: boolean;
  auto_rule?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  resolution_code?: string | null;
  resolution_note?: string | null;
};

export type ReportVideoResponse = {
  created: boolean;
  report: VideoReportDto;
};

export type MyReportItem = {
  report: VideoReportDto;
  video_title?: string | null;
  video_status?: string | null;
  video_moderation_state?: string | null;
};

export type MyReportsResponse = {
  items: MyReportItem[];
  next_cursor?: number | null;
};
