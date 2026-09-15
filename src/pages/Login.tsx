import { useState } from "react";

import { Button, ErrorNotice, Field } from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import { useAuth } from "@/stores/useAuth";
import type { UserRole } from "@/lib/types";

import { RoleChoice } from "./RoleSelect";

/** Combined sign-in / sign-up screen. */
export function Login() {
  const signInWithEmail = useAuth((state) => state.signInWithEmail);
  const signUpWithEmail = useAuth((state) => state.signUpWithEmail);
  const signInWithGoogle = useAuth((state) => state.signInWithGoogle);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("seeker");

  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async () => {
    setError(null);

    if (mode === "signup") {
      if (!fullName.trim()) return setError("What should we call you?");
      if (password.length < 6)
        return setError("Passwords need at least 6 characters.");
    }
    if (!email.trim() || !password)
      return setError("Enter your email and password.");

    setBusy("email");
    try {
      if (mode === "signup") {
        const { needsEmailConfirmation } = await signUpWithEmail(
          email,
          password,
          role,
          fullName,
        );
        if (needsEmailConfirmation) setConfirmSent(true);
      } else {
        await signInWithEmail(email, password);
      }
      // On success the auth stage changes and App swaps the routes out.
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not sign you in."));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle(); // full-page redirect
    } catch (caught) {
      setError(describeSupabaseError(caught, "Google sign-in failed."));
      setBusy(null);
    }
  };

  if (confirmSent) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-extrabold text-white">Check your inbox</h1>
        <p className="leading-relaxed text-muted">
          We sent a confirmation link to {email.trim()}. Tap it, then come back
          and sign in.
        </p>
        <p className="rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted-dark">
          You can turn confirmations off in Supabase under Authentication →
          Providers → Email, which is handy while developing.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setConfirmSent(false);
            setMode("signin");
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center overflow-y-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-accent">
          KiasuJobs
        </h1>
        <p className="mt-2 text-lg leading-snug text-muted">
          Swipe right to apply. That's the whole application.
        </p>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      {mode === "signup" ? (
        <>
          <p className="mb-2 text-[13px] font-semibold text-white">
            Which are you?
          </p>
          <div className="mb-5 flex flex-col gap-3">
            <RoleChoice
              title="I'm job hunting"
              description="Swipe through roles and apply in one gesture."
              selected={role === "seeker"}
              onClick={() => setRole("seeker")}
            />
            <RoleChoice
              title="I'm hiring"
              description="Post roles and review applicants as they arrive."
              selected={role === "employer"}
              onClick={() => setRole("employer")}
            />
          </div>

          <Field
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Aisha Tan"
            autoComplete="name"
          />
        </>
      ) : null}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />

      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
        placeholder="••••••••"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />

      <Button
        onClick={() => void submit()}
        loading={busy === "email"}
        disabled={busy !== null}
        full
      >
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-dark">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        onClick={() => void google()}
        loading={busy === "google"}
        disabled={busy !== null}
        full
      >
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "signup" ? "Already have an account? " : "New here? "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="font-bold text-accent hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-dark">
        Seeded demo accounts (password: password123)
        <br />
        seeker@kiasujobs.test · hiring@kopitech.test
      </p>
    </div>
  );
}
