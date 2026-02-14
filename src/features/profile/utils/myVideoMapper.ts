import { MyVideoItem, UserDto, UserVideoDto } from '@/src/shared/types/api';

type MapperOptions = {
  fallbackIsLiked?: boolean;
};

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveIsLiked(raw: UserVideoDto): boolean | undefined {
  const snake = pickBoolean((raw as { is_liked?: unknown }).is_liked);
  const camel = pickBoolean((raw as { isLiked?: unknown }).isLiked);
  return snake ?? camel;
}

function resolveUpdatedAt(raw: UserVideoDto): string {
  const snake = (raw as { updated_at?: unknown }).updated_at;
  if (typeof snake === 'string' && snake.length > 0) return snake;

  const camel = (raw as { updatedAt?: unknown }).updatedAt;
  if (typeof camel === 'string' && camel.length > 0) return camel;

  return raw.created_at;
}

function resolveProcessingErrorCode(raw: UserVideoDto) {
  const snake = (raw as { processing_error_code?: unknown }).processing_error_code;
  if (typeof snake === 'string') return snake;
  return null;
}

function resolveProcessingErrorMessage(raw: UserVideoDto) {
  const snake = (raw as { processing_error_message?: unknown }).processing_error_message;
  if (typeof snake === 'string') return snake;
  return null;
}

export function mapUserVideoDtoToMyVideoItem(
  raw: UserVideoDto,
  currentUser: UserDto | null,
  options?: MapperOptions
): MyVideoItem {
  const resolvedIsLiked = resolveIsLiked(raw);

  return {
    id: raw.id,
    title: raw.title ?? null,
    description: raw.description ?? null,
    status: raw.status,
    created_at: raw.created_at,
    updated_at: resolveUpdatedAt(raw),
    is_anonymous: raw.is_anonymous,
    like_count: raw.like_count ?? 0,
    is_liked: resolvedIsLiked ?? options?.fallbackIsLiked ?? false,
    url: raw.url ?? null,
    processing_error_code: resolveProcessingErrorCode(raw),
    processing_error_message: resolveProcessingErrorMessage(raw),
    uploader:
      raw.uploader ??
      (raw.is_anonymous
        ? null
        : currentUser
          ? {
              id: currentUser.id,
              username: currentUser.username,
            }
          : null),
  };
}
