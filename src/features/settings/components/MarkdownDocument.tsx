import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';

type MarkdownDocumentProps = {
  content: string;
};

export function MarkdownDocument({ content }: MarkdownDocumentProps) {
  const lines = React.useMemo(() => content.split(/\r?\n/), [content]);

  return (
    <View style={styles.container}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={`sp-${index}`} style={styles.spacer} />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <AppText key={index} variant="bodyBold" style={styles.h3}>
              {trimmed.replace(/^###\s+/, '')}
            </AppText>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <AppText key={index} variant="heading2" style={styles.h2}>
              {trimmed.replace(/^##\s+/, '')}
            </AppText>
          );
        }

        if (trimmed.startsWith('# ')) {
          return (
            <AppText key={index} variant="heading2" style={styles.h1}>
              {trimmed.replace(/^#\s+/, '')}
            </AppText>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <View key={index} style={styles.bulletRow}>
              <AppText variant="body">•</AppText>
              <AppText variant="body" style={styles.bulletText}>
                {trimmed.replace(/^-\s+/, '')}
              </AppText>
            </View>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          return (
            <AppText key={index} variant="body" style={styles.paragraph}>
              {trimmed}
            </AppText>
          );
        }

        return (
          <AppText key={index} variant="body" style={styles.paragraph}>
            {trimmed}
          </AppText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  spacer: {
    height: spacing.xs,
  },
  h1: {
    marginTop: spacing.sm,
  },
  h2: {
    marginTop: spacing.sm,
  },
  h3: {
    marginTop: spacing.xs,
  },
  paragraph: {
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
});
