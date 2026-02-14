import { InfiniteData } from '@tanstack/react-query';

export function removeByIdFromInfinitePages<T extends { id: string }>(
  data: InfiniteData<T[]> | undefined,
  videoId: string
) {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) => page.filter((item) => item.id !== videoId)),
  };
}

export function patchByIdInInfinitePages<T extends { id: string }>(
  data: InfiniteData<T[]> | undefined,
  videoId: string,
  patch: (item: T) => T
) {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) => page.map((item) => (item.id === videoId ? patch(item) : item))),
  };
}
