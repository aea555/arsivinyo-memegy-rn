import i18n from '@/src/shared/locales/i18n';

const compactFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getNumberLocale() {
  const language = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  return language === 'tr' ? 'tr-TR' : 'en-US';
}

function getDateLocale() {
  const language = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  return language === 'tr' ? 'tr-TR' : 'en-US';
}

function getCompactFormatter(locale: string) {
  const cached = compactFormatterCache.get(locale);
  if (cached) return cached;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    });
    compactFormatterCache.set(locale, formatter);
    return formatter;
  } catch {
    return null;
  }
}

function getDateFormatter(locale: string, key: string, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${locale}:${key}`;
  const cached = dateFormatterCache.get(cacheKey);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  dateFormatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatCount(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const formatter = getCompactFormatter(getNumberLocale());
  if (formatter) {
    return formatter.format(safeValue);
  }

  if (safeValue >= 1_000_000_000) {
    return `${(safeValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (safeValue >= 1_000_000) {
    return `${(safeValue / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (safeValue >= 1_000) {
    return `${(safeValue / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${safeValue}`;
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const locale = getDateLocale();
  const now = new Date();
  const isSameYear = now.getFullYear() === date.getFullYear();

  const timePart = getDateFormatter(locale, 'time', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isSameYear) {
    const datePart = getDateFormatter(locale, 'sameYearDate', {
      month: 'long',
      day: 'numeric',
    }).format(date);
    return `${datePart}, ${timePart}`;
  }

  const pastYearDatePart = getDateFormatter(locale, 'pastYearDate', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return `${pastYearDatePart} ${timePart}`;
}
