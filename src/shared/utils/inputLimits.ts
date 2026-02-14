export const VIDEO_TITLE_MAX_BYTES = 200;
export const VIDEO_DESCRIPTION_MAX_BYTES = 2000;
export const UPLOAD_VIDEO_TITLE_MAX_BYTES = 120;
export const UPLOAD_VIDEO_DESCRIPTION_MAX_BYTES = 1000;

export const SEARCH_MAX_QUERY_CHARS = 200;
export const SEARCH_MAX_TOKENS = 50;
export const SEARCH_MAX_TOKEN_LENGTH = 50;

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

function utf8BytesForCodePoint(codePoint: number) {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

export function utf8ByteLength(value: string) {
  let total = 0;
  for (const char of value) {
    total += utf8BytesForCodePoint(char.codePointAt(0) ?? 0);
  }
  return total;
}

export function clampUtf8Bytes(value: string, maxBytes: number) {
  let total = 0;
  let output = '';
  for (const char of value) {
    const charBytes = utf8BytesForCodePoint(char.codePointAt(0) ?? 0);
    if (total + charBytes > maxBytes) break;
    output += char;
    total += charBytes;
  }
  return output;
}

export function normalizeSearchQuery(value: string) {
  return value
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampCodePoints(value: string, maxChars: number) {
  return Array.from(value).slice(0, maxChars).join('');
}

export function clampSearchQuery(value: string) {
  const normalized = normalizeSearchQuery(value);
  const charLimited = clampCodePoints(normalized, SEARCH_MAX_QUERY_CHARS);
  const tokenLimited = charLimited
    .split(' ')
    .filter(Boolean)
    .slice(0, SEARCH_MAX_TOKENS)
    .map((token) => clampCodePoints(token, SEARCH_MAX_TOKEN_LENGTH));
  return tokenLimited.join(' ');
}

export function clampSearchQueryDraft(value: string) {
  const sanitized = value.replace(CONTROL_CHARS_REGEX, '');
  return clampCodePoints(sanitized, SEARCH_MAX_QUERY_CHARS);
}
