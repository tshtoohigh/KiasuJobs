import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatLocation, formatRelativeTime, formatSalaryRange } from '@kiasujobs/shared';
import type { JobPostingWithStats } from '@kiasujobs/shared';

import { EmptyState, ErrorNotice, Loader, Tag } from '@/components/ui';
import { describeSupabaseError, supabase } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { fetchMyPostings } from '@/services/jobs';

export default function EmployerPostingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [postings, setPostings] = useState<JobPostingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Kept in a ref so the realtime handler doesn't need to re-subscribe. */
  const jobIds = useRef<Set<string>>(new Set());

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) return;
      if (mode === 'refresh') setRefreshing(true);

      try {
        const rows = await fetchMyPostings(userId);
        setPostings(rows);
        jobIds.current = new Set(rows.map((row) => row.id));
        setError(null);
      } catch (caught) {
        setError(describeSupabaseError(caught, 'Could not load your postings.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Live applicant counts. RLS applies to realtime too, so this only ever
   * delivers applications to postings this employer owns.
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('employer-applications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'applications' },
        (payload) => {
          const jobId = (payload.new as { job_id?: string } | null)?.job_id;
          if (jobId && jobIds.current.has(jobId)) void load('refresh');
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  if (loading) return <Loader label="Loading your postings…" />;

  const totalApplicants = postings.reduce((sum, posting) => sum + posting.applicant_count, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your postings</Text>
        <Text style={styles.subtitle}>
          {postings.length} {postings.length === 1 ? 'posting' : 'postings'} · {totalApplicants}{' '}
          {totalApplicants === 1 ? 'applicant' : 'applicants'}
        </Text>
      </View>

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}

      <FlatList
        data={postings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={postings.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No postings yet"
            message="Post your first role and it appears in candidates' decks straight away."
            actionLabel="Post a job"
            onAction={() => router.push('/employer/new-job')}
          />
        }
        renderItem={({ item }) => (
          <PostingRow posting={item} onPress={() => router.push(`/employer/postings/${item.id}`)} />
        )}
      />
    </SafeAreaView>
  );
}

function PostingRow({ posting, onPress }: { posting: JobPostingWithStats; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, shadow.soft, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {posting.title}
        </Text>
        {posting.new_applicant_count > 0 ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{posting.new_applicant_count} new</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.salary}>
        {formatSalaryRange(posting.salary_min, posting.salary_max, posting.salary_currency)}
      </Text>

      <View style={styles.tags}>
        <Tag label={formatLocation(posting.location, posting.job_type)} tone="accent" />
        <Tag
          label={
            posting.status === 'published'
              ? 'Live'
              : posting.status === 'draft'
                ? 'Draft'
                : 'Closed'
          }
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>
          {posting.applicant_count} {posting.applicant_count === 1 ? 'applicant' : 'applicants'}
        </Text>
        <Text style={styles.footerText}>
          {posting.published_at
            ? `Posted ${formatRelativeTime(posting.published_at)}`
            : `Created ${formatRelativeTime(posting.created_at)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: typography.title.fontSize, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: typography.caption.fontSize, color: colors.textFaint, marginTop: 2 },
  listContainer: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.9 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  jobTitle: {
    flex: 1,
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  newBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  newBadgeText: { color: '#FFFFFF', fontSize: typography.caption.fontSize, fontWeight: '700' },
  salary: { fontSize: typography.body.fontSize, fontWeight: '700', color: colors.apply },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { fontSize: typography.caption.fontSize, color: colors.textFaint, fontWeight: '500' },
});
