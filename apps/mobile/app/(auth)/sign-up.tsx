import { Link } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserRole } from '@kiasujobs/shared';

import { Button, ErrorNotice, Field } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { RoleCard } from '@/components/RoleCard';

export default function SignUpScreen() {
  const { signUpWithEmail } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('seeker');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState(false);

  const submit = async () => {
    if (!fullName.trim()) return setError('What should we call you?');
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 6) return setError('Passwords need at least 6 characters.');

    setError(null);
    setBusy(true);
    try {
      // The role travels in the sign-up metadata and is picked up by the
      // handle_new_user trigger, so public.users is correct from the start.
      const { needsEmailConfirmation } = await signUpWithEmail(email, password, role, fullName);
      if (needsEmailConfirmation) setConfirmationNotice(true);
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  if (confirmationNotice) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.noticeWrap}>
          <Text style={styles.noticeTitle}>Check your inbox</Text>
          <Text style={styles.noticeBody}>
            We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
          </Text>
          <Text style={styles.noticeHint}>
            Running Supabase locally? Confirmations are disabled, and mail lands at
            http://localhost:54324
          </Text>
          <Link href="/sign-in" style={styles.noticeLink}>
            Back to sign in
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>

          {error ? <ErrorNotice message={error} /> : null}

          <Text style={styles.roleQuestion}>Which are you?</Text>
          <View style={styles.roles}>
            <RoleCard
              title="I'm job hunting"
              description="Swipe through roles and apply in one gesture."
              selected={role === 'seeker'}
              onPress={() => setRole('seeker')}
            />
            <RoleCard
              title="I'm hiring"
              description="Post roles and review applicants as they arrive."
              selected={role === 'employer'}
              onPress={() => setRole('employer')}
            />
          </View>

          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Aisha Tan"
            autoComplete="name"
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
            hint="Six characters minimum."
          />

          <Button label="Create account" onPress={() => void submit()} loading={busy} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/sign-in" style={styles.footerLink}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xs },
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  roleQuestion: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  roles: { gap: spacing.md, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textMuted, fontSize: typography.body.fontSize },
  footerLink: { color: colors.primary, fontSize: typography.body.fontSize, fontWeight: '700' },

  noticeWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  noticeTitle: { fontSize: typography.display.fontSize, fontWeight: '800', color: colors.text },
  noticeBody: { fontSize: typography.body.fontSize, color: colors.textMuted, lineHeight: 22 },
  noticeHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    lineHeight: 18,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  noticeLink: {
    marginTop: spacing.lg,
    color: colors.primary,
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
  },
});
