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
