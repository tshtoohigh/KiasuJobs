import { Loader2 } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";
import { APPLICATION_STATUS_LABELS, initialsFromName } from "@/lib/types";
import type { ApplicationStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  full?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-bg hover:brightness-110 font-semibold",
  secondary: "bg-surface text-white border border-border hover:bg-card-hover",
  ghost: "bg-transparent text-muted hover:text-white hover:bg-surface",
  danger: "bg-red text-white hover:brightness-110 font-semibold",
};

export function Button({
  variant = "primary",
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

const FIELD_BASE =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-white placeholder:text-muted-dark focus:border-accent focus:outline-none";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Field({ label, hint, className, ...props }: FieldProps) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-[13px] font-semibold text-white">
        {label}
      </span>
      <input className={cn(FIELD_BASE, className)} {...props} />
      {hint ? (
        <span className="mt-1.5 block text-xs text-muted-dark">{hint}</span>
      ) : null}
    </label>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextArea({ label, hint, className, ...props }: TextAreaProps) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-[13px] font-semibold text-white">
        {label}
      </span>
      <textarea
        rows={4}
        className={cn(FIELD_BASE, "resize-y", className)}
        {...props}
      />
      {hint ? (
        <span className="mt-1.5 block text-xs text-muted-dark">{hint}</span>
      ) : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Chip / Tag
// ---------------------------------------------------------------------------

export function Chip({
  label,
  selected = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition",
        selected
          ? "border-accent bg-accent-dim font-semibold text-accent"
          : "border-border bg-surface text-muted hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

export function Tag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-semibold",
        tone === "accent"
          ? "bg-accent-dim text-accent"
          : "bg-surface text-muted",
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Application status badge
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  applied: "bg-accent-dim text-accent",
  viewed: "bg-amber-dim text-amber",
  shortlisted: "bg-green-dim text-green",
  rejected: "bg-red-dim text-red",
  hired: "bg-green-dim text-green",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold",
        STATUS_CLASSES[status],
      )}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Company logo with a deterministic initials fallback
// ---------------------------------------------------------------------------

const ACCENTS = [
  "#22F0FF",
  "#22E88A",
  "#B79CFF",
  "#FFC24D",
  "#FF5C77",
  "#7CC4FF",
] as const;

function accentForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1)
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0];
}

export function CompanyLogo({
  name,
  url,
  size = 48,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={`${name} logo`}
        style={style}
        className="shrink-0 rounded-xl bg-surface object-cover"
      />
    );
  }

  return (
    <div
      style={{
        ...style,
        backgroundColor: accentForKey(name),
        fontSize: size * 0.34,
      }}
      className="flex shrink-0 items-center justify-center rounded-xl font-bold text-bg"
    >
      {initialsFromName(name, "·")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      {label ? <p className="text-sm text-muted">{label}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="max-w-sm leading-relaxed text-muted">{message}</p>
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-red/40 bg-red-dim p-4">
      <p className="text-sm font-medium text-red">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-dark">
      {children}
    </h2>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-5", className)}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] text-muted-dark">{subtitle}</p>
      ) : null}
    </header>
  );
}
