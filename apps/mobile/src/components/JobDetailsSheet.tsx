import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatEmploymentType,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
} from '@kiasujobs/shared';
import type { JobFeedItem } from '@kiasujobs/shared';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { companyLogoUrl } from '@/services/storage';

import { Button, CompanyLogo, SectionTitle, Tag } from './ui';

/**
 * Full posting, opened by tapping a card. Decisions made in here route back
 * through the deck's swipe path so the card still animates out and the
 * optimistic write behaves identically.
 */
export function JobDetailsSheet({
  job,
  onClose,
  onApply,
  onSkip,
}: {
  job: JobFeedItem | null;
  onClose: () => void;
  onApply: () => void;
  onSkip: () => void;
}) {
  return (
    <Modal
      visible={job !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {job ? (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.handleRow}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close job details"
              style={styles.closeButton}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View style={styles.header}>
              <CompanyLogo
                name={job.company_name}
                uri={companyLogoUrl(job.company_logo_path)}
                size={60}
              />
              <View style={styles.headerText}>
                <Text style={styles.company}>{job.company_name}</Text>
                {job.company_industry ? (
                  <Text style={styles.industry}>{job.company_industry}</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.title}>{job.title}</Text>

            <Text style={styles.salary}>
              {formatSalaryRange(job.salary_min, job.salary_max, job.salary_currency)}
            </Text>

            <View style={styles.tags}>
              <Tag label={formatLocation(job.location, job.job_type)} tone="accent" />
              <Tag label={formatEmploymentType(job.employment_type)} />
              {job.published_at ? (
                <Tag label={`Posted ${formatRelativeTime(job.published_at)}`} />
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionTitle>About the role</SectionTitle>
              <Text style={styles.body}>{job.description}</Text>
            </View>

            {job.requirements.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle>What they're looking for</SectionTitle>
                {job.requirements.map((requirement) => (
                  <View key={requirement} style={styles.requirementRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.requirementText}>{requirement}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.disclaimer}>
              Applying sends your saved resume and profile to {job.company_name}.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Button label="Skip" variant="secondary" onPress={onSkip} style={styles.actionButton} />
            <Button label="Apply now" onPress={onApply} style={styles.actionButton} />
          </View>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  closeGlyph: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
  content: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  company: { fontSize: typography.title.fontSize, fontWeight: '700', color: colors.text },
  industry: { fontSize: typography.caption.fontSize, color: colors.textFaint },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  salary: { fontSize: typography.heading.fontSize, fontWeight: '700', color: colors.apply },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  body: { fontSize: typography.body.fontSize, lineHeight: 24, color: colors.textMuted },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  requirementText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: 22,
    color: colors.text,
  },
  disclaimer: {
    marginTop: spacing.xl,
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButton: { flex: 1 },
});
