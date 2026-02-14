import { UsernameRulesDto } from '@/src/shared/types/api';

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const WHITESPACE_REGEX = /\s+/g;

export const DEFAULT_USERNAME_RULES: UsernameRulesDto = {
  min_length: 3,
  max_length: 20,
  pattern: '^[a-z0-9_]{3,20}$',
};

export type UsernameValidationErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_pattern';

export type UsernameValidationResult = {
  normalized: string;
  isValid: boolean;
  errorCode: UsernameValidationErrorCode | null;
};

function toSafeRules(rules?: UsernameRulesDto | null): UsernameRulesDto {
  if (!rules) return DEFAULT_USERNAME_RULES;
  const minLength = Number.isFinite(rules.min_length)
    ? Math.max(1, Math.floor(rules.min_length))
    : DEFAULT_USERNAME_RULES.min_length;
  const maxLength = Number.isFinite(rules.max_length)
    ? Math.max(minLength, Math.floor(rules.max_length))
    : DEFAULT_USERNAME_RULES.max_length;
  const pattern =
    typeof rules.pattern === 'string' && rules.pattern.trim().length > 0
      ? rules.pattern
      : DEFAULT_USERNAME_RULES.pattern;

  return {
    min_length: minLength,
    max_length: maxLength,
    pattern,
  };
}

export function normalizeUsernameDraft(value: string) {
  return value
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .replace(WHITESPACE_REGEX, '')
    .toLowerCase();
}

export function validateUsername(
  value: string,
  rules?: UsernameRulesDto | null
): UsernameValidationResult {
  const normalized = normalizeUsernameDraft(value);
  const safeRules = toSafeRules(rules);

  if (normalized.length === 0) {
    return { normalized, isValid: false, errorCode: 'required' };
  }
  if (normalized.length < safeRules.min_length) {
    return { normalized, isValid: false, errorCode: 'too_short' };
  }
  if (normalized.length > safeRules.max_length) {
    return { normalized, isValid: false, errorCode: 'too_long' };
  }

  try {
    const regex = new RegExp(safeRules.pattern);
    if (!regex.test(normalized)) {
      return { normalized, isValid: false, errorCode: 'invalid_pattern' };
    }
  } catch {
    const fallbackRegex = new RegExp(DEFAULT_USERNAME_RULES.pattern);
    if (!fallbackRegex.test(normalized)) {
      return { normalized, isValid: false, errorCode: 'invalid_pattern' };
    }
  }

  return { normalized, isValid: true, errorCode: null };
}

export function isUsernameValid(value: string, rules?: UsernameRulesDto | null) {
  return validateUsername(value, rules).isValid;
}

