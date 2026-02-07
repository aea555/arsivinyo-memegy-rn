import { downloadVideoToTempFile, VideoDownloadStage } from '@/src/features/download/services/videoDownloadService';

export type QuickShareMode = 'whatsapp_then_system' | 'system_only';

type QuickShareParams = {
  videoId: string;
  suggestedName?: string | null;
  preferApp?: 'whatsapp' | null;
  caption?: string | null;
  onStageChange?: (stage: Extract<VideoDownloadStage, 'requesting' | 'downloading'>) => void;
  onProgress?: (progress: number) => void;
};

type QuickShareVideoParams = QuickShareParams & {
  mode?: QuickShareMode;
};

export type QuickShareResult = {
  transport: 'whatsapp' | 'system';
  usedFallback: boolean;
};

type ReactNativeShareModule = {
  Social?: {
    WHATSAPP?: string;
  };
  isPackageInstalled?: (packageName: string) => Promise<boolean | { isInstalled?: boolean }>;
  shareSingle?: (options: Record<string, unknown>) => Promise<unknown>;
};

async function shareWithSystem(fileUri: string, title?: string | null) {
  // Use runtime-resolved import so the app still compiles if expo-sharing
  // is not installed in the current environment.
  const expoSharingModuleName = 'expo-sharing';
  const sharingModule = (await import(expoSharingModuleName)) as {
    isAvailableAsync?: () => Promise<boolean>;
    shareAsync?: (
      uri: string,
      options?: { mimeType?: string; UTI?: string; dialogTitle?: string }
    ) => Promise<unknown>;
  };

  const available = typeof sharingModule?.isAvailableAsync === 'function'
    ? await sharingModule.isAvailableAsync()
    : false;

  if (!available || typeof sharingModule?.shareAsync !== 'function') {
    throw new Error('quick_share_unavailable');
  }

  await sharingModule.shareAsync(fileUri, {
    mimeType: 'video/mp4',
    UTI: 'public.movie',
    dialogTitle: title ?? undefined,
  });
}

async function getReactNativeShareModule(): Promise<ReactNativeShareModule | null> {
  const reactNativeShareModuleName = 'react-native-share';
  try {
    const module = (await import(reactNativeShareModuleName)) as ReactNativeShareModule & {
      default?: ReactNativeShareModule;
    };
    return module.default ?? module;
  } catch {
    return null;
  }
}

async function shareViaWhatsApp(fileUri: string, title?: string | null, _caption?: string | null) {
  const shareModule = await getReactNativeShareModule();
  if (!shareModule || typeof shareModule.shareSingle !== 'function') {
    return false;
  }

  const whatsappSocial = shareModule.Social?.WHATSAPP;
  if (!whatsappSocial) {
    return false;
  }

  if (typeof shareModule.isPackageInstalled === 'function') {
    try {
      const installedCheck = await shareModule.isPackageInstalled('com.whatsapp');
      const isInstalled = typeof installedCheck === 'boolean'
        ? installedCheck
        : installedCheck?.isInstalled === true;
      if (!isInstalled) {
        return false;
      }
    } catch {
      return false;
    }
  }

  try {
    await shareModule.shareSingle({
      social: whatsappSocial,
      url: fileUri,
      type: 'video/mp4',
      // WhatsApp may fail to send video payloads when both media and prefilled
      // caption text are provided in this direct-share path.
      title: title ?? undefined,
      failOnCancel: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function quickShareVideoSystem({
  videoId,
  suggestedName,
  caption: _caption,
  onStageChange,
  onProgress,
}: QuickShareParams): Promise<QuickShareResult> {
  const tempFile = await downloadVideoToTempFile({
    videoId,
    suggestedName,
    onStageChange,
    onProgress,
  });

  try {
    await shareWithSystem(tempFile.uri, suggestedName);
    return { transport: 'system', usedFallback: false };
  } finally {
    await tempFile.cleanup();
  }
}

export async function quickShareVideo({
  videoId,
  suggestedName,
  preferApp = 'whatsapp',
  caption,
  mode = 'whatsapp_then_system',
  onStageChange,
  onProgress,
}: QuickShareVideoParams): Promise<QuickShareResult> {
  const tempFile = await downloadVideoToTempFile({
    videoId,
    suggestedName,
    onStageChange,
    onProgress,
  });

  try {
    if (mode === 'whatsapp_then_system' && preferApp === 'whatsapp') {
      const sharedOnWhatsApp = await shareViaWhatsApp(tempFile.uri, suggestedName, caption);
      if (sharedOnWhatsApp) {
        return { transport: 'whatsapp', usedFallback: false };
      }
    }

    await shareWithSystem(tempFile.uri, suggestedName);
    return {
      transport: 'system',
      usedFallback: mode === 'whatsapp_then_system' && preferApp === 'whatsapp',
    };
  } finally {
    await tempFile.cleanup();
  }
}
