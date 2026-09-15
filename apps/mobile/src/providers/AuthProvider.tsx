import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppUser, UserRole } from '@kiasujobs/shared';

import { supabase } from '@/lib/supabase';
import { completeOnboarding, ensureAppUser, fetchAppUser, setUserRole } from '@/services/profiles';

/**
 * Where the app should be, given the current auth state. The root layout reads
 * this and redirects, which keeps routing decisions in one place instead of
 * scattered across screens.
 */
export type AuthStage = 'loading' | 'signed-out' | 'needs-role' | 'needs-onboarding' | 'ready';

interface AuthContextValue {
  session: Session | null;
  appUser: AppUser | null;
  stage: AuthStage;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    role: UserRole,
    fullName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  chooseRole: (role: UserRole) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Deep link Supabase sends the browser back to. Must be listed in
 * `supabase/config.toml` → additional_redirect_urls (and in the dashboard for
 * a hosted project).
 */
const oauthRedirectTo = makeRedirectUri({ scheme: 'kiasujobs', path: 'auth/callback' });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  const loadAppUser = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setAppUser(null);
      return;
    }

    const { id, email } = activeSession.user;
    const metadata = activeSession.user.user_metadata ?? {};
    const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : null;

    // The `on_auth_user_created` trigger normally beat us here; ensureAppUser
    // covers the OAuth race where it hasn't committed yet.
    const row = await ensureAppUser(id, email ?? '', fullName);
    setAppUser(row);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Restore whatever session AsyncStorage is holding.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        await loadAppUser(data.session);
      } catch {
        // A corrupt stored session shouldn't wedge the app on a blank screen.
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setInitialising(false);
      }
    })();

    // 2. Track sign-in / sign-out / token refresh from then on.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      // Deliberately not awaited: the listener must stay synchronous.
      void loadAppUser(nextSession).catch(() => setAppUser(null));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadAppUser]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, role: UserRole, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        // Read by the handle_new_user trigger to seed public.users.
        options: { data: { role, full_name: fullName.trim() } },
      });
      if (error) throw error;

      // With email confirmations on, there's no session until the link is
      // clicked. Locally confirmations are off, so a session arrives instantly.
      return { needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google sign-in is not configured for this project.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
    if (result.type !== 'success') return; // dismissed — not an error

    // PKCE hands back a one-time code that we trade for a session.
    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;
    if (typeof code !== 'string') {
      const description = queryParams?.error_description;
      throw new Error(
        typeof description === 'string' ? description : 'Google sign-in did not complete.',
      );
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const chooseRole = useCallback(
    async (role: UserRole) => {
      if (!session?.user) throw new Error('You need to be signed in to pick a role.');
      const updated = await setUserRole(session.user.id, role);
      setAppUser(updated);
    },
    [session],
  );

  const finishOnboarding = useCallback(async () => {
    if (!session?.user) throw new Error('You need to be signed in.');
    const updated = await completeOnboarding(session.user.id);
    setAppUser(updated);
  }, [session]);

  const refreshAppUser = useCallback(async () => {
    if (!session?.user) return;
    const row = await fetchAppUser(session.user.id);
    if (row) setAppUser(row);
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAppUser(null);
    setSession(null);
  }, []);

  const stage: AuthStage = useMemo(() => {
    if (initialising) return 'loading';
    if (!session) return 'signed-out';
    // Session exists but the profile row hasn't loaded yet.
    if (!appUser) return 'loading';
    if (!appUser.role) return 'needs-role';
    if (!appUser.onboarding_completed) return 'needs-onboarding';
    return 'ready';
  }, [initialising, session, appUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      appUser,
      stage,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      chooseRole,
      finishOnboarding,
      refreshAppUser,
      signOut,
    }),
    [
      session,
      appUser,
      stage,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      chooseRole,
      finishOnboarding,
      refreshAppUser,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Convenience for screens that genuinely cannot render without a user id. */
export function useCurrentUserId(): string {
  const { session } = useAuth();
  if (!session?.user?.id) throw new Error('No authenticated user.');
  return session.user.id;
}
