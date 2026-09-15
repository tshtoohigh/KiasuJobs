import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import {
  completeOnboarding,
  ensureAppUser,
  fetchAppUser,
  setUserRole,
} from "@/services/profiles";
import type { AppUser, UserRole } from "@/lib/types";

/**
 * Where the app should be, given the current auth state. `App.tsx` reads this
 * and renders the matching routes, so routing lives in exactly one place.
 */
export type AuthStage =
  "loading" | "signed-out" | "needs-role" | "needs-onboarding" | "ready";

interface AuthState {
  session: Session | null;
  appUser: AppUser | null;
  initialising: boolean;

  init: () => () => void;
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

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  appUser: null,
  initialising: true,

  /**
   * Called once from App. Restores any stored session, then keeps it in sync.
   * Returns an unsubscribe function.
   */
  init: () => {
    const loadUser = async (session: Session | null) => {
      if (!session?.user) {
        set({ appUser: null });
        return;
      }
      const meta = session.user.user_metadata ?? {};
      const fullName =
        typeof meta.full_name === "string" ? meta.full_name : null;
      try {
        // The trigger usually beat us here; this covers the OAuth race.
        const row = await ensureAppUser(
          session.user.id,
          session.user.email ?? "",
          fullName,
        );
        set({ appUser: row });
      } catch {
        set({ appUser: null });
      }
    };

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        set({ session: data.session });
        await loadUser(data.session);
      } catch {
        set({ session: null, appUser: null });
      } finally {
        set({ initialising: false });
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      // Not awaited: the listener must stay synchronous.
      void loadUser(session);
    });

    return () => data.subscription.unsubscribe();
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password, role, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      // Read by the handle_new_user trigger to seed public.users with the role.
      options: { data: { role, full_name: fullName.trim() } },
    });
    if (error) throw error;

    // With email confirmations on there's no session until the link is clicked.
    return { needsEmailConfirmation: !data.session };
  },

  signInWithGoogle: async () => {
    // In a browser this is a full redirect; `detectSessionInUrl` picks up the
    // tokens when Google sends us back.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  },

  chooseRole: async (role) => {
    const userId = get().session?.user?.id;
    if (!userId) throw new Error("You need to be signed in to pick a role.");
    set({ appUser: await setUserRole(userId, role) });
  },

  finishOnboarding: async () => {
    const userId = get().session?.user?.id;
    if (!userId) throw new Error("You need to be signed in.");
    set({ appUser: await completeOnboarding(userId) });
  },

  refreshAppUser: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;
    const row = await fetchAppUser(userId);
    if (row) set({ appUser: row });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, appUser: null });
  },
}));

/** Derived routing stage. Kept as a selector so components re-render on change. */
export function useAuthStage(): AuthStage {
  return useAuth((state) => {
    if (state.initialising) return "loading";
    if (!state.session) return "signed-out";
    if (!state.appUser) return "loading"; // session exists, profile still loading
    if (!state.appUser.role) return "needs-role";
    if (!state.appUser.onboarding_completed) return "needs-onboarding";
    return "ready";
  });
}
