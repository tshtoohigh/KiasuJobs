import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EmployerProfile } from '@kiasujobs/shared';

import { Button, CompanyLogo, ErrorNotice, Field, Loader, SectionTitle } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, radius, shadow, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { fetchEmployerProfile, setCompanyLogo, upsertEmployerProfile } from '@/services/profiles';
import { companyLogoUrl, uploadCompanyLogo } from '@/services/storage';
import { showToast } from '@/stores/toast';

export default function EmployerProfileScreen() {
  const { session, appUser, signOut } = useAuth();
  const userId = session?.user?.id;

  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchEmployerProfile(userId);
      setProfile(row);
      setCompanyName(row?.company_name ?? '');
      setWebsite(row?.website ?? '');
      setIndustry(row?.industry ?? '');
      setCompanySize(row?.company_size ?? '');
      setDescription(row?.description ?? '');
      setError(null);
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not load your company profile.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = async () => {
    if (!userId) return;
    if (!companyName.trim()) {
      setError('Your company name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertEmployerProfile(userId, {
        company_name: companyName,
        website: website.trim() || null,
        industry: industry.trim() || null,
        description: description.trim() || null,
        company_size: companySize.trim() || null,
      });
      await load();
      showToast('Company profile saved.', 'success');
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async () => {
    if (!userId) return;
    setError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo access is needed to pick a logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      setUploading(true);
      const path = await uploadCompanyLogo(userId, {
        uri: asset.uri,
        fileName: asset.fileName ?? 'logo.png',
        mimeType: asset.mimeType ?? null,
      });
      await setCompanyLogo(userId, path);
      await load();
      showToast('Logo updated.', 'success');
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not upload that image.'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{profile?.company_name ?? 'Your company'}</Text>
          <Text style={styles.email}>{appUser?.email}</Text>

          {error ? <ErrorNotice message={error} /> : null}

          <View style={[styles.card, shadow.soft]}>
            <SectionTitle>Logo</SectionTitle>
            <View style={styles.logoRow}>
              <CompanyLogo
                name={profile?.company_name ?? companyName ?? 'Company'}
                uri={companyLogoUrl(profile?.company_logo_path)}
                size={64}
              />
              <View style={styles.logoActions}>
                <Button
                  label={profile?.company_logo_path ? 'Replace' : 'Upload'}
                  variant="secondary"
                  onPress={() => void pickLogo()}
                  loading={uploading}
                />
                <Text style={styles.hint}>Shown on every card.</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, shadow.soft]}>
            <SectionTitle>Details</SectionTitle>
            <Field label="Company name" value={companyName} onChangeText={setCompanyName} />
            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
              keyboardType="url"
              inputMode="url"
            />
            <Field label="Industry" value={industry} onChangeText={setIndustry} />
            <Field label="Company size" value={companySize} onChangeText={setCompanySize} />
            <Field
              label="What you do"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Button label="Save changes" onPress={() => void save()} loading={saving} />
          </View>

          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  logoActions: { flex: 1, gap: spacing.sm },
  hint: { fontSize: typography.caption.fontSize, color: colors.textFaint },
});
