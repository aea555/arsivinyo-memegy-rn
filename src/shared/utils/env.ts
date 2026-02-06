const requireEnv = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const API_BASE_URL = requireEnv(
  'EXPO_PUBLIC_API_BASE_URL',
  process.env.EXPO_PUBLIC_API_BASE_URL
);
export const CDN_BASE_URL = requireEnv(
  'EXPO_PUBLIC_CDN_BASE_URL',
  process.env.EXPO_PUBLIC_CDN_BASE_URL
);
