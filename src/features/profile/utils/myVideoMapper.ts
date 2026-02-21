import { MyVideoItem, UserDto, UserVideoDto } from '@/src/shared/types/api';
import { CDN_BASE_URL } from '@/src/shared/utils/env';

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

function resolveThumbnail(raw: UserVideoDto): {
  url: string | null;
  source: 'backend' | 'derived_from_url' | 'derived_from_cdn' | 'none';
} {
  const snake = (raw as { thumbnail_url?: unknown }).thumbnail_url;
  if (typeof snake === 'string' && snake.length > 0) {
    return {
      url: snake,
      source: 'backend',
    };
  }

  const camel = (raw as { thumbnailUrl?: unknown }).thumbnailUrl;
  if (typeof camel === 'string' && camel.length > 0) {
    return {
      url: camel,
      source: 'backend',
    };
  }

  if (typeof raw.url === 'string' && raw.url.length > 0) {
    const slashIndex = raw.url.lastIndexOf('/');
    if (slashIndex > 0) {
      return {
        url: `${raw.url.slice(0, slashIndex + 1)}${raw.id}_thumb.jpg`,
        source: 'derived_from_url',
      };
    }
  }

  if (raw.status === 'PUBLISHED') {
    return {
      url: `${CDN_BASE_URL.replace(/\/$/, '')}/videos-public/${raw.id}_thumb.jpg`,
      source: 'derived_from_cdn',
    };
  }

  return {
    url: null,
    source: 'none',
  };
}

export function mapUserVideoDtoToMyVideoItem(
  raw: UserVideoDto,
  currentUser: UserDto | null,
  options?: MapperOptions
): MyVideoItem {
  const resolvedIsLiked = resolveIsLiked(raw);
  const resolvedThumbnail = resolveThumbnail(raw);

  return {
    id: raw.id,
    title: raw.title ?? null,
    description: raw.description ?? null,
    status: raw.status,
    created_at: raw.created_at,
    updated_at: resolveUpdatedAt(raw),
    is_anonymous: raw.is_anonymous,
    is_nsfw: typeof raw.is_nsfw === 'boolean' ? raw.is_nsfw : null,
    like_count: raw.like_count ?? 0,
    is_liked: resolvedIsLiked ?? options?.fallbackIsLiked ?? false,
    url: raw.url ?? null,
    thumbnail_url: resolvedThumbnail.url,
    thumbnail_source: resolvedThumbnail.source,
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
