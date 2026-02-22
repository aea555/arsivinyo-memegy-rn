import { spacing } from '@/src/shared/theme/spacing';

export type FeedActionId =
  | 'mute'
  | 'like'
  | 'download'
  | 'report'
  | 'shareHub'
  | 'quickShare'
  | 'share';

export type FeedActionSlot = 'topRight' | 'rightRail' | 'bottomRight';

export type FeedActionLayoutPresetId = 'feed_balanced_compact_v1';

export type FeedActionLayoutPreset = {
  id: FeedActionLayoutPresetId;
  slots: Record<FeedActionId, FeedActionSlot>;
  topRight: {
    topOffset: number;
    rightOffset: number;
    scale: number;
  };
  rightRail: {
    rightOffset: number;
    bottomOffset: number;
    gap: number;
    scale: number;
  };
  bottomRight: {
    rightOffset: number;
    bottomOffset: number;
    scale: number;
  };
  shareHub: {
    direction: 'left';
    distance: number;
    collapseAfterMs: number;
    childScale: number;
  };
};

export const FEED_ACTION_LAYOUT_PRESETS: Record<FeedActionLayoutPresetId, FeedActionLayoutPreset> = {
  feed_balanced_compact_v1: {
    id: 'feed_balanced_compact_v1',
    slots: {
      mute: 'rightRail',
      like: 'rightRail',
      download: 'rightRail',
      report: 'topRight',
      shareHub: 'bottomRight',
      quickShare: 'bottomRight',
      share: 'bottomRight',
    },
    topRight: {
      topOffset: Math.max(0, spacing.sm - 3),
      rightOffset: 12,
      scale: 0.9,
    },
    rightRail: {
      rightOffset: 10,
      bottomOffset: 84,
      gap: 2,
      scale: 0.9,
    },
    bottomRight: {
      rightOffset: 10,
      bottomOffset: 24,
      scale: 0.9,
    },
    shareHub: {
      direction: 'left',
      distance: 54,
      collapseAfterMs: 2200,
      childScale: 0.84,
    },
  },
};

export const DEFAULT_FEED_ACTION_LAYOUT_PRESET: FeedActionLayoutPresetId = 'feed_balanced_compact_v1';

export function resolveFeedActionLayoutPreset(
  presetId: FeedActionLayoutPresetId = DEFAULT_FEED_ACTION_LAYOUT_PRESET,
): FeedActionLayoutPreset {
  return FEED_ACTION_LAYOUT_PRESETS[presetId] ?? FEED_ACTION_LAYOUT_PRESETS[DEFAULT_FEED_ACTION_LAYOUT_PRESET];
}
