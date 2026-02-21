import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  completeSignup,
  SignupCompleteError,
} from '@/src/features/auth/api/authApi';
import { getTerms } from '@/src/features/settings/api/systemApi';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { Input } from '@/src/shared/components/ui/Input';
import { authSessionManager } from '@/src/shared/services/auth/authSessionManager';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import {
  DEFAULT_USERNAME_RULES,
  normalizeUsernameDraft,
  validateUsername,
} from '@/src/shared/utils/usernameValidation';
import { useAuthStore } from '@/src/store/authStore';
import { useToastStore } from '@/src/store/toastStore';

export function UsernameSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const pendingSignup = useAuthStore((state) => state.pendingSignup);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const clearPendingSignup = useAuthStore((state) => state.clearPendingSignup);

  const [username, setUsername] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const rules = pendingSignup?.rules ?? DEFAULT_USERNAME_RULES;
  const requiredTermsVersion = pendingSignup?.requiredTermsVersion ?? termsVersion ?? 'v1';
  const validation = useMemo(
    () => validateUsername(username, rules),
    [rules, username]
  );
  const isSessionExpired = !pendingSignup;

  useEffect(() => {
    if (!pendingSignup) return;
    setUsername(normalizeUsernameDraft(pendingSignup.suggestedUsername));
  }, [pendingSignup]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const terms = await getTerms();
        if (!cancelled) {
          setTermsVersion(terms.version);
        }
      } catch {
        // Best effort for UI context.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const validationMessage = useMemo(() => {
    if (validation.isValid || !username.length) return null;
    if (validation.errorCode === 'required') return t('auth.usernameRequired');
    if (validation.errorCode === 'too_short') {
      return t('auth.usernameTooShort', { min: rules.min_length });
    }
    if (validation.errorCode === 'too_long') {
      return t('auth.usernameTooLong', { max: rules.max_length });
    }
    return t('auth.usernameInvalid');
  }, [rules.max_length, rules.min_length, t, username.length, validation.errorCode, validation.isValid]);

  const handleSubmit = async () => {
    if (!pendingSignup || submitting) return;
    if (!validation.isValid) {
      setInlineError(validationMessage ?? t('auth.usernameInvalid'));
      return;
    }
    if (!ageConfirmed) {
      setInlineError(t('auth.ageConfirmationRequired'));
      return;
    }
    if (!termsAccepted) {
      setInlineError(t('auth.termsConsentRequired'));
      return;
    }

    setSubmitting(true);
    setInlineError(null);

    try {
      const auth = await completeSignup({
        signup_ticket: pendingSignup.signupTicket,
        username: validation.normalized,
        age_confirmed: true,
        terms_version: requiredTermsVersion,
      });
      await authSessionManager.setSession({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      });
      setAuthenticated(auth.user);
      clearPendingSignup();
      router.replace('/(tabs)/feed');
    } catch (error) {
      if (error instanceof SignupCompleteError) {
        if (error.code === 'invalid_username') {
          setInlineError(t('auth.usernameInvalid'));
        } else if (error.code === 'username_taken') {
          setInlineError(t('auth.usernameTaken'));
        } else if (error.code === 'ticket_invalid') {
          clearPendingSignup();
          setInlineError(t('auth.usernameTicketExpired'));
        } else if (error.code === 'rate_limited') {
          showToast(t('auth.usernameRateLimited'), 'error');
          setInlineError(t('auth.usernameRateLimited'));
        } else if (error.code === 'network') {
          showToast(t('auth.usernameNetworkError'), 'error');
          setInlineError(t('auth.usernameNetworkError'));
        } else {
          setInlineError(t('auth.authFailed'));
        }
      } else {
        setInlineError(t('auth.authFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestartLogin = () => {
    clearPendingSignup();
    router.replace('/(auth)/login');
  };

  return (
    <Screen contentStyle={styles.container}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="heading2">{t('auth.usernameSetupTitle')}</AppText>
          <AppText variant="caption">{t('auth.usernameSetupSubtitle')}</AppText>
        </View>

        {isSessionExpired ? (
          <View style={styles.expiredWrap}>
            <AppText>{t('auth.usernameSessionExpired')}</AppText>
            <Button
              label={t('auth.restartLogin')}
              onPress={handleRestartLogin}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              placeholder={t('auth.usernamePlaceholder')}
              value={username}
              onChangeText={(next) => {
                setUsername(normalizeUsernameDraft(next));
                setInlineError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={rules.max_length}
            />
            <AppText variant="caption">
              {t('auth.usernameRulesHint', {
                min: rules.min_length,
                max: rules.max_length,
              })}
            </AppText>

            <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
              <View style={styles.toggleText}>
                <AppText variant="bodyBold">{t('auth.ageConfirmLabel')}</AppText>
                <AppText variant="caption" style={{ color: palette.text.secondary }}>
                  {t('auth.ageConfirmHint')}
                </AppText>
              </View>
              <Switch
                value={ageConfirmed}
                onValueChange={setAgeConfirmed}
                trackColor={{ true: palette.accent, false: palette.border }}
                disabled={submitting}
              />
            </View>

            <View style={[styles.toggleRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
              <View style={styles.toggleText}>
                <AppText variant="bodyBold">
                  {t('auth.termsConsentLabel', { version: requiredTermsVersion })}
                </AppText>
                <AppText variant="caption" style={{ color: palette.text.secondary }}>
                  {t('auth.termsConsentHint')}
                </AppText>
              </View>
              <Switch
                value={termsAccepted}
                onValueChange={setTermsAccepted}
                trackColor={{ true: palette.accent, false: palette.border }}
                disabled={submitting}
              />
            </View>

            <Button
              label={t('auth.readTerms')}
              variant="secondary"
              onPress={() => router.push('/(auth)/terms' as never)}
              disabled={submitting}
            />

            {inlineError ? (
              <AppText variant="caption" style={{ color: palette.error }}>
                {inlineError}
              </AppText>
            ) : validationMessage ? (
              <AppText variant="caption" style={{ color: palette.error }}>
                {validationMessage}
              </AppText>
            ) : null}
            <Button
              label={submitting ? t('auth.usernameSubmitting') : t('auth.usernameContinue')}
              onPress={handleSubmit}
              disabled={submitting || !validation.isValid || !ageConfirmed || !termsAccepted}
            />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  card: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  form: {
    gap: spacing.sm,
  },
  expiredWrap: {
    gap: spacing.sm,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
});
