import { useState } from "react";

import { cn } from "@/lib/cn";
import { Button, ErrorNotice } from "@/components/ui";
import { describeSupabaseError } from "@/lib/supabase";
import { useAuth } from "@/stores/useAuth";
import type { UserRole } from "@/lib/types";

/**
 * Only reachable when `users.role` is NULL — in practice after a Google
 * sign-up, since Google gives us no role metadata to put on the row.
 */
export function RoleSelect() {
  const chooseRole = useAuth((state) => state.chooseRole);
  const signOut = useAuth((state) => state.signOut);

  const [role, setRole] = useState<UserRole>("seeker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await chooseRole(role);
    } catch (caught) {
      setError(describeSupabaseError(caught, "Could not save your choice."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          How will you use KiasuJobs?
        </h1>
        <p className="mt-2 leading-relaxed text-muted">
          This decides which app you get. You can't switch later without a new
          account, so pick the one you actually need.
        </p>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-2">
        <Button onClick={() => void submit()} loading={busy} full>
          Continue
        </Button>
        <Button variant="ghost" onClick={() => void signOut()} full>
          Sign out
        </Button>
      </div>
    </div>
  );
}

/** Shared by this screen and the sign-up form. */
export function RoleChoice({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
        selected
          ? "border-accent bg-accent-dim"
          : "border-border bg-card hover:border-border-light",
      )}
    >
      <span className="flex-1">
        <span
          className={cn(
            "block font-bold",
            selected ? "text-accent" : "text-white",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-border",
        )}
      >
        {selected ? <span className="h-3 w-3 rounded-full bg-accent" /> : null}
      </span>
    </button>
  );
}
