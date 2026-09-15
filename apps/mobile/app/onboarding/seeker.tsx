import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JOB_TYPES, JOB_TYPE_LABELS } from '@kiasujobs/shared';
import type { JobType } from '@kiasujobs/shared';

import { Button, Chip, ErrorNotice, Field, SectionTitle } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { setSeekerResume, upsertSeekerProfile } from '@/services/profiles';
import { uploadResume } from '@/services/storage';

const INDUSTRY_OPTIONS = [
  'Software',
  'Design',
  'Logistics',
  'Finance',
  'Healthcare',
  'Education',
  'Marketing',
];

/** Splits a free-text list ("Singapore, Remote") into clean array entries. */
function parseList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export default function SeekerOnboardingScreen() {
  const { session, finishOnboarding, signOut } = useAuth();
  const userId = session?.user?.id;

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [locations, setLocations] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);

  const [resume, setResume] = useState<{ path: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleJobType = (type: JobType) => {
    setJobTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    );
  };

  const toggleIndustry = (industry: string) => {
    setIndustries((current) =>
      current.includes(industry)
        ? current.filter((entry) => entry !== industry)
        : [...current, industry],
    );
  };

  const pickResume = async () => {
    if (!userId) return;
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      setUploading(true);
      const uploaded = await uploadResume(userId, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
      });
      await setSeekerResume(userId, uploaded.path, uploaded.filename);
      setResume(uploaded);
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not upload that file.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!userId) return;
    setError(null);
    setBusy(true);

    try {
      await upsertSeekerProfile(userId, {
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        years_experience: yearsExperience ? Number.parseInt(yearsExperience, 10) : null,
        min_salary: minSalary ? Number.parseInt(minSalary, 10) : null,
        preferred_job_types: jobTypes,
        preferred_locations: parseList(locations),
        industries,
      });
      await finishOnboarding();
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            This is what employers see when you swipe right. Preferences shape the deck — leave one
            blank to mean "anything".
          </Text>

          {error ? <ErrorNotice message={error} /> : null}

          <View style={styles.section}>
            <SectionTitle>Resume</SectionTitle>
            <View style={styles.resumeBox}>
              <Text style={styles.resumeName} numberOfLines={1}>
                {resume ? resume.filename : 'No file chosen yet'}
              </Text>
              <Text style={styles.resumeHint}>
                {resume
                  ? 'Attached to every application you send.'
                  : 'PDF or Word, up to 5 MB. You can add it later from your profile.'}
              </Text>
              <Button
                label={resume ? 'Replace file' : 'Choose file'}
                variant="secondary"
                onPress={() => void pickResume()}
                loading={uploading}
              />
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle>About you</SectionTitle>
            <Field
              label="Headline"
              value={headline}
              onChangeText={setHeadline}
              placeholder="Frontend engineer · React & React Native"
            />
            <Field
              label="Short bio"
              value={bio}
              onChangeText={setBio}
              placeholder="What you do, and what you want next."
              multiline
            />
            <Field
              label="Years of experience"
              value={yearsExperience}
              onChangeText={setYearsExperience}
              placeholder="5"
              keyboardType="number-pad"
              inputMode="numeric"
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>What you're looking for</SectionTitle>

            <Text style={styles.fieldLabel}>Work style</Text>
            <View style={styles.chips}>
              {JOB_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={JOB_TYPE_LABELS[type]}
                  selected={jobTypes.includes(type)}
                  onPress={() => toggleJobType(type)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Industries</Text>
            <View style={styles.chips}>
              {INDUSTRY_OPTIONS.map((industry) => (
                <Chip
                  key={industry}
                  label={industry}
                  selected={industries.includes(industry)}
                  onPress={() => toggleIndustry(industry)}
                />
              ))}
            </View>

            <Field
              label="Preferred locations"
              value={locations}
              onChangeText={setLocations}
              placeholder="Singapore, Kuala Lumpur"
              hint="Comma separated. Remote roles always show regardless."
            />

            <Field
              label="Minimum monthly salary"
              value={minSalary}
              onChangeText={setMinSalary}
              placeholder="6000"
              keyboardType="number-pad"
              inputMode="numeric"
              hint="Jobs whose top of range falls below this are hidden."
            />
          </View>

          <Button label="Start swiping" onPress={() => void submit()} loading={busy} />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: typography.display.fontSize, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.xl },
  fieldLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  resumeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  resumeName: { fontSize: typography.heading.fontSize, fontWeight: '600', color: colors.text },
  resumeHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
});
