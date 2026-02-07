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
