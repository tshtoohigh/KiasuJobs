import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ToastHost';
import { Loader } from '@/components/ui';
import { GestureHandlerRootView } from '@/lib/gestures';
import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

export default function RootLayout() {
  return (
    // GestureHandlerRootView must wrap the whole tree for the swipe deck to
    // receive touches. Reanimated's babel plugin comes from babel-preset-expo.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          {/* Above the navigator so confirmations float over every screen. */}
          <ToastHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * All routing decisions live here.
 *
 * The auth stage is derived in AuthProvider; this component's only job is to
 * make the URL agree with it. Screens never redirect on their own.
 */
function RootNavigator() {
  const { stage, appUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (stage === 'loading') return;

    const group = segments[0];

    if (stage === 'signed-out') {
      if (group !== '(auth)') router.replace('/sign-in');
      return;
    }

    if (stage === 'needs-role') {
      // Google sign-ups land here: authenticated, but no role yet.
      if (group !== 'onboarding') router.replace('/onboarding/role');
      return;
    }

    if (stage === 'needs-onboarding') {
      if (group !== 'onboarding') {
        router.replace(
          appUser?.role === 'employer' ? '/onboarding/employer' : '/onboarding/seeker',
        );
      }
      return;
    }

    // stage === 'ready' — park the user in the section that matches their role.
    if (appUser?.role === 'employer' && group !== 'employer') {
      router.replace('/employer');
      return;
    }
    if (appUser?.role === 'seeker' && group !== 'seeker') {
      router.replace('/seeker');
    }
  }, [stage, appUser?.role, segments, router]);

  if (stage === 'loading') {
    return (
      <View style={styles.splash}>
        <Loader label="Starting KiasuJobs…" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, backgroundColor: colors.bg },
});
