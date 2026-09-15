import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JOB_TYPES, JOB_TYPE_LABELS } from '@kiasujobs/shared';
import type { JobType, SeekerProfile } from '@kiasujobs/shared';

import { Button, Chip, ErrorNotice, Field, Loader, SectionTitle } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { fetchSeekerProfile, setSeekerResume, upsertSeekerProfile } from '@/services/profiles';
import { uploadResume } from '@/services/storage';
import { showToast } from '@/stores/toast';
import { useJobQueue } from '@/stores/jobQueue';

export default function SeekerProfileScreen() {
  const { session, appUser, signOut } = useAuth();
  const userId = session?.user?.id;
  const resetQueue = useJobQueue((state) => state.initialise);

  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchSeekerProfile(userId);
      setProfile(row);
      setHeadline(row?.headline ?? '');
      setMinSalary(row?.min_salary != null ? String(row.min_salary) : '');
      setJobTypes(row?.preferred_job_types ?? []);
      setError(null);
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleJobType = (type: JobType) => {
    setJobTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    );
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      await upsertSeekerProfile(userId, {
        headline: headline.trim() || null,
        bio: profile?.bio ?? null,
        years_experience: profile?.years_experience ?? null,
        min_salary: minSalary ? Number.parseInt(minSalary, 10) : null,
        preferred_job_types: jobTypes,
        preferred_locations: profile?.preferred_locations ?? [],
        industries: profile?.industries ?? [],
      });

      // Preferences feed get_job_feed, so the deck has to be rebuilt.
      await resetQueue(true);
      showToast('Preferences saved — your deck has been refreshed.', 'success');
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const replaceResume = async () => {
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
      await load();
      showToast('Resume updated.', 'success');
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not upload that file.'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{appUser?.full_name ?? 'Your profile'}</Text>
        <Text style={styles.email}>{appUser?.email}</Text>

        {error ? <ErrorNotice message={error} /> : null}

        <View style={[styles.card, shadow.soft]}>
          <SectionTitle>Resume</SectionTitle>
          <Text style={styles.resumeName} numberOfLines={1}>
            {profile?.resume_filename ?? 'No resume uploaded'}
          </Text>
          <Text style={styles.resumeHint}>
            {profile?.resume_path
              ? 'Sent with every application. Replacing it only affects future applications.'
              : 'Employers see far more value in an application with a resume attached.'}
          </Text>
          <Button
            label={profile?.resume_path ? 'Replace resume' : 'Upload resume'}
            variant="secondary"
            onPress={() => void replaceResume()}
            loading={uploading}
          />
        </View>

        <View style={[styles.card, shadow.soft]}>
          <SectionTitle>Deck preferences</SectionTitle>

          <Field
            label="Headline"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Frontend engineer · React & React Native"
          />

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

          <Field
            label="Minimum monthly salary"
            value={minSalary}
            onChangeText={setMinSalary}
            placeholder="6000"
            keyboardType="number-pad"
            inputMode="numeric"
            hint="Leave blank to see everything."
          />

          <Button label="Save preferences" onPress={() => void save()} loading={saving} />
        </View>

        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.sm,
  },
  email: {
    fontSize: typography.body.fontSize,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
    marginTop: -spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  resumeName: { fontSize: typography.heading.fontSize, fontWeight: '600', color: colors.text },
  resumeHint: {
    fontSize: typography.caption.fontSize,
    color: colors.textFaint,
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
});
