import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatEmploymentType,
  formatLocation,
  formatRelativeTime,
  formatSalaryRange,
  truncate,
} from '@kiasujobs/shared';
import type { JobFeedItem } from '@kiasujobs/shared';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { companyLogoUrl } from '@/services/storage';

import { CompanyLogo, Tag } from './ui';

/**
 * The face of a deck card. Purely presentational — gestures and animation live
 * in SwipeCard so this can also be reused in the details sheet and previews.
 */
export function JobCard({ job }: { job: JobFeedItem }) {
  const salary = formatSalaryRange(job.salary_min, job.salary_max, job.salary_currency);
  const posted = formatRelativeTime(job.published_at);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <CompanyLogo
          name={job.company_name}
          uri={companyLogoUrl(job.company_logo_path)}
          size={52}
        />
        <View style={styles.headerText}>
          <Text style={styles.company} numberOfLines={1}>
            {job.company_name}
          </Text>
          {posted ? <Text style={styles.posted}>{posted}</Text> : null}
        </View>
      </View>

      <Text style={styles.title} numberOfLines={3}>
        {job.title}
      </Text>

      <Text style={styles.salary}>{salary}</Text>

      <View style={styles.tags}>
        <Tag label={formatLocation(job.location, job.job_type)} tone="accent" />
        <Tag label={formatEmploymentType(job.employment_type)} />
        {job.industry ? <Tag label={job.industry} /> : null}
      </View>

      <Text style={styles.description}>{truncate(job.description, 220)}</Text>

      {job.requirements.length > 0 ? (
        <View style={styles.requirements}>
          {job.requirements.slice(0, 3).map((requirement) => (
            <View key={requirement} style={styles.requirementRow}>
              <View style={styles.bullet} />
              <Text style={styles.requirementText} numberOfLines={1}>
                {requirement}
              </Text>
            </View>
          ))}
          {job.requirements.length > 3 ? (
            <Text style={styles.moreRequirements}>
              +{job.requirements.length - 3} more requirement
              {job.requirements.length - 3 === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerHint}>Tap for the full description</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  company: {
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  posted: { fontSize: typography.caption.fontSize, color: colors.textFaint },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  salary: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: colors.apply,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
    color: colors.textMuted,
  },
  requirements: { gap: spacing.sm, marginTop: spacing.xs },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  requirementText: { flex: 1, fontSize: typography.body.fontSize, color: colors.text },
  moreRequirements: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    marginLeft: spacing.md + 1,
  },
  footer: { marginTop: 'auto', alignItems: 'center' },
  footerHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    fontWeight: '600',
  },
});
