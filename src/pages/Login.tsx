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
        <GoogleIcon />
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
        Demo accounts (password: password123)
        <br />
        seeker@kiasujobs.test · hiring@kopitech.test
      </p>
    </div>
  );
}

/** Google's brand mark. Their guidelines require the four-colour logo. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.5 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
