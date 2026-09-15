import { Link } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorNotice, Field } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function SignInScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setBusy('email');
    try {
      await signInWithEmail(email, password);
      // The root guard takes it from here.
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not sign you in.'));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Google sign-in failed.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.wordmark}>KiasuJobs</Text>
            <Text style={styles.tagline}>Swipe right to apply. That's the whole application.</Text>
          </View>

          {error ? <ErrorNotice message={error} /> : null}

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
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
          />

          <Button
            label="Sign in"
            onPress={() => void submit()}
            loading={busy === 'email'}
            disabled={busy !== null}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Continue with Google"
            variant="secondary"
            onPress={() => void google()}
            loading={busy === 'google'}
            disabled={busy !== null}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <Link href="/sign-up" style={styles.footerLink}>
              Create an account
            </Link>
          </View>

          <Text style={styles.devHint}>
            Seeded dev accounts (password: password123){'\n'}
            seeker@kiasujobs.test · hiring@kopitech.test
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xs },
  hero: { marginBottom: spacing.xxl, gap: spacing.sm },
  wordmark: { fontSize: 34, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  tagline: {
    fontSize: typography.heading.fontSize,
    color: colors.textMuted,
    lineHeight: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: typography.caption.fontSize },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: { color: colors.textMuted, fontSize: typography.body.fontSize },
  footerLink: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  devHint: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
  },
});
