import * as Clipboard from 'expo-clipboard';

export type ClipboardUrlErrorCode =
  | 'CLIPBOARD_UNAVAILABLE'
  | 'CLIPBOARD_EMPTY'
  | 'INVALID_URL';

export class ClipboardUrlError extends Error {
  constructor(public code: ClipboardUrlErrorCode, message: string) {
    super(message);
    this.name = 'ClipboardUrlError';
  }
}

export function normalizeClipboardUrl(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ClipboardUrlError('CLIPBOARD_EMPTY', 'Clipboard is empty.');
  }

  const withScheme =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ClipboardUrlError('INVALID_URL', 'Clipboard content is not a valid HTTP URL.');
    }
  } catch {
    throw new ClipboardUrlError('INVALID_URL', 'Clipboard content is not a valid URL.');
  }

  return withScheme;
}

export async function getClipboardUrlForDownloader(): Promise<string> {
  const hasContent = await Clipboard.hasStringAsync();
  if (!hasContent) {
    throw new ClipboardUrlError('CLIPBOARD_EMPTY', 'Clipboard is empty.');
  }

  const rawValue = await Clipboard.getStringAsync();
  const normalizedUrl = normalizeClipboardUrl(rawValue);
  return normalizedUrl;
}
