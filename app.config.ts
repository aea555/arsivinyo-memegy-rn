import type { ExpoConfig } from 'expo/config';

const appJson = require('./app.json') as { expo: ExpoConfig };

function resolveUpdatesChannel() {
  const raw =
    process.env.EXPO_UPDATES_CHANNEL ??
    process.env.EXPO_PUBLIC_OTA_CHANNEL ??
    'production';

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : 'production';
}

export default (): ExpoConfig => {
  const channel = resolveUpdatesChannel();
  const baseConfig = appJson.expo;
  const baseUpdates = baseConfig.updates ?? {};
  const baseHeaders = baseUpdates.requestHeaders ?? {};
  const baseExtra = baseConfig.extra ?? {};
  const otaExtra =
    typeof baseExtra.ota === 'object' && baseExtra.ota !== null ? baseExtra.ota : {};

  return {
    ...baseConfig,
    updates: {
      ...baseUpdates,
      requestHeaders: {
        ...baseHeaders,
        'expo-channel-name': channel,
      },
    },
    extra: {
      ...baseExtra,
      ota: {
        ...otaExtra,
        channel,
      },
    },
  };
};
