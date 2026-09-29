import { Check } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useToast } from "@/stores/useToast";

const VISIBLE_MS = 2400;

/**
 * The visible half of the optimistic apply: this appears the instant a card
 * leaves the deck, well before the database has confirmed anything.
 */
export function ToastHost() {
  const toast = useToast((state) => state.toast);
  const dismiss = useToast((state) => state.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-4 top-4 z-[100] mx-auto max-w-md rounded-xl px-4 py-3 shadow-2xl",
        "motion-safe:animate-[toast-in_180ms_ease-out]",
        toast.variant === "success" && "bg-green text-bg",
        toast.variant === "error" && "bg-red text-white",
        toast.variant === "info" && "bg-surface text-white",
      )}
    >
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        {toast.variant === "success" ? (
          <Check className="h-4 w-4 shrink-0" />
        ) : null}
        {toast.message}
      </p>
    </div>
  );
}
