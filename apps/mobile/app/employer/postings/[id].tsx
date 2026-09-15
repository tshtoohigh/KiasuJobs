import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
  initialsFromName,
} from '@kiasujobs/shared';
import type { ApplicationStatus, JobApplicantDetail, JobPosting } from '@kiasujobs/shared';

import { Button, EmptyState, ErrorNotice, Loader, StatusBadge, Tag } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { accentForKey, colors, radius, shadow, spacing, typography } from '@/lib/theme';
import {
  fetchApplicantsForJob,
  markApplicationsViewed,
  updateApplicationStatus,
} from '@/services/applications';
import { fetchJobPosting } from '@/services/jobs';
import { createResumeSignedUrl } from '@/services/storage';
import { showToast } from '@/stores/toast';

/** Statuses an employer can set from this screen. */
const DECISIONS: ApplicationStatus[] = APPLICATION_STATUSES.filter(
  (status) => status !== 'applied' && status !== 'viewed',
);

export default function ApplicantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [applicants, setApplicants] = useState<JobApplicantDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!id) return;
      if (mode === 'refresh') setRefreshing(true);

      try {
        const [job, rows] = await Promise.all([fetchJobPosting(id), fetchApplicantsForJob(id)]);
        setPosting(job);
        setApplicants(rows);
        setError(null);
      } catch (caught) {
        setError(describeSupabaseError(caught, 'Could not load applicants.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Opening the list counts as reading it, so brand-new applications flip to
   * `viewed` — which is what the seeker's tracker shows.
   */
  useEffect(() => {
    const unread = applicants.filter((a) => a.status === 'applied').map((a) => a.id);
    if (unread.length === 0) return;

    void (async () => {
      try {
        await markApplicationsViewed(unread);
        setApplicants((current) =>
          current.map((a) => (unread.includes(a.id) ? { ...a, status: 'viewed' } : a)),
        );
      } catch {
        // Not worth surfacing — the employer still sees the applicants.
      }
    })();
    // Deliberately keyed on the ids, not the array identity, to avoid a loop.
  }, [applicants.map((a) => a.id).join(',')]);

  const decide = async (applicationId: string, status: ApplicationStatus) => {
    // Optimistic: the row updates immediately, then reverts if the write fails.
    const previous = applicants;
    setApplicants((current) => current.map((a) => (a.id === applicationId ? { ...a, status } : a)));

    try {
      await updateApplicationStatus(applicationId, status);
      showToast(`Marked as ${APPLICATION_STATUS_LABELS[status].toLowerCase()}.`, 'success');
    } catch (caught) {
      setApplicants(previous);
      showToast(describeSupabaseError(caught, 'Could not update that applicant.'), 'error');
    }
  };

  const openResume = async (path: string | null) => {
    if (!path) {
      showToast('This candidate has not uploaded a resume.', 'info');
      return;
    }

    try {
      const url = await createResumeSignedUrl(path);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showToast('No app on this device can open that file.', 'error');
      }
    } catch (caught) {
      showToast(describeSupabaseError(caught, 'Could not open that resume.'), 'error');
    }
  };

  if (loading) return <Loader label="Loading applicants…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {posting?.title ?? 'Posting'}
          </Text>
          {posting ? (
            <Text style={styles.subtitle}>
              {formatSalaryRange(posting.salary_min, posting.salary_max, posting.salary_currency)} ·{' '}
              {applicants.length} {applicants.length === 1 ? 'applicant' : 'applicants'}
            </Text>
          ) : null}
        </View>
      </View>

      {posting ? (
        <View style={styles.tags}>
          <Tag label={formatLocation(posting.location, posting.job_type)} tone="accent" />
          <Tag label={posting.status === 'published' ? 'Live' : posting.status} />
        </View>
      ) : null}

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}

      <FlatList
        data={applicants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          applicants.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No applicants yet"
            message="As soon as a candidate swipes right on this role, they appear here."
          />
        }
        renderItem={({ item }) => (
          <ApplicantCard
            applicant={item}
            onDecide={(status) => void decide(item.id, status)}
            onOpenResume={() => void openResume(item.seeker_resume_path)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ApplicantCard({
  applicant,
  onDecide,
  onOpenResume,
}: {
  applicant: JobApplicantDetail;
  onDecide: (status: ApplicationStatus) => void;
  onOpenResume: () => void;
}) {
  const name = applicant.seeker_name ?? 'Candidate';

  return (
    <View style={[styles.card, shadow.soft]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: accentForKey(name) }]}>
          <Text style={styles.avatarText}>{initialsFromName(name)}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.name}>{name}</Text>
          {applicant.seeker_headline ? (
            <Text style={styles.headline} numberOfLines={2}>
              {applicant.seeker_headline}
            </Text>
          ) : null}
        </View>
        <StatusBadge status={applicant.status} />
      </View>

      <View style={styles.metaRow}>
        {applicant.seeker_years_experience != null ? (
          <Tag label={`${applicant.seeker_years_experience} yrs experience`} />
        ) : null}
        <Tag label={`Applied ${formatRelativeTime(applicant.created_at)}`} />
      </View>

      {applicant.seeker_bio ? (
        <Text style={styles.bio} numberOfLines={4}>
          {applicant.seeker_bio}
        </Text>
      ) : null}

      {applicant.cover_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note from candidate</Text>
          <Text style={styles.noteText}>{applicant.cover_note}</Text>
        </View>
      ) : null}

      <Button
        label={applicant.seeker_resume_path ? 'Open resume' : 'No resume attached'}
        variant="secondary"
        onPress={onOpenResume}
        disabled={!applicant.seeker_resume_path}
      />

      <View style={styles.decisions}>
        {DECISIONS.map((status) => {
          const active = applicant.status === status;
          return (
            <Pressable
              key={status}
              onPress={() => onDecide(status)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.decisionButton,
                status === 'rejected' && styles.decisionReject,
                active && styles.decisionActive,
                pressed && styles.decisionPressed,
              ]}
            >
              <Text
                style={[
                  styles.decisionLabel,
                  status === 'rejected' && styles.decisionLabelReject,
                  active && styles.decisionLabelActive,
                ]}
              >
                {APPLICATION_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  backGlyph: { fontSize: 26, lineHeight: 28, color: colors.text, fontWeight: '700' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: typography.title.fontSize, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: typography.caption.fontSize, color: colors.textFaint },
  tags: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  listContainer: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  emptyContainer: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cardHeaderText: { flex: 1, gap: 2 },
  name: { fontSize: typography.heading.fontSize, fontWeight: '700', color: colors.text },
  headline: { fontSize: typography.body.fontSize, color: colors.textMuted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bio: { fontSize: typography.body.fontSize, color: colors.textMuted, lineHeight: 21 },
  noteBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  noteLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteText: { fontSize: typography.body.fontSize, color: colors.text, lineHeight: 20 },
  decisions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  decisionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  decisionReject: { borderColor: colors.skipSoft },
  decisionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  decisionPressed: { opacity: 0.8 },
  decisionLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: colors.textMuted,
  },
  decisionLabelReject: { color: colors.skip },
  decisionLabelActive: { color: '#FFFFFF' },
});
