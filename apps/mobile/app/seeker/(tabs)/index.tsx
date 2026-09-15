import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeDeck } from '@/components/SwipeDeck';
import { Loader } from '@/components/ui';
import { colors, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function DiscoverScreen() {
  const { session, appUser } = useAuth();
  const userId = session?.user?.id;

  if (!userId) return <Loader />;

  const firstName = (appUser?.full_name ?? '').trim().split(/\s+/)[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {firstName ? `Hey ${firstName}` : 'Find your next role'}
        </Text>
        <Text style={styles.hint}>Swipe right to apply · left to skip</Text>
      </View>

      <SwipeDeck seekerId={userId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  greeting: { fontSize: typography.title.fontSize, fontWeight: '800', color: colors.text },
  hint: { fontSize: typography.caption.fontSize, color: colors.textFaint, marginTop: 2 },
});
