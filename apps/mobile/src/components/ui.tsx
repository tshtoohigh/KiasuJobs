import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { APPLICATION_STATUS_LABELS, initialsFromName } from '@kiasujobs/shared';
import type { ApplicationStatus } from '@kiasujobs/shared';

import { accentForKey, colors, radius, shadow, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            (variant === 'secondary' || variant === 'ghost') && styles.buttonLabelDark,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Chip — multi-select pill used across onboarding filters
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Read-only pill for facts on a card (job type, salary, employment type). */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' }) {
  return (
    <View style={[styles.tag, tone === 'accent' && styles.tagAccent]}>
      <Text style={[styles.tagLabel, tone === 'accent' && styles.tagLabelAccent]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Application status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ApplicationStatus, { bg: string; fg: string }> = {
  applied: { bg: colors.primarySoft, fg: colors.primaryDark },
  viewed: { bg: colors.warningSoft, fg: colors.warning },
  shortlisted: { bg: colors.applySoft, fg: colors.apply },
  rejected: { bg: colors.skipSoft, fg: colors.skip },
  hired: { bg: colors.applySoft, fg: colors.apply },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const palette = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.statusBadgeLabel, { color: palette.fg }]}>
        {APPLICATION_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, inputProps.multiline && styles.inputMultiline, style]}
        {...inputProps}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Company logo with a deterministic initials fallback
// ---------------------------------------------------------------------------

interface CompanyLogoProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function CompanyLogo({ name, uri, size = 48 }: CompanyLogoProps) {
  const dimension = { width: size, height: size, borderRadius: radius.md };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[dimension, styles.logoImage]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`${name} logo`}
      />
    );
  }

  return (
    <View style={[dimension, styles.logoFallback, { backgroundColor: accentForKey(name) }]}>
      <Text style={[styles.logoInitials, { fontSize: size * 0.36 }]}>
        {initialsFromName(name, '·')}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.emptyCta}
        />
      ) : null}
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorNotice}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.skip },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
  },
  buttonLabelDark: { color: colors.text },

  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { color: colors.text, fontSize: typography.body.fontSize, fontWeight: '500' },
  chipLabelSelected: { color: '#FFFFFF' },

  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  tagAccent: { backgroundColor: colors.primarySoft },
  tagLabel: { color: colors.textMuted, fontSize: typography.caption.fontSize, fontWeight: '600' },
  tagLabelAccent: { color: colors.primaryDark },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  statusBadgeLabel: { fontSize: typography.caption.fontSize, fontWeight: '700' },

  field: { gap: spacing.sm, marginBottom: spacing.lg },
  fieldLabel: { color: colors.text, fontSize: typography.label.fontSize, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  fieldHint: { color: colors.textFaint, fontSize: typography.caption.fontSize },

  logoImage: { backgroundColor: colors.surfaceMuted },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoInitials: { color: '#FFFFFF', fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: { marginTop: spacing.md, alignSelf: 'stretch' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loaderLabel: { color: colors.textMuted, fontSize: typography.body.fontSize },

  errorNotice: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.skipSoft,
    borderRadius: radius.md,
    margin: spacing.lg,
    ...shadow.soft,
  },
  errorText: { color: colors.skip, fontSize: typography.body.fontSize, fontWeight: '500' },

  sectionTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
});
