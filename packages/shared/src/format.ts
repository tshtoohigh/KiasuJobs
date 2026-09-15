import { EMPLOYMENT_TYPE_LABELS, JOB_TYPE_LABELS } from './enums';
import type { EmploymentType, JobType } from './enums';

/** `85000` -> `85k`, `950` -> `950`, `1250000` -> `1.25M` */
function compactAmount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(2).replace(/0+$/, '')}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(value);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  INR: '₹',
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

/**
 * Renders a salary range for a job card. Handles open-ended and missing ranges
 * so cards never show a dangling dash.
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = 'USD',
): string {
  const symbol = currencySymbol(currency);
  if (min != null && max != null) {
    if (min === max) return `${symbol}${compactAmount(min)}`;
    return `${symbol}${compactAmount(min)} – ${symbol}${compactAmount(max)}`;
  }
  if (min != null) return `From ${symbol}${compactAmount(min)}`;
  if (max != null) return `Up to ${symbol}${compactAmount(max)}`;
  return 'Salary not disclosed';
}

/** "Remote" jobs shouldn't advertise an office city as the primary location. */
export function formatLocation(location: string, jobType: JobType): string {
  const typeLabel = JOB_TYPE_LABELS[jobType];
  if (jobType === 'remote') {
    return location.trim().length > 0 ? `${typeLabel} · ${location}` : typeLabel;
  }
  return `${typeLabel} · ${location}`;
}

export function formatEmploymentType(employmentType: EmploymentType): string {
  return EMPLOYMENT_TYPE_LABELS[employmentType];
}

/** Short relative time for cards and lists: `Just now`, `4h ago`, `3d ago`. */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Trims a long job description down to a card-sized teaser. */
export function truncate(text: string, maxLength = 180): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function initialsFromName(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || fallback;
}
