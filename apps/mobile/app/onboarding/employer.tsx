import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CompanyLogo, ErrorNotice, Field, SectionTitle } from '@/components/ui';
import { describeSupabaseError } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { setCompanyLogo, upsertEmployerProfile } from '@/services/profiles';
import { companyLogoUrl, uploadCompanyLogo } from '@/services/storage';

export default function EmployerOnboardingScreen() {
  const { session, finishOnboarding, signOut } = useAuth();
  const userId = session?.user?.id;

  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [description, setDescription] = useState('');

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The logo upload needs an employer_profiles row to attach to, so we create
   * the profile first if the user hasn't saved it yet.
   */
  const pickLogo = async () => {
    if (!userId) return;
    if (!companyName.trim()) {
      setError('Add your company name before uploading a logo.');
      return;
    }
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

      await upsertEmployerProfile(userId, {
        company_name: companyName,
        website: website.trim() || null,
        industry: industry.trim() || null,
        description: description.trim() || null,
        company_size: companySize.trim() || null,
      });

      const path = await uploadCompanyLogo(userId, {
        uri: asset.uri,
        fileName: asset.fileName ?? 'logo.png',
        mimeType: asset.mimeType ?? null,
      });
      await setCompanyLogo(userId, path);
      setLogoPath(path);
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not upload that image.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!userId) return;
    if (!companyName.trim()) {
      setError('Your company name is required.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await upsertEmployerProfile(userId, {
        company_name: companyName,
        website: website.trim() || null,
        industry: industry.trim() || null,
        description: description.trim() || null,
        company_size: companySize.trim() || null,
      });
      await finishOnboarding();
    } catch (caught) {
      setError(describeSupabaseError(caught, 'Could not save your company profile.'));
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
          <Text style={styles.title}>Tell us about your company</Text>
          <Text style={styles.subtitle}>
            Your name and logo appear on every card a candidate swipes, so this is worth getting
            right.
          </Text>

          {error ? <ErrorNotice message={error} /> : null}

          <View style={styles.logoRow}>
            <CompanyLogo
              name={companyName || 'Your company'}
              uri={companyLogoUrl(logoPath)}
              size={72}
            />
            <View style={styles.logoActions}>
              <Button
                label={logoPath ? 'Replace logo' : 'Upload logo'}
                variant="secondary"
                onPress={() => void pickLogo()}
                loading={uploading}
              />
              <Text style={styles.logoHint}>Square PNG or JPG, up to 2 MB.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle>Company</SectionTitle>
            <Field
              label="Company name"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Kopi Tech"
            />
            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://kopitech.com"
              autoCapitalize="none"
              keyboardType="url"
              inputMode="url"
            />
            <Field
              label="Industry"
              value={industry}
              onChangeText={setIndustry}
              placeholder="Software"
            />
            <Field
              label="Company size"
              value={companySize}
              onChangeText={setCompanySize}
              placeholder="11-50"
            />
            <Field
              label="What you do"
              value={description}
              onChangeText={setDescription}
              placeholder="One or two sentences candidates will actually read."
              multiline
            />
          </View>

          <Button label="Post your first job" onPress={() => void submit()} loading={busy} />
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  logoActions: { flex: 1, gap: spacing.sm },
  logoHint: { fontSize: typography.caption.fontSize, color: colors.textFaint },
  section: { marginBottom: spacing.lg },
});
