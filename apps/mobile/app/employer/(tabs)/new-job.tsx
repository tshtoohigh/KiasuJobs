import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
} from '@kiasujobs/shared';
import type { EmploymentType, JobType } from '@kiasujobs/shared';

import { Button, Chip, ErrorNotice, Field, SectionTitle } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { createJobPosting } from '@/services/jobs';
import { showToast } from '@/stores/toast';

export default function NewJobScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobType, setJobType] = useState<JobType>('hybrid');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setRequirements('');
    setSalaryMin('');
    setSalaryMax('');
    setLocation('');
    setIndustry('');
    setJobType('hybrid');
    setEmploymentType('full_time');
  };

  const submit = async (status: 'draft' | 'published') => {
    if (!userId) return;

    if (title.trim().length < 2) return setError('Give the role a title.');
    if (description.trim().length < 1) return setError('Add a description — candidates read it.');

    const min = salaryMin ? Number.parseInt(salaryMin, 10) : null;
    const max = salaryMax ? Number.parseInt(salaryMax, 10) : null;
    if (min != null && max != null && max < min) {
      return setError('The top of the salary range must be at least the bottom.');
    }

    setError(null);
    setBusy(true);
    try {
      await createJobPosting(userId, {
        title,
        description,
        // One requirement per line keeps the input obvious.
        requirements: requirements
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        salary_min: min,
        salary_max: max,
        location,
        job_type: jobType,
        employment_type: employmentType,
        industry: industry.trim() || null,
        status,
      });

      showToast(
        status === 'published' ? 'Posted — it is in candidate decks now.' : 'Saved as a draft.',
        'success',
      );
      reset();
      router.push('/employer');
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save this posting.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Post a job</Text>
          <Text style={styles.subtitle}>
            Published roles appear in matching candidates' decks immediately.
          </Text>

          {error ? <ErrorNotice message={error} /> : null}

          <View style={styles.section}>
            <SectionTitle>The role</SectionTitle>
            <Field
              label="Job title"
              value={title}
              onChangeText={setTitle}
              placeholder="Senior React Native Engineer"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What the person will own, who they work with, what success looks like."
              multiline
            />
            <Field
              label="Requirements"
              value={requirements}
              onChangeText={setRequirements}
              placeholder={'4+ years React Native\nTypeScript\nComfortable owning releases'}
              multiline
              hint="One per line."
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>Work style</SectionTitle>
            <View style={styles.chips}>
              {JOB_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={JOB_TYPE_LABELS[type]}
                  selected={jobType === type}
                  onPress={() => setJobType(type)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Employment type</Text>
            <View style={styles.chips}>
              {EMPLOYMENT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={EMPLOYMENT_TYPE_LABELS[type]}
                  selected={employmentType === type}
                  onPress={() => setEmploymentType(type)}
                />
              ))}
            </View>

            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Tanjong Pagar, Singapore"
            />
            <Field
              label="Industry"
              value={industry}
              onChangeText={setIndustry}
              placeholder="Software"
              hint="Used to match candidate preferences."
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>Salary (monthly, SGD)</SectionTitle>
            <View style={styles.salaryRow}>
              <View style={styles.salaryField}>
                <Field
                  label="From"
                  value={salaryMin}
                  onChangeText={setSalaryMin}
                  placeholder="8000"
                  keyboardType="number-pad"
                  inputMode="numeric"
                />
              </View>
              <View style={styles.salaryField}>
                <Field
                  label="To"
                  value={salaryMax}
                  onChangeText={setSalaryMax}
                  placeholder="11000"
                  keyboardType="number-pad"
                  inputMode="numeric"
                />
              </View>
            </View>
            <Text style={styles.salaryHint}>
              Leave both blank to show "Salary not disclosed" — expect fewer swipes.
            </Text>
          </View>

          <Button label="Publish job" onPress={() => void submit('published')} loading={busy} />
          <Button
            label="Save as draft"
            variant="secondary"
            onPress={() => void submit('draft')}
            disabled={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl },
  title: { fontSize: typography.title.fontSize, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  salaryRow: { flexDirection: 'row', gap: spacing.md },
  salaryField: { flex: 1 },
  salaryHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    marginTop: -spacing.sm,
  },
});
