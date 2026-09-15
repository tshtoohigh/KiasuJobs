import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  APPLICATION_STATUS_ORDER,
  formatRelativeTime,
  formatSalaryRange,
  isTerminalStatus,
} from '@kiasujobs/shared';
import type { SeekerApplicationDetail } from '@kiasujobs/shared';

import { CompanyLogo, EmptyState, ErrorNotice, Loader, StatusBadge } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { fetchMyApplications } from '@/services/applications';
import { companyLogoUrl } from '@/services/storage';

export default function ApplicationsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [applications, setApplications] = useState<SeekerApplicationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) return;
      if (mode === 'refresh') setRefreshing(true);

      try {
        const rows = await fetchMyApplications(userId);
        setApplications(rows);
        setError(null);
      } catch (caught) {
        setError(describeSupabaseError(caught, 'Could not load your applications.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  // Re-fetch whenever the tab regains focus, so a swipe-apply shows up here
  // without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loader label="Loading your applications…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My applications</Text>
        <Text style={styles.subtitle}>
          {applications.length} {applications.length === 1 ? 'application' : 'applications'}
        </Text>
      </View>

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          applications.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No applications yet"
            message="Head to Discover and swipe right on a role you want. It lands here instantly."
          />
        }
        renderItem={({ item }) => <ApplicationRow application={item} />}
      />
    </SafeAreaView>
  );
}

function ApplicationRow({ application }: { application: SeekerApplicationDetail }) {
  const company = application.company_name ?? 'Unknown company';

  return (
    <View style={[styles.card, shadow.soft]}>
      <View style={styles.cardHeader}>
        <CompanyLogo name={company} uri={companyLogoUrl(application.company_logo_path)} size={44} />
        <View style={styles.cardHeaderText}>
          <Text style={styles.jobTitle} numberOfLines={2}>
            {application.job_title}
          </Text>
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
        </View>
        <StatusBadge status={application.status} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {formatSalaryRange(
            application.salary_min,
            application.salary_max,
            application.salary_currency,
          )}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta}>Applied {formatRelativeTime(application.created_at)}</Text>
      </View>

      <ProgressTrail application={application} />
    </View>
  );
}

/**
 * Compact pipeline indicator. A rejection ends the trail wherever it happened
 * rather than pretending the later stages are still reachable.
 */
function ProgressTrail({ application }: { application: SeekerApplicationDetail }) {
  if (application.status === 'rejected') {
    return (
      <Text style={styles.trailNote}>
        Closed {formatRelativeTime(application.decided_at ?? application.updated_at)}
      </Text>
    );
  }

  const currentIndex = APPLICATION_STATUS_ORDER.indexOf(application.status);

  return (
    <View style={styles.trail}>
      {APPLICATION_STATUS_ORDER.map((status, index) => {
        const reached = index <= currentIndex;
        return (
          <View key={status} style={styles.trailSegment}>
            <View style={[styles.trailDot, reached && styles.trailDotReached]} />
            {index < APPLICATION_STATUS_ORDER.length - 1 ? (
              <View style={[styles.trailLine, index < currentIndex && styles.trailLineReached]} />
            ) : null}
          </View>
        );
      })}
      <Text style={styles.trailLabel}>
        {isTerminalStatus(application.status) && application.status === 'hired'
          ? 'Offer stage'
          : application.status === 'shortlisted'
            ? 'Shortlisted'
            : application.status === 'viewed'
              ? 'Employer has seen it'
              : 'Waiting on the employer'}
      </Text>
    </View>
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
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardHeaderText: { flex: 1, gap: 2 },
  jobTitle: { fontSize: typography.heading.fontSize, fontWeight: '700', color: colors.text },
  company: { fontSize: typography.body.fontSize, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { fontSize: typography.caption.fontSize, color: colors.textMuted, fontWeight: '500' },
  metaDot: { color: colors.textFaint },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  trailSegment: { flexDirection: 'row', alignItems: 'center' },
  trailDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  trailDotReached: { backgroundColor: colors.primary },
  trailLine: { width: 22, height: 2, backgroundColor: colors.border },
  trailLineReached: { backgroundColor: colors.primary },
  trailLabel: {
    marginLeft: spacing.md,
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    fontWeight: '600',
  },
  trailNote: { fontSize: typography.caption.fontSize, color: colors.skip, fontWeight: '600' },
});
