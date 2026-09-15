import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UserRole } from '@kiasujobs/shared';

import { RoleCard } from '@/components/RoleCard';
import { Button, ErrorNotice } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Only reachable when `users.role` is NULL — in practice, after a Google
 * sign-up, since Google gives us no role metadata to put on the row.
 */
export default function RoleScreen() {
  const { chooseRole, signOut } = useAuth();
  const [role, setRole] = useState<UserRole>('seeker');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await chooseRole(role);
      // Stage flips to `needs-onboarding`; the root guard moves us on.
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save your choice.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>How will you use KiasuJobs?</Text>
          <Text style={styles.subtitle}>
            This decides which app you get. You can't switch later without a new account, so pick
            the one you actually need.
          </Text>
        </View>

        {error ? <ErrorNotice message={error} /> : null}

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

        <View style={styles.actions}>
          <Button label="Continue" onPress={() => void submit()} loading={busy} />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  header: { gap: spacing.md },
  title: { fontSize: typography.display.fontSize, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: typography.body.fontSize, color: colors.textMuted, lineHeight: 22 },
  roles: { gap: spacing.md },
  actions: { gap: spacing.sm },
});
