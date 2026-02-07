import NetInfo from '@react-native-community/netinfo';
import { InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { mapUserVideoDtoToMyVideoItem } from '@/src/features/profile/utils/myVideoMapper';
import { subscribeTokenRefresh } from '@/src/shared/services/api/authEvents';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { SecureStorage } from '@/src/shared/services/storage/SecureStorage';
import { MY_VIDEOS_PAGE_SIZE } from '@/src/shared/utils/constants';
import { API_BASE_URL } from '@/src/shared/utils/env';
import { MyVideoItem, UserVideoDto } from '@/src/shared/types/api';
import { useAuthStore } from '@/src/store/authStore';

const LIVE_EVENT_TYPES = new Set([
  'video.status.processing',
  'video.status.published',
  'video.status.failed',
]);

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const RECONNECT_JITTER_MS = 500;
const MAX_SEEN_EVENT_IDS = 250;
const BACKGROUND_CLOSE_GRACE_MS = 3_000;

type RNWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => WebSocket;

type SnapshotEvent = {
  type: 'video.status.snapshot';
  videos: UserVideoDto[];
};

type LiveStatusEvent = {
  type: 'video.status.processing' | 'video.status.published' | 'video.status.failed';
  event_id: string;
  event_at: string;
  version: 1;
  previous_status: string | null;
  video: UserVideoDto;
};

function buildMyVideosWsUrl() {
  try {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const basePath = url.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/users/me/videos/ws`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    const base = API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '');
    return `${base}/users/me/videos/ws`;
  }
}

function chunkVideos(videos: MyVideoItem[]) {
  const pages: MyVideoItem[][] = [];
  for (let index = 0; index < videos.length; index += MY_VIDEOS_PAGE_SIZE) {
    pages.push(videos.slice(index, index + MY_VIDEOS_PAGE_SIZE));
  }
  if (pages.length === 0) {
    pages.push([]);
  }
  return pages;
}

function buildInfiniteData(videos: MyVideoItem[]): InfiniteData<MyVideoItem[]> {
  const pages = chunkVideos(videos);
  return {
    pages,
    pageParams: pages.map((_page, index) => index + 1),
  };
}

function getTimestampMs(value: string | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIncomingNewer(current: MyVideoItem, incoming: MyVideoItem) {
  return getTimestampMs(incoming.updated_at) >= getTimestampMs(current.updated_at);
}

function upsertByUpdatedAt(items: MyVideoItem[], incoming: MyVideoItem) {
  const currentIndex = items.findIndex((item) => item.id === incoming.id);
  if (currentIndex === -1) {
    return [incoming, ...items];
  }

  const current = items[currentIndex];
  if (!isIncomingNewer(current, incoming)) {
    return items;
  }

  const next = [...items];
  next[currentIndex] = incoming;
  return next;
}

function truncateForLog(payload: string) {
  if (payload.length <= 220) return payload;
  return `${payload.slice(0, 220)}...`;
}

export function useMyVideosRealtimeSync() {
  const status = useAuthStore((state) => state.status);

  const wsUrl = useMemo(() => buildMyVideosWsUrl(), []);

  const wsRef = useRef<WebSocket | null>(null);
  const authStatusRef = useRef(status);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldSkipReconnectOnNextCloseRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isNetworkConnectedRef = useRef(true);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenEventIdOrderRef = useRef<string[]>([]);

  useEffect(() => {
    authStatusRef.current = status;
  }, [status]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearBackgroundCloseTimer = useCallback(() => {
    if (backgroundCloseTimerRef.current) {
      clearTimeout(backgroundCloseTimerRef.current);
      backgroundCloseTimerRef.current = null;
    }
  }, []);

  const shouldConnect = useCallback(() => {
    return (
      authStatusRef.current === 'authenticated' &&
      appStateRef.current === 'active' &&
      isNetworkConnectedRef.current
    );
  }, []);

  const rememberEventId = useCallback((eventId: string) => {
    if (seenEventIdsRef.current.has(eventId)) {
      return false;
    }

    seenEventIdsRef.current.add(eventId);
    seenEventIdOrderRef.current.push(eventId);

    if (seenEventIdOrderRef.current.length > MAX_SEEN_EVENT_IDS) {
      const oldest = seenEventIdOrderRef.current.shift();
      if (oldest) {
        seenEventIdsRef.current.delete(oldest);
      }
    }

    return true;
  }, []);

  const replaceFromSnapshot = useCallback((videos: UserVideoDto[]) => {
    const currentUser = useAuthStore.getState().user;
    queryClient.setQueryData<InfiniteData<MyVideoItem[]>>(['myVideos'], (old) => {
      const existingById = new Map<string, MyVideoItem>();
      old?.pages
        .flat()
        .forEach((item) => {
          existingById.set(item.id, item);
        });

      const mapped = videos.map((video) =>
        mapUserVideoDtoToMyVideoItem(video, currentUser, {
          fallbackIsLiked: existingById.get(video.id)?.is_liked,
        })
      );

      return buildInfiniteData(mapped);
    });
  }, []);

  const upsertFromLiveEvent = useCallback((video: UserVideoDto) => {
    const currentUser = useAuthStore.getState().user;

    queryClient.setQueryData<InfiniteData<MyVideoItem[]>>(['myVideos'], (old) => {
      if (!old) {
        const mapped = mapUserVideoDtoToMyVideoItem(video, currentUser);
        return buildInfiniteData([mapped]);
      }

      const flattened = old.pages.flat();
      const existing = flattened.find((item) => item.id === video.id);
      const mapped = mapUserVideoDtoToMyVideoItem(video, currentUser, {
        fallbackIsLiked: existing?.is_liked,
      });
      const next = upsertByUpdatedAt(flattened, mapped);
      return buildInfiniteData(next);
    });
  }, []);

  const closeSocket = useCallback((reason: string, skipReconnect: boolean) => {
    clearReconnectTimer();
    clearBackgroundCloseTimer();

    if (skipReconnect) {
      shouldSkipReconnectOnNextCloseRef.current = true;
    }

    const socket = wsRef.current;
    wsRef.current = null;
    if (!socket) return;

    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, reason);
      }
    } catch {
      // no-op
    }
  }, [clearBackgroundCloseTimer, clearReconnectTimer]);

  const scheduleReconnect = useCallback((trigger: string, connectFn: (reason: string) => Promise<void>) => {
    if (!shouldConnect()) return;

    reconnectAttemptsRef.current += 1;
    const exponential = BASE_RECONNECT_DELAY_MS * 2 ** (reconnectAttemptsRef.current - 1);
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, exponential) + Math.floor(Math.random() * RECONNECT_JITTER_MS);

    if (__DEV__) {
      console.debug('[myVideos.ws] reconnect scheduled', {
        trigger,
        attempt: reconnectAttemptsRef.current,
        delayMs: delay,
      });
    }

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      void connectFn(`reconnect:${trigger}`);
    }, delay);
  }, [clearReconnectTimer, shouldConnect]);

  const connect = useCallback(async (reason: string) => {
    if (!shouldConnect()) return;

    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = await SecureStorage.getAccessToken();
    if (!token) return;

    if (__DEV__) {
      console.debug('[myVideos.ws] connect attempt', { reason, url: wsUrl });
    }

    const WebSocketWithHeaders = WebSocket as unknown as RNWebSocketConstructor;
    const socket = new WebSocketWithHeaders(wsUrl, [], {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    wsRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      if (__DEV__) {
        console.debug('[myVideos.ws] open');
      }
    };

    socket.onmessage = (event) => {
      const rawPayload = typeof event.data === 'string' ? event.data : '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        if (__DEV__) {
          console.debug('[myVideos.ws] parse error', {
            payload: truncateForLog(rawPayload),
          });
        }
        return;
      }

      const typed = parsed as { type?: string };
      if (typed.type === 'video.status.snapshot') {
        const snapshot = parsed as SnapshotEvent;
        if (!Array.isArray(snapshot.videos)) return;

        replaceFromSnapshot(snapshot.videos);
        if (__DEV__) {
          console.debug('[myVideos.ws] snapshot', { size: snapshot.videos.length });
        }
        return;
      }

      if (!typed.type || !LIVE_EVENT_TYPES.has(typed.type)) {
        return;
      }

      const liveEvent = parsed as LiveStatusEvent;
      if (!liveEvent.event_id || !liveEvent.video) {
        return;
      }

      if (!rememberEventId(liveEvent.event_id)) {
        if (__DEV__) {
          console.debug('[myVideos.ws] duplicate event ignored', {
            event_id: liveEvent.event_id,
            type: liveEvent.type,
          });
        }
        return;
      }

      upsertFromLiveEvent(liveEvent.video);
      if (__DEV__) {
        console.debug('[myVideos.ws] live', {
          event_id: liveEvent.event_id,
          type: liveEvent.type,
          video_id: liveEvent.video.id,
          transition: `${liveEvent.previous_status ?? 'null'} -> ${liveEvent.video.status}`,
          updated_at: liveEvent.video.updated_at,
        });
      }
    };

    socket.onerror = () => {
      if (__DEV__) {
        console.debug('[myVideos.ws] error');
      }
    };

    socket.onclose = (event) => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }

      if (__DEV__) {
        console.debug('[myVideos.ws] close', {
          code: event.code,
          reason: event.reason,
        });
      }

      if (shouldSkipReconnectOnNextCloseRef.current) {
        shouldSkipReconnectOnNextCloseRef.current = false;
        return;
      }

      scheduleReconnect('socket_close', connect);
    };
  }, [rememberEventId, replaceFromSnapshot, scheduleReconnect, shouldConnect, upsertFromLiveEvent, wsUrl]);

  useEffect(() => {
    if (status === 'authenticated') {
      void connect('auth_success');
      return;
    }

    closeSocket('auth_not_authenticated', true);
    seenEventIdsRef.current.clear();
    seenEventIdOrderRef.current = [];
  }, [closeSocket, connect, status]);

  useEffect(() => {
    const unsubscribeAppState = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        clearBackgroundCloseTimer();
        void connect('app_foreground');
        return;
      }

      if (prevState === 'active' && nextState === 'inactive') {
        return;
      }

      if (nextState === 'background') {
        clearBackgroundCloseTimer();
        backgroundCloseTimerRef.current = setTimeout(() => {
          if (appStateRef.current === 'background') {
            closeSocket('app_background', true);
          }
        }, BACKGROUND_CLOSE_GRACE_MS);
      }
    });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasConnected = isNetworkConnectedRef.current;
      const isConnected = state.isConnected ?? false;
      isNetworkConnectedRef.current = isConnected;

      if (!wasConnected && isConnected) {
        void connect('network_regain');
        return;
      }

      if (wasConnected && !isConnected) {
        closeSocket('network_lost', true);
      }
    });

    const unsubscribeTokenRefresh = subscribeTokenRefresh(() => {
      if (!shouldConnect()) return;
      if (__DEV__) {
        console.debug('[myVideos.ws] token refresh restart');
      }
      closeSocket('token_refresh', true);
      void connect('token_refresh');
    });

    return () => {
      unsubscribeAppState.remove();
      unsubscribeNetInfo();
      unsubscribeTokenRefresh();
      clearBackgroundCloseTimer();
      closeSocket('unmount', true);
    };
  }, [clearBackgroundCloseTimer, closeSocket, connect, shouldConnect]);
}
