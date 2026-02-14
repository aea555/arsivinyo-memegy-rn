import i18n from '@/src/shared/locales/i18n';

const compactFormatterCache = new Map<string, Intl.NumberFormat>();

function getNumberLocale() {
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
  return date.toLocaleDateString();
}
