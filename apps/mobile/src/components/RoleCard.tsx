import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';

/** Large tappable role choice, shared by sign-up and the OAuth role step. */
export function RoleCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardPressed: { opacity: 0.9 },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: typography.heading.fontSize, fontWeight: '700', color: colors.text },
  titleSelected: { color: colors.primaryDark },
  description: { fontSize: typography.body.fontSize, color: colors.textMuted, lineHeight: 20 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
